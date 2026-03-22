import { createHash, createHmac, randomUUID } from "node:crypto";

import {
  APEX,
  putEntity,
  queryByAlias,
  updateEntity,
  type StorableEntity,
} from "@jaypie/dynamodb";
import { type IndexDefinition, registerModel } from "@jaypie/fabric";
import { log } from "@jaypie/logger";

//
//
// Constants
//

const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year in seconds
const COOKIE_NAME = "garden-session";
const SESSION_MODEL = "session";
const SESSION_PREFIX = "gs_";

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

registerModel({ model: SESSION_MODEL, indexes: SESSION_INDEXES });

//
//
// Types
//

interface HistoryEvent {
  email?: string;
  event: string;
  identity?: string;
  time: string;
}

type SessionEntity = StorableEntity & {
  events: HistoryEvent[];
};

//
//
// Helpers
//

function hashToken(token: string): string {
  const salt = process.env.PROJECT_SALT;
  if (salt) {
    return createHmac("sha256", salt).update(token).digest("hex");
  }
  return createHash("sha256").update(token).digest("hex");
}

//
//
// Main
//

async function createSession(): Promise<string> {
  const token = `${SESSION_PREFIX}${randomUUID()}`;
  const hash = hashToken(token);
  const now = new Date().toISOString();

  const entity = {
    alias: hash,
    createdAt: now,
    events: [{ event: "created", time: now }],
    id: randomUUID(),
    model: SESSION_MODEL,
    scope: APEX,
    sequence: Date.now(),
    updatedAt: now,
  } as SessionEntity;

  await putEntity({ entity });
  log.debug("Session created", { hint: token.slice(-4) });
  return token;
}

async function getSession(token: string): Promise<SessionEntity | null> {
  const hash = hashToken(token);
  const entity = await queryByAlias({
    alias: hash,
    model: SESSION_MODEL,
    scope: APEX,
  });
  return (entity as SessionEntity) ?? null;
}

async function linkSession(
  token: string,
  { email, sub }: { email: string; sub: string },
): Promise<void> {
  const entity = await getSession(token);
  if (!entity) {
    log.warn("Cannot link session: not found");
    return;
  }

  const now = new Date().toISOString();
  const events = [...(entity.events ?? [])];
  events.push({ email, event: "login", identity: sub, time: now });

  const updated = {
    ...entity,
    events,
    updatedAt: now,
    xid: sub,
  } as SessionEntity;

  await updateEntity({ entity: updated });
  log.trace("Session linked", { sub });
}

async function unlinkSession(token: string): Promise<void> {
  const entity = await getSession(token);
  if (!entity) {
    log.warn("Cannot unlink session: not found");
    return;
  }

  const now = new Date().toISOString();
  const events = [...(entity.events ?? [])];
  const previousXid = entity.xid;
  events.push({ event: "logout", identity: previousXid, time: now });

  const updated = {
    ...entity,
    events,
    updatedAt: now,
    xid: undefined,
  } as SessionEntity;

  await updateEntity({ entity: updated });
  log.trace("Session unlinked");
}

async function updateSessionDeviceId(
  token: string,
  deviceId: string,
): Promise<void> {
  const entity = await getSession(token);
  if (!entity) return;

  const now = new Date().toISOString();
  const updated = {
    ...entity,
    deviceId,
    updatedAt: now,
  } as SessionEntity & { deviceId: string };

  await updateEntity({ entity: updated });
  log.trace("Session device ID updated", { deviceId: deviceId.slice(-4) });
}

//
//
// Export
//

export {
  COOKIE_MAX_AGE,
  COOKIE_NAME,
  createSession,
  getSession,
  linkSession,
  unlinkSession,
  updateSessionDeviceId,
};
export type { HistoryEvent, SessionEntity };
