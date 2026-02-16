import { createHash } from "node:crypto";

import { APEX, queryByAlias, updateEntity, type StorableEntity } from "@jaypie/dynamodb";
import { ForbiddenError, UnauthorizedError } from "@jaypie/errors";
import { type IndexDefinition, registerModel } from "@jaypie/fabric";
import { log } from "@jaypie/logger";

//
//
// Constants
//

const SESSION_PREFIX = "ss_jpi_";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

//
//
// Model Registration
//

const SESSION_INDEXES: IndexDefinition[] = [
  {
    name: "indexAlias",
    pk: ["scope", "model", "alias"],
    sk: ["sequence"],
    sparse: true,
  },
  { name: "indexScope", pk: ["scope", "model"], sk: ["sequence"] },
  {
    name: "indexXid",
    pk: ["scope", "model", "xid"],
    sk: ["sequence"],
    sparse: true,
  },
];

registerModel({ model: "session", indexes: SESSION_INDEXES });

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

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

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
