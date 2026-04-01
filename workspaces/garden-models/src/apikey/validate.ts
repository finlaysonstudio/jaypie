import { APEX, queryByAlias } from "@jaypie/dynamodb";
import { ForbiddenError, UnauthorizedError } from "@jaypie/errors";
import { log } from "@jaypie/logger";
import { hashJaypieKey, validateJaypieKey } from "@jaypie/kit";

import type { ValidateResult } from "./types";

// Ensure model is registered
import "./model";

//
//
// Constants
//

const GARDEN_KEY_OPTIONS = { issuer: "jaypie" };

//
//
// Main
//

async function validateApiKey(token: string): Promise<ValidateResult> {
  // Format check
  if (!validateJaypieKey(token, GARDEN_KEY_OPTIONS)) {
    log.trace("API key failed format validation");
    throw new UnauthorizedError();
  }

  // Hash and look up in DynamoDB
  const hash = hashJaypieKey(token);
  const entity = await queryByAlias({
    alias: hash,
    model: "apikey",
    scope: APEX,
  });

  if (entity) {
    log.trace("API key found in database");
    const record = entity as unknown as {
      createdAt?: string;
      garden?: string;
      id?: string;
      label?: string;
      name?: string;
      permissions?: string[];
      scope?: string;
    };
    return {
      createdAt: record.createdAt ?? "",
      garden: record.garden,
      id: record.id ?? "",
      label: record.label ?? "",
      name: record.name ?? "",
      permissions: record.permissions ?? [],
      scope: record.scope ?? "",
      valid: true,
    };
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
  const trimmed = authorization.trim();
  // Accept "Bearer <token>" or just "<token>"
  const parts = trimmed.split(" ");
  if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
    return parts[1];
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return undefined;
}

//
//
// Export
//

export { extractToken, GARDEN_KEY_OPTIONS, validateApiKey };
