import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { ConflictError, NotFoundError } from "@jaypie/errors";
import { assertModelStatus, fabricService } from "@jaypie/fabric";

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
    if (
      (error as { name?: string })?.name === "ConditionalCheckFailedException"
    ) {
      return null;
    }
    throw error;
  }
  return indexedEntity;
}

/**
 * Update an existing entity.
 * `indexEntity` auto-bumps `updatedAt` — callers never set it manually.
 *
 * Pass `condition` to guard the write with a DynamoDB ConditionExpression
 * (mirroring `transactWriteEntities`), supplying `names`/`values` for any
 * `#name`/`:value` placeholders. When the condition fails the item is left
 * unchanged and a `ConflictError` (409) is thrown, giving write-time
 * enforcement of read-check-then-write invariants. Without `condition` the
 * write is an unconditional overwrite (last write wins).
 */
export async function updateEntity({
  condition,
  entity,
  names,
  values,
}: {
  condition?: string;
  entity: StorableEntity;
  names?: Record<string, string>;
  values?: Record<string, unknown>;
}): Promise<StorableEntity> {
  const docClient = getDocClient();
  const tableName = getTableName();

  const updatedEntity = indexEntity(entity);

  const command = new PutCommand({
    Item: updatedEntity,
    TableName: tableName,
    ...(condition
      ? {
          ConditionExpression: condition,
          ...(names ? { ExpressionAttributeNames: names } : {}),
          ...(values ? { ExpressionAttributeValues: values } : {}),
        }
      : {}),
  });

  try {
    await docClient.send(command);
  } catch (error) {
    if (
      (error as { name?: string })?.name === "ConditionalCheckFailedException"
    ) {
      throw new ConflictError(
        "The conditional update was rejected because the persisted state no longer matches the condition",
      );
    }
    throw error;
  }
  return updatedEntity;
}

const STATUS_FIELD = "status";

/**
 * Conditionally transition an entity's status, failing closed on a race.
 *
 * Reads the entity, merges `set`, and writes it back guarded by a
 * ConditionExpression so the write commits only when the persisted `status`
 * still equals `from`. If another writer moved the status inside the window the
 * write is rejected and a `ConflictError` (409) is thrown, leaving the item
 * unchanged — write-time enforcement of sticky lifecycle terminals and other
 * status invariants. Omit `from` to guard only that the entity still exists.
 *
 * `from` and any `set.status` are validated against the model's registered
 * `status` vocabulary (a no-op for free-string models). Throws `NotFoundError`
 * (404) when the entity does not exist.
 */
export const transitionEntity = fabricService({
  alias: "transitionEntity",
  description:
    "Conditionally update an entity only when its persisted status matches `from`, throwing ConflictError on a race",
  input: {
    id: {
      type: String,
      required: true,
      description: "Entity id (partition key)",
    },
    from: {
      type: String,
      required: false,
      description:
        "Expected current status; the write is rejected if the persisted status differs",
    },
    set: {
      type: Object,
      required: true,
      description: "Fields to merge into the entity (typically the new status)",
    },
  },
  service: async ({
    from,
    id,
    set,
  }: {
    from?: string;
    id: string;
    set: Record<string, unknown>;
  }): Promise<StorableEntity> => {
    const existing = await getEntity({ id });
    if (!existing) {
      throw new NotFoundError(`Entity ${id} not found`);
    }

    if (from !== undefined) {
      assertModelStatus(existing.model, from);
    }
    if (typeof set[STATUS_FIELD] === "string") {
      assertModelStatus(existing.model, set[STATUS_FIELD]);
    }

    const merged = { ...existing, ...set, id: existing.id } as StorableEntity;

    if (from === undefined) {
      return updateEntity({
        condition: "attribute_exists(id)",
        entity: merged,
      });
    }

    return updateEntity({
      condition: "attribute_exists(id) AND #status = :from",
      entity: merged,
      names: { "#status": STATUS_FIELD },
      values: { ":from": from },
    });
  },
});

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
 *
 * Pass `conditionalCreate: true` to guard every Put with
 * `attribute_not_exists(id)` (the canonical atomic-create / uniqueness-sentinel
 * pattern), or `condition` to supply your own ConditionExpression applied to
 * every Put. When a conditional check fails the transaction is cancelled and a
 * `ConflictError` (409) is thrown so callers can map it to a 4xx.
 */
export async function transactWriteEntities({
  condition,
  conditionalCreate,
  entities,
}: {
  condition?: string;
  conditionalCreate?: boolean;
  entities: StorableEntity[];
}): Promise<void> {
  const docClient = getDocClient();
  const tableName = getTableName();

  const conditionExpression =
    condition ?? (conditionalCreate ? "attribute_not_exists(id)" : undefined);

  const command = new TransactWriteCommand({
    TransactItems: entities.map((entity) => ({
      Put: {
        ...(conditionExpression
          ? { ConditionExpression: conditionExpression }
          : {}),
        Item: indexEntity(entity),
        TableName: tableName,
      },
    })),
  });

  try {
    await docClient.send(command);
  } catch (error) {
    if (isConditionalCheckCancellation(error)) {
      throw new ConflictError(
        "A conditional write in the transaction was rejected because the item already exists",
      );
    }
    throw error;
  }
}

/**
 * True when a DynamoDB transaction was cancelled because at least one item's
 * ConditionExpression failed (mirrors createEntity's
 * ConditionalCheckFailedException handling for the multi-item case).
 */
function isConditionalCheckCancellation(error: unknown): boolean {
  const candidate = error as {
    name?: string;
    CancellationReasons?: Array<{ Code?: string }>;
  };
  return (
    candidate?.name === "TransactionCanceledException" &&
    Array.isArray(candidate.CancellationReasons) &&
    candidate.CancellationReasons.some(
      (reason) => reason?.Code === "ConditionalCheckFailed",
    )
  );
}
