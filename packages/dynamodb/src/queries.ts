import { QueryCommand } from "@aws-sdk/lib-dynamodb";

import { getDocClient, getTableName } from "./client.js";
import {
  INDEX_ALIAS,
  INDEX_CLASS,
  INDEX_OU,
  INDEX_TYPE,
  INDEX_XID,
} from "./constants.js";
import {
  buildIndexAlias,
  buildIndexClass,
  buildIndexOu,
  buildIndexType,
  buildIndexXid,
} from "./keyBuilders.js";
import type { FabricEntity, QueryOptions, QueryResult } from "./types.js";

/**
 * Execute a GSI query with common options
 */
async function executeQuery<T extends FabricEntity>(
  indexName: string,
  keyValue: string,
  options: QueryOptions = {},
): Promise<QueryResult<T>> {
  const {
    ascending = false,
    includeDeleted = false,
    limit,
    startKey,
  } = options;

  const docClient = getDocClient();
  const tableName = getTableName();

  // Build filter expression for soft-delete
  let filterExpression: string | undefined;
  if (!includeDeleted) {
    filterExpression = "attribute_not_exists(deletedAt)";
  }

  const command = new QueryCommand({
    ExclusiveStartKey: startKey as Record<string, unknown> | undefined,
    ...(filterExpression && { FilterExpression: filterExpression }),
    IndexName: indexName,
    KeyConditionExpression: "#pk = :pkValue",
    ExpressionAttributeNames: {
      "#pk": indexName,
    },
    ExpressionAttributeValues: {
      ":pkValue": keyValue,
    },
    ...(limit && { Limit: limit }),
    ScanIndexForward: ascending,
    TableName: tableName,
  });

  const response = await docClient.send(command);

  return {
    items: (response.Items ?? []) as T[],
    lastEvaluatedKey: response.LastEvaluatedKey,
  };
}

/**
 * Query entities by organizational unit (parent hierarchy)
 * Uses indexOu GSI
 *
 * @param ou - The organizational unit (APEX or "{parent.model}#{parent.id}")
 * @param model - The entity model name
 * @param options - Query options
 */
export async function queryByOu<T extends FabricEntity = FabricEntity>(
  ou: string,
  model: string,
  options?: QueryOptions,
): Promise<QueryResult<T>> {
  const keyValue = buildIndexOu(ou, model);
  return executeQuery<T>(INDEX_OU, keyValue, options);
}

/**
 * Query a single entity by human-friendly alias
 * Uses indexAlias GSI
 *
 * @param ou - The organizational unit
 * @param model - The entity model name
 * @param alias - The human-friendly alias
 * @returns The matching entity or null if not found
 */
export async function queryByAlias<T extends FabricEntity = FabricEntity>(
  ou: string,
  model: string,
  alias: string,
): Promise<T | null> {
  const keyValue = buildIndexAlias(ou, model, alias);
  const result = await executeQuery<T>(INDEX_ALIAS, keyValue, { limit: 1 });
  return result.items[0] ?? null;
}

/**
 * Query entities by category classification
 * Uses indexClass GSI
 *
 * @param ou - The organizational unit
 * @param model - The entity model name
 * @param recordClass - The category classification
 * @param options - Query options
 */
export async function queryByClass<T extends FabricEntity = FabricEntity>(
  ou: string,
  model: string,
  recordClass: string,
  options?: QueryOptions,
): Promise<QueryResult<T>> {
  const keyValue = buildIndexClass(ou, model, recordClass);
  return executeQuery<T>(INDEX_CLASS, keyValue, options);
}

/**
 * Query entities by type classification
 * Uses indexType GSI
 *
 * @param ou - The organizational unit
 * @param model - The entity model name
 * @param type - The type classification
 * @param options - Query options
 */
export async function queryByType<T extends FabricEntity = FabricEntity>(
  ou: string,
  model: string,
  type: string,
  options?: QueryOptions,
): Promise<QueryResult<T>> {
  const keyValue = buildIndexType(ou, model, type);
  return executeQuery<T>(INDEX_TYPE, keyValue, options);
}

/**
 * Query a single entity by external ID
 * Uses indexXid GSI
 *
 * @param ou - The organizational unit
 * @param model - The entity model name
 * @param xid - The external ID
 * @returns The matching entity or null if not found
 */
export async function queryByXid<T extends FabricEntity = FabricEntity>(
  ou: string,
  model: string,
  xid: string,
): Promise<T | null> {
  const keyValue = buildIndexXid(ou, model, xid);
  const result = await executeQuery<T>(INDEX_XID, keyValue, { limit: 1 });
  return result.items[0] ?? null;
}
