import {
  APEX,
  initClient,
  putEntity,
  queryByAlias,
} from "@jaypie/dynamodb";
import { ForbiddenError, UnauthorizedError } from "@jaypie/errors";
import { log } from "@jaypie/logger";

import { isValidApiKeyFormat } from "./checksum.js";
import { generateKeyFromSeed, hashKey } from "./generate.js";

//
//
// Types
//

interface ValidateResult {
  level: string;
  valid: true;
}

//
//
// Main
//

async function validateApiKey(token: string): Promise<ValidateResult> {
  // Format check
  if (!isValidApiKeyFormat(token)) {
    log.trace("API key failed format validation");
    throw new UnauthorizedError();
  }

  // Hash and look up in DynamoDB
  const hash = hashKey(token);
  const entity = await queryByAlias({
    alias: hash,
    model: "apikey",
    scope: APEX,
  });

  if (entity) {
    log.trace("API key found in database");
    return { level: entity.category ?? "owner", valid: true };
  }

  // Check against seed
  const seed = process.env.PROJECT_ADMIN_SEED;
  if (seed) {
    const seedKey = generateKeyFromSeed(seed);
    if (token === seedKey) {
      log.debug("Seed key matched, auto-provisioning");
      const now = new Date().toISOString();
      await putEntity({
        entity: {
          alias: hash,
          category: "owner",
          createdAt: now,
          label: token.slice(-4),
          id: crypto.randomUUID(),
          model: "apikey",
          name: "Owner Key",
          scope: APEX,
          sequence: Date.now(),
          type: "seed",
          updatedAt: now,
        },
      });
      return { level: "owner", valid: true };
    }
  }

  log.trace("API key not recognized");
  throw new ForbiddenError();
}

//
//
// Helpers
//

function extractToken(authorization: string | undefined): string | undefined {
  if (!authorization) return undefined;
  const parts = authorization.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1];
  }
  return undefined;
}

//
//
// Export
//

export { extractToken, validateApiKey };
export type { ValidateResult };
