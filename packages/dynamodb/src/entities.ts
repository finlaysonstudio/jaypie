import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

import { getDocClient, getTableName } from "./client.js";
import { ARCHIVED_SUFFIX, DELETED_SUFFIX } from "./constants.js";
import { indexEntity } from "./keyBuilders.js";
import type { FabricEntity } from "./types.js";

/**
 * Parameters for getEntity
 */
export interface GetEntityParams {
  /** Entity ID (sort key) */
  id: string;
  /** Entity model (partition key) */
  model: string;
}

/**
 * Parameters for putEntity
 */
export interface PutEntityParams<T extends FabricEntity> {
  /** The entity to save */
  entity: T;
}

/**
 * Parameters for updateEntity
 */
export interface UpdateEntityParams<T extends FabricEntity> {
  /** The entity with updated fields */
  entity: T;
}

/**
 * Parameters for deleteEntity (soft delete)
 */
export interface DeleteEntityParams {
  /** Entity ID (sort key) */
  id: string;
  /** Entity model (partition key) */
  model: string;
}

/**
 * Parameters for archiveEntity
 */
export interface ArchiveEntityParams {
  /** Entity ID (sort key) */
  id: string;
  /** Entity model (partition key) */
  model: string;
}

/**
 * Get a single entity by primary key
 */
export async function getEntity<T extends FabricEntity = FabricEntity>(
  params: GetEntityParams,
): Promise<T | null> {
  const { id, model } = params;
  const docClient = getDocClient();
  const tableName = getTableName();

  const command = new GetCommand({
    Key: { id, model },
    TableName: tableName,
  });

  const response = await docClient.send(command);
  return (response.Item as T) ?? null;
}

/**
 * Put (create or replace) an entity
 * Auto-populates GSI index keys via indexEntity
 */
export async function putEntity<T extends FabricEntity>(
  params: PutEntityParams<T>,
): Promise<T> {
  const { entity } = params;
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
 */
export async function updateEntity<T extends FabricEntity>(
  params: UpdateEntityParams<T>,
): Promise<T> {
  const { entity } = params;
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
 * Soft delete an entity by setting deletedAt timestamp
 * Re-indexes with appropriate suffix based on archived/deleted state
 */
export async function deleteEntity(
  params: DeleteEntityParams,
): Promise<boolean> {
  const { id, model } = params;
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
}

/**
 * Archive an entity by setting archivedAt timestamp
 * Re-indexes with appropriate suffix based on archived/deleted state
 */
export async function archiveEntity(
  params: ArchiveEntityParams,
): Promise<boolean> {
  const { id, model } = params;
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
}

/**
 * Hard delete an entity (permanently removes from table)
 * Use with caution - prefer deleteEntity for soft delete
 */
export async function destroyEntity(
  params: DeleteEntityParams,
): Promise<boolean> {
  const { id, model } = params;
  const docClient = getDocClient();
  const tableName = getTableName();

  const command = new DeleteCommand({
    Key: { id, model },
    TableName: tableName,
  });

  await docClient.send(command);
  return true;
}
