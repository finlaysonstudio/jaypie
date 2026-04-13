import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { fabricService } from "@jaypie/fabric";

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
 * Get a single entity by primary key (id)
 */
export const getEntity = fabricService({
  alias: "getEntity",
  description: "Get a single entity by id",
  input: {
    id: { type: String, description: "Entity id (partition key)" },
  },
  service: async ({ id }): Promise<StorableEntity | null> => {
    const docClient = getDocClient();
    const tableName = getTableName();

    const command = new GetCommand({
      Key: { id },
      TableName: tableName,
    });

    const response = await docClient.send(command);
    return (response.Item as StorableEntity) ?? null;
  },
});

/**
 * Create an entity. Fails the conditional write if `id` already exists,
 * returning `null` instead of throwing. Use `updateEntity` to overwrite.
 * `indexEntity` auto-bumps `updatedAt` and backfills `createdAt`.
 */
export async function createEntity({
  entity,
}: {
  entity: StorableEntity;
}): Promise<StorableEntity | null> {
  const docClient = getDocClient();
  const tableName = getTableName();

  const indexedEntity = indexEntity(entity);

  const command = new PutCommand({
    ConditionExpression: "attribute_not_exists(id)",
    Item: indexedEntity,
    TableName: tableName,
  });

  try {
    await docClient.send(command);
  } catch (error) {
    if ((error as { name?: string })?.name === "ConditionalCheckFailedException") {
      return null;
    }
    throw error;
  }
  return indexedEntity;
}

/**
 * Update an existing entity.
 * `indexEntity` auto-bumps `updatedAt` — callers never set it manually.
 */
export async function updateEntity({
  entity,
}: {
  entity: StorableEntity;
}): Promise<StorableEntity> {
  const docClient = getDocClient();
  const tableName = getTableName();

  const updatedEntity = indexEntity(entity);

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
export const deleteEntity = fabricService({
  alias: "deleteEntity",
  description: "Soft delete an entity (sets deletedAt timestamp)",
  input: {
    id: { type: String, description: "Entity id" },
  },
  service: async ({ id }): Promise<boolean> => {
    const docClient = getDocClient();
    const tableName = getTableName();

    const existing = await getEntity({ id });
    if (!existing) {
      return false;
    }

    const now = new Date().toISOString();

    // indexEntity will bump updatedAt again; set deletedAt here.
    const updatedEntity = {
      ...existing,
      deletedAt: now,
    };

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
export const archiveEntity = fabricService({
  alias: "archiveEntity",
  description: "Archive an entity (sets archivedAt timestamp)",
  input: {
    id: { type: String, description: "Entity id" },
  },
  service: async ({ id }): Promise<boolean> => {
    const docClient = getDocClient();
    const tableName = getTableName();

    const existing = await getEntity({ id });
    if (!existing) {
      return false;
    }

    const now = new Date().toISOString();

    const updatedEntity = {
      ...existing,
      archivedAt: now,
    };

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
export const destroyEntity = fabricService({
  alias: "destroyEntity",
  description: "Hard delete an entity (permanently removes from table)",
  input: {
    id: { type: String, description: "Entity id" },
  },
  service: async ({ id }): Promise<boolean> => {
    const docClient = getDocClient();
    const tableName = getTableName();

    const command = new DeleteCommand({
      Key: { id },
      TableName: tableName,
    });

    await docClient.send(command);
    return true;
  },
});

/**
 * Write multiple entities atomically using DynamoDB transactions.
 * Each entity is auto-indexed via indexEntity before writing.
 * All entities are written to the same table in a single transaction.
 */
export async function transactWriteEntities({
  entities,
}: {
  entities: StorableEntity[];
}): Promise<void> {
  const docClient = getDocClient();
  const tableName = getTableName();

  const command = new TransactWriteCommand({
    TransactItems: entities.map((entity) => ({
      Put: {
        Item: indexEntity(entity),
        TableName: tableName,
      },
    })),
  });

  await docClient.send(command);
}
