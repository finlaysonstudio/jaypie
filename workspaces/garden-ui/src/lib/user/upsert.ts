import {
  APEX,
  putEntity,
  queryByXid,
  updateEntity,
  type StorableEntity,
} from "@jaypie/dynamodb";
import { type IndexDefinition, registerModel } from "@jaypie/fabric";
import { log } from "@jaypie/logger";

//
//
// Constants
//

const DEFAULT_PERMISSIONS = ["registered:*"];
const USER_MODEL = "user";

//
//
// Model Registration
//

const USER_INDEXES: IndexDefinition[] = [
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

registerModel({ model: USER_MODEL, indexes: USER_INDEXES });

//
//
// Types
//

interface UpsertUserInput {
  email: string;
  name: string;
  sub: string;
}

//
//
// Main
//

async function upsertUser({
  email,
  name,
  sub,
}: UpsertUserInput): Promise<StorableEntity> {
  // Look up existing user by Auth0 sub
  const existing = await queryByXid({
    model: USER_MODEL,
    scope: APEX,
    xid: sub,
  });

  if (existing) {
    // Update name/email if changed
    const now = new Date().toISOString();
    const updated = {
      ...existing,
      alias: email,
      name,
      updatedAt: now,
    } as StorableEntity;
    await updateEntity({ entity: updated });
    log.trace("User updated", { email, sub });
    return updated;
  }

  // Create new user
  const now = new Date().toISOString();
  const entity = {
    alias: email,
    createdAt: now,
    id: crypto.randomUUID(),
    model: USER_MODEL,
    name,
    permissions: DEFAULT_PERMISSIONS,
    scope: APEX,
    sequence: Date.now(),
    updatedAt: now,
    xid: sub,
  } as StorableEntity & { permissions: string[] };

  await putEntity({ entity });
  log.debug("User created", { email, sub });
  return entity;
}

//
//
// Export
//

export { upsertUser };
export type { UpsertUserInput };
