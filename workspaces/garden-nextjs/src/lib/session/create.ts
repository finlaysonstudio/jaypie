import { createHash, randomUUID } from "node:crypto";

import { APEX, putEntity, type StorableEntity } from "@jaypie/dynamodb";
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

interface CreateSessionResult {
  hint: string;
  level: string;
  token: string;
}

//
//
// Helpers
//

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

//
//
// Main
//

async function createSession({
  apikeyHash,
  level,
}: {
  apikeyHash: string;
  level: string;
}): Promise<CreateSessionResult> {
  const token = `${SESSION_PREFIX}${randomUUID()}`;
  const hash = hashToken(token);
  const hint = token.slice(-4);
  const now = new Date().toISOString();
  const ttl = Math.floor((Date.now() + SESSION_TTL_MS) / 1000);

  log.trace("Creating session", { hint, level });

  await putEntity({
    entity: {
      alias: hash,
      category: level,
      createdAt: now,
      id: randomUUID(),
      label: hint,
      model: "session",
      name: "Session",
      scope: APEX,
      sequence: Date.now(),
      ttl,
      updatedAt: now,
      xid: apikeyHash,
    } as StorableEntity & { ttl: number },
  });

  return { hint, level, token };
}

//
//
// Export
//

export { createSession, hashToken, SESSION_PREFIX, SESSION_TTL_MS };
export type { CreateSessionResult };
