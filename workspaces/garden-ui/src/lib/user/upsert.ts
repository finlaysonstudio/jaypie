import {
  APEX,
  putEntity,
  queryByXid,
  updateEntity,
  type StorableEntity,
} from "@jaypie/dynamodb";
import {
  DEFAULT_PERMISSIONS,
  USER_MODEL,
  type UserEntity,
} from "@jaypie/garden-models";
import { log } from "@jaypie/logger";

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
    auth0Sub: sub,
    createdAt: now,
    id: crypto.randomUUID(),
    model: USER_MODEL,
    name,
    permissions: DEFAULT_PERMISSIONS,
    scope: APEX,
    updatedAt: now,
    xid: sub,
  } as UserEntity;

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
