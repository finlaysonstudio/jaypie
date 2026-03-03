import { APEX, queryByAlias, updateEntity, type StorableEntity } from "@jaypie/dynamodb";
import { ForbiddenError, UnauthorizedError } from "@jaypie/errors";
import { log } from "@jaypie/logger";

import { hashToken, SESSION_PREFIX, SESSION_TTL_MS } from "./create";

//
//
// Types
//

interface ValidateSessionResult {
  level: string;
  valid: true;
}

//
//
// Helpers
//

function isSessionToken(token: string): boolean {
  return typeof token === "string" && token.startsWith(SESSION_PREFIX);
}

//
//
// Main
//

async function validateSession(token: string): Promise<ValidateSessionResult> {
  if (!isSessionToken(token)) {
    log.trace("Token is not a session token");
    throw new UnauthorizedError();
  }

  const hash = hashToken(token);
  const entity = await queryByAlias({
    alias: hash,
    model: "session",
    scope: APEX,
  });

  if (!entity) {
    log.trace("Session not found");
    throw new ForbiddenError();
  }

  // Manual TTL check — DynamoDB TTL deletion is eventually consistent
  const ttl = (entity as StorableEntity & { ttl?: number }).ttl;
  if (ttl && ttl < Math.floor(Date.now() / 1000)) {
    log.trace("Session expired");
    throw new ForbiddenError();
  }

  // Sliding window — extend TTL on each successful validation
  const newTtl = Math.floor((Date.now() + SESSION_TTL_MS) / 1000);
  updateEntity({
    entity: { ...entity, ttl: newTtl } as StorableEntity & { ttl: number },
  }).catch((err) => {
    log.warn("Failed to extend session TTL", { error: err });
  });

  log.trace("Session validated");
  return { level: entity.category ?? "owner", valid: true };
}

//
//
// Export
//

export { isSessionToken, validateSession };
export type { ValidateSessionResult };
