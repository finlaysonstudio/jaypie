import { APEX, queryByAlias } from "@jaypie/dynamodb";
import { ForbiddenError, UnauthorizedError } from "@jaypie/errors";
import { type IndexDefinition, registerModel } from "@jaypie/fabric";
import { hashJaypieKey, validateJaypieKey } from "@jaypie/kit";
import { log } from "@jaypie/logger";

//
//
// Constants
//

const GARDEN_KEY_OPTIONS = { issuer: "jaypie" } as const;

//
//
// Model Registration
//

const APIKEY_INDEXES: IndexDefinition[] = [
  {
    name: "indexAlias",
    pk: ["scope", "model", "alias"],
    sk: ["sequence"],
    sparse: true,
  },
  { name: "indexScope", pk: ["scope", "model"], sk: ["sequence"] },
];

registerModel({ model: "apikey", indexes: APIKEY_INDEXES });

//
//
// Types
//

interface ValidateResult {
  valid: true;
}

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
    return { valid: true };
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
