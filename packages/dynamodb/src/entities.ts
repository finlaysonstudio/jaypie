import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { serviceHandler } from "@jaypie/vocabulary";

import { getDocClient, getTableName } from "./client.js";
import { ARCHIVED_SUFFIX, DELETED_SUFFIX } from "./constants.js";
import { indexEntity } from "./keyBuilders.js";
import type { StorableEntity } from "./types.js";

/**
 * Calculate suffix based on entity's archived/deleted state
 */
function calculateEntitySuffix(entity: {
  archivedAt?: string;
  deletedAt?: string;
}): string {
  const hasArchived = Boolean(entity.archivedAt);
  const hasDeleted = Boolean(entity.deletedAt);

  if (hasArchived && hasDeleted) {
    return ARCHIVED_SUFFIX + DELETED_SUFFIX;
  }
  if (hasArchived) {
    return ARCHIVED_SUFFIX;
  }
  if (hasDeleted) {
    return DELETED_SUFFIX;
  }
  return "";
}

/**
 * Get a single entity by primary key
 */
export const getEntity = serviceHandler({
  alias: "getEntity",
  description: "Get a single entity by primary key",
  input: {
    id: { type: String, description: "Entity ID (sort key)" },
    model: { type: String, description: "Entity model (partition key)" },
  },
  service: async ({ id, model }): Promise<StorableEntity | null> => {
    const docClient = getDocClient();
    const tableName = getTableName();

    const command = new GetCommand({
      Key: { id, model },
      TableName: tableName,
    });

    const response = await docClient.send(command);
    return (response.Item as StorableEntity) ?? null;
  },
});

/**
 * Put (create or replace) an entity
 * Auto-populates GSI index keys via indexEntity
 *
 * Note: This is a regular async function (not serviceHandler) because it accepts
 * complex StorableEntity objects that can't be coerced by vocabulary's type system.
 */
export async function putEntity({
  entity,
}: {
  entity: StorableEntity;
}): Promise<StorableEntity> {
  const docClient = getDocClient();
  const tableName = getTableName();

  // Auto-populate index keys
  const indexedEntity = indexEntity(entity);

  const command = new PutCommand({
    Item: indexedEntity,
    TableName: tableName,
  });

  await docClient.send(command);
  return indexedEntity;
}

/**
 * Update an existing entity
 * Auto-populates GSI index keys and sets updatedAt
 *
 * Note: This is a regular async function (not serviceHandler) because it accepts
 * complex StorableEntity objects that can't be coerced by vocabulary's type system.
 */
export async function updateEntity({
  entity,
}: {
  entity: StorableEntity;
}): Promise<StorableEntity> {
  const docClient = getDocClient();
  const tableName = getTableName();

  // Update timestamp and re-index
  const updatedEntity = indexEntity({
    ...entity,
    updatedAt: new Date().toISOString(),
  });

  const command = new PutCommand({
    Item: updatedEntity,
    TableName: tableName,
  });

  await docClient.send(command);
  return updatedEntity;
}

/**
 * Soft delete an entity by setting deletedAt timestamp
 * Re-indexes with appropriate suffix based on archived/deleted state
 */
export const deleteEntity = serviceHandler({
  alias: "deleteEntity",
  description: "Soft delete an entity (sets deletedAt timestamp)",
  input: {
    id: { type: String, description: "Entity ID (sort key)" },
    model: { type: String, description: "Entity model (partition key)" },
  },
  service: async ({ id, model }): Promise<boolean> => {
    const docClient = getDocClient();
    const tableName = getTableName();

    // Fetch the current entity
    const existing = await getEntity({ id, model });
    if (!existing) {
      return false;
    }

    const now = new Date().toISOString();

    // Build updated entity with deletedAt
    const updatedEntity = {
      ...existing,
      deletedAt: now,
      updatedAt: now,
    };

    // Calculate suffix based on combined state (may already be archived)
    const suffix = calculateEntitySuffix(updatedEntity);
    const deletedEntity = indexEntity(updatedEntity, suffix);

    const command = new PutCommand({
      Item: deletedEntity,
      TableName: tableName,
    });

    await docClient.send(command);
    return true;
  },
});

/**
 * Archive an entity by setting archivedAt timestamp
 * Re-indexes with appropriate suffix based on archived/deleted state
 */
export const archiveEntity = serviceHandler({
  alias: "archiveEntity",
  description: "Archive an entity (sets archivedAt timestamp)",
  input: {
    id: { type: String, description: "Entity ID (sort key)" },
    model: { type: String, description: "Entity model (partition key)" },
  },
  service: async ({ id, model }): Promise<boolean> => {
    const docClient = getDocClient();
    const tableName = getTableName();

    // Fetch the current entity
    const existing = await getEntity({ id, model });
    if (!existing) {
      return false;
    }

    const now = new Date().toISOString();

    // Build updated entity with archivedAt
    const updatedEntity = {
      ...existing,
      archivedAt: now,
      updatedAt: now,
    };

    // Calculate suffix based on combined state (may already be deleted)
    const suffix = calculateEntitySuffix(updatedEntity);
    const archivedEntity = indexEntity(updatedEntity, suffix);

    const command = new PutCommand({
      Item: archivedEntity,
      TableName: tableName,
    });

    await docClient.send(command);
    return true;
  },
});

/**
 * Hard delete an entity (permanently removes from table)
 * Use with caution - prefer deleteEntity for soft delete
 */
export const destroyEntity = serviceHandler({
  alias: "destroyEntity",
  description: "Hard delete an entity (permanently removes from table)",
  input: {
    id: { type: String, description: "Entity ID (sort key)" },
    model: { type: String, description: "Entity model (partition key)" },
  },
  service: async ({ id, model }): Promise<boolean> => {
    const docClient = getDocClient();
    const tableName = getTableName();

    const command = new DeleteCommand({
      Key: { id, model },
      TableName: tableName,
    });

    await docClient.send(command);
    return true;
  },
});
