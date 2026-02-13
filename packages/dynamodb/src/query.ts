/**
 * Unified Query Function with Auto-Detect Index Selection
 *
 * The query() function automatically selects the best index based on
 * the filter fields provided. This simplifies query construction by
 * removing the need to know which specific GSI to use.
 */

import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ConfigurationError } from "@jaypie/errors";
import {
  getModelIndexes,
  type IndexDefinition,
} from "@jaypie/fabric";

import { getDocClient, getTableName } from "./client.js";
import { ARCHIVED_SUFFIX, DELETED_SUFFIX } from "./constants.js";
import { buildCompositeKey } from "./keyBuilders.js";
import type { QueryResult, StorableEntity } from "./types.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Query parameters for the unified query function
 */
export interface QueryParams<T = StorableEntity> {
  /** Whether to query archived entities instead of active ones */
  archived?: boolean;
  /** Whether to sort ascending (oldest first). Default: false */
  ascending?: boolean;
  /** Whether to query deleted entities instead of active ones */
  deleted?: boolean;
  /** Filter object with field values to match. Used for index auto-detection. */
  filter?: Partial<T>;
  /** Maximum number of items to return */
  limit?: number;
  /** Model name (required) */
  model: string;
  /** Scope (APEX or "{parent.model}#{parent.id}") */
  scope?: string;
  /** Pagination cursor from previous query */
  startKey?: Record<string, unknown>;
}

/**
 * Score for an index based on filter field matching
 */
interface IndexScore {
  index: IndexDefinition;
  /** Whether all pk fields are present in the filter */
  pkComplete: boolean;
  /** Number of pk fields matched */
  matchedFields: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate the suffix based on archived/deleted flags
 */
function calculateSuffix(archived?: boolean, deleted?: boolean): string {
  if (archived && deleted) {
    return ARCHIVED_SUFFIX + DELETED_SUFFIX;
  }
  if (archived) {
    return ARCHIVED_SUFFIX;
  }
  if (deleted) {
    return DELETED_SUFFIX;
  }
  return "";
}

/**
 * Build a combined filter object from params
 */
function buildFilterObject<T>(params: QueryParams<T>): Record<string, unknown> {
  const result: Record<string, unknown> = {
    model: params.model,
  };

  if (params.scope !== undefined) {
    result.scope = params.scope;
  }

  if (params.filter) {
    Object.assign(result, params.filter);
  }

  return result;
}

/**
 * Score an index based on how well it matches the filter fields
 */
function scoreIndex(
  index: IndexDefinition,
  filterFields: Record<string, unknown>,
): IndexScore {
  let matchedFields = 0;
  let pkComplete = true;

  for (const field of index.pk) {
    if (filterFields[field] !== undefined) {
      matchedFields++;
    } else {
      pkComplete = false;
    }
  }

  return {
    index,
    matchedFields,
    pkComplete,
  };
}

/**
 * Select the best index for the given filter
 *
 * Scoring criteria:
 * 1. Index must have all pk fields present (pkComplete)
 * 2. Prefer indexes with more matched fields
 * 3. Prefer more specific indexes (more pk fields)
 */
function selectBestIndex(
  indexes: IndexDefinition[],
  filterFields: Record<string, unknown>,
): IndexDefinition {
  const scores = indexes.map((index) => scoreIndex(index, filterFields));

  // Filter to only complete matches
  const completeMatches = scores.filter((s) => s.pkComplete);

  if (completeMatches.length === 0) {
    const availableIndexes = indexes
      .map((i) => i.name ?? `[${i.pk.join(", ")}]`)
      .join(", ");
    const providedFields = Object.keys(filterFields).join(", ");
    throw new ConfigurationError(
      `No index matches filter fields. ` +
        `Provided: ${providedFields}. ` +
        `Available indexes: ${availableIndexes}`,
    );
  }

  // Sort by:
  // 1. More matched fields first (descending)
  // 2. More pk fields (more specific) first (descending)
  completeMatches.sort((a, b) => {
    const fieldDiff = b.matchedFields - a.matchedFields;
    if (fieldDiff !== 0) return fieldDiff;
    return b.index.pk.length - a.index.pk.length;
  });

  return completeMatches[0].index;
}

// =============================================================================
// Main Query Function
// =============================================================================

/**
 * Query entities with automatic index selection
 *
 * The query function automatically selects the best GSI based on
 * the filter fields provided. This removes the need to know which
 * specific query function (queryByOu, queryByAlias, etc.) to use.
 *
 * @example
 * // Uses indexScope (pk: ["scope", "model"])
 * const allMessages = await query({ model: "message", scope: `chat#${chatId}` });
 *
 * @example
 * // Uses indexAlias (pk: ["scope", "model", "alias"])
 * const byAlias = await query({
 *   model: "record",
 *   scope: "@",
 *   filter: { alias: "my-record" },
 * });
 *
 * @example
 * // Uses a custom registered index if model has one
 * const byChat = await query({
 *   model: "message",
 *   filter: { chatId: "abc-123" },
 * });
 */
export async function query<T extends StorableEntity = StorableEntity>(
  params: QueryParams<T>,
): Promise<QueryResult<T>> {
  const {
    archived = false,
    ascending = false,
    deleted = false,
    limit,
    model,
    startKey,
  } = params;

  // Build the combined filter object
  const filterFields = buildFilterObject(params);

  // Get indexes for this model
  const indexes = getModelIndexes(model);

  // Select the best matching index
  const selectedIndex = selectBestIndex(indexes, filterFields);
  const indexName = selectedIndex.name ?? generateIndexName(selectedIndex.pk);

  // Build the partition key value
  const suffix = calculateSuffix(archived, deleted);
  const keyValue = buildCompositeKey(
    filterFields as Record<string, unknown> & { model: string },
    selectedIndex.pk as string[],
    suffix,
  );

  // Execute the query
  const docClient = getDocClient();
  const tableName = getTableName();

  const command = new QueryCommand({
    ExclusiveStartKey: startKey as Record<string, unknown> | undefined,
    ExpressionAttributeNames: {
      "#pk": indexName,
    },
    ExpressionAttributeValues: {
      ":pkValue": keyValue,
    },
    IndexName: indexName,
    KeyConditionExpression: "#pk = :pkValue",
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
 * Generate an index name from pk fields
 */
function generateIndexName(pk: string[]): string {
  const suffix = pk
    .map((field) => field.charAt(0).toUpperCase() + field.slice(1))
    .join("");
  return `index${suffix}`;
}

// Re-export for convenience
export { getModelIndexes };
