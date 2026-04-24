import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ConfigurationError } from "@jaypie/errors";
import {
  fabricService,
  getGsiAttributeNames,
  getModelIndexes,
  type IndexDefinition,
  SEPARATOR,
} from "@jaypie/fabric";

import { getDocClient, getTableName } from "./client.js";
import { ARCHIVED_SUFFIX, DELETED_SUFFIX } from "./constants.js";
import { buildCompositeKey } from "./keyBuilders.js";
import type {
  QueryByAliasParams,
  QueryByCategoryParams,
  QueryByScopeParams,
  QueryByTypeParams,
  QueryByXidParams,
  QueryResult,
  StorableEntity,
} from "./types.js";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Calculate the suffix for the GSI partition key based on archived/deleted
 * flags. Suffix stays on pk so deleted/archived entities are queried as their
 * own partition (active queries skip them naturally).
 */
function calculateSuffix({
  archived,
  deleted,
}: {
  archived?: boolean;
  deleted?: boolean;
}): string {
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
 * Find the registered index for a model that matches a given partition-key
 * shape. The matching index is the first one whose pk equals the expected
 * fields. Throws ConfigurationError if no match is found.
 */
function requireIndex(model: string, pkFields: string[]): IndexDefinition {
  const indexes = getModelIndexes(model);
  const match = indexes.find(
    (index) =>
      index.pk.length === pkFields.length &&
      index.pk.every((field, i) => field === pkFields[i]),
  );
  if (!match) {
    throw new ConfigurationError(
      `Model "${model}" has no index with pk=[${pkFields.join(", ")}]. ` +
        `Register one with fabricIndex(${
          pkFields.length > 1 ? `"${pkFields[1]}"` : ""
        }).`,
    );
  }
  return match;
}

/**
 * Execute a GSI query.
 *
 * - pk: exact match on the index partition key
 * - skPrefix: optional begins_with on the index sort key (used when the index
 *   has a composite sk like [scope, updatedAt])
 */
async function executeQuery<T extends StorableEntity>(
  index: IndexDefinition,
  pkValue: string,
  options: {
    ascending?: boolean;
    limit?: number;
    skPrefix?: string;
    startKey?: Record<string, unknown>;
  } = {},
): Promise<QueryResult<T>> {
  const { ascending = false, limit, skPrefix, startKey } = options;
  const attrs = getGsiAttributeNames(index);
  const indexName = attrs.pk;

  const expressionAttributeNames: Record<string, string> = {
    "#pk": indexName,
  };
  const expressionAttributeValues: Record<string, unknown> = {
    ":pkValue": pkValue,
  };
  let keyConditionExpression = "#pk = :pkValue";

  if (skPrefix !== undefined && attrs.sk) {
    expressionAttributeNames["#sk"] = attrs.sk;
    expressionAttributeValues[":skPrefix"] = skPrefix;
    keyConditionExpression += " AND begins_with(#sk, :skPrefix)";
  }

  const docClient = getDocClient();
  const tableName = getTableName();

  const command = new QueryCommand({
    ExclusiveStartKey: startKey as Record<string, unknown> | undefined,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    IndexName: indexName,
    KeyConditionExpression: keyConditionExpression,
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

function scopePrefix(scope: string | undefined): string | undefined {
  return scope === undefined ? undefined : `${scope}${SEPARATOR}`;
}

// =============================================================================
// Query Functions
// =============================================================================

/**
 * List entities of a model, optionally narrowed to a scope.
 * Requires the model to register `fabricIndex()` (pk=[model]).
 */
export async function queryByScope({
  archived = false,
  ascending = false,
  deleted = false,
  limit,
  model,
  scope,
  startKey,
}: QueryByScopeParams): Promise<QueryResult<StorableEntity>> {
  const index = requireIndex(model, ["model"]);
  const suffix = calculateSuffix({ archived, deleted });
  const pkValue = buildCompositeKey({ model }, ["model"], suffix);
  return executeQuery<StorableEntity>(index, pkValue, {
    ascending,
    limit,
    skPrefix: scopePrefix(scope),
    startKey,
  });
}

/**
 * Query a single entity by human-friendly alias.
 * Requires the model to register `fabricIndex("alias")`.
 */
export const queryByAlias = fabricService({
  alias: "queryByAlias",
  description: "Query a single entity by human-friendly alias",
  input: {
    alias: { type: String, description: "Human-friendly alias" },
    archived: {
      type: Boolean,
      default: false,
      required: false,
      description: "Query archived entities instead of active ones",
    },
    deleted: {
      type: Boolean,
      default: false,
      required: false,
      description: "Query deleted entities instead of active ones",
    },
    model: { type: String, description: "Entity model name" },
    scope: {
      type: String,
      required: false,
      description: "Optional scope narrower (begins_with on sk)",
    },
  },
  service: async ({
    alias,
    archived,
    deleted,
    model,
    scope,
  }): Promise<StorableEntity | null> => {
    const aliasStr = alias as string;
    const archivedBool = archived as boolean | undefined;
    const deletedBool = deleted as boolean | undefined;
    const modelStr = model as string;
    const scopeStr = scope as string | undefined;

    const index = requireIndex(modelStr, ["model", "alias"]);
    const suffix = calculateSuffix({
      archived: archivedBool,
      deleted: deletedBool,
    });
    const pkValue = buildCompositeKey(
      { model: modelStr, alias: aliasStr },
      ["model", "alias"],
      suffix,
    );
    const result = await executeQuery<StorableEntity>(index, pkValue, {
      limit: 1,
      skPrefix: scopePrefix(scopeStr),
    });
    return result.items[0] ?? null;
  },
});

/**
 * Query entities by category classification.
 * Requires the model to register `fabricIndex("category")`.
 */
export async function queryByCategory({
  archived = false,
  ascending = false,
  category,
  deleted = false,
  limit,
  model,
  scope,
  startKey,
}: QueryByCategoryParams): Promise<QueryResult<StorableEntity>> {
  const index = requireIndex(model, ["model", "category"]);
  const suffix = calculateSuffix({ archived, deleted });
  const pkValue = buildCompositeKey(
    { model, category },
    ["model", "category"],
    suffix,
  );
  return executeQuery<StorableEntity>(index, pkValue, {
    ascending,
    limit,
    skPrefix: scopePrefix(scope),
    startKey,
  });
}

/**
 * Query entities by type classification.
 * Requires the model to register `fabricIndex("type")`.
 */
export async function queryByType({
  archived = false,
  ascending = false,
  deleted = false,
  limit,
  model,
  scope,
  startKey,
  type,
}: QueryByTypeParams): Promise<QueryResult<StorableEntity>> {
  const index = requireIndex(model, ["model", "type"]);
  const suffix = calculateSuffix({ archived, deleted });
  const pkValue = buildCompositeKey({ model, type }, ["model", "type"], suffix);
  return executeQuery<StorableEntity>(index, pkValue, {
    ascending,
    limit,
    skPrefix: scopePrefix(scope),
    startKey,
  });
}

/**
 * Query a single entity by external ID.
 * Requires the model to register `fabricIndex("xid")`.
 */
export const queryByXid = fabricService({
  alias: "queryByXid",
  description: "Query a single entity by external ID",
  input: {
    archived: {
      type: Boolean,
      default: false,
      required: false,
      description: "Query archived entities instead of active ones",
    },
    deleted: {
      type: Boolean,
      default: false,
      required: false,
      description: "Query deleted entities instead of active ones",
    },
    model: { type: String, description: "Entity model name" },
    scope: {
      type: String,
      required: false,
      description: "Optional scope narrower (begins_with on sk)",
    },
    xid: { type: String, description: "External ID" },
  },
  service: async ({
    archived,
    deleted,
    model,
    scope,
    xid,
  }): Promise<StorableEntity | null> => {
    const archivedBool = archived as boolean | undefined;
    const deletedBool = deleted as boolean | undefined;
    const modelStr = model as string;
    const scopeStr = scope as string | undefined;
    const xidStr = xid as string;

    const index = requireIndex(modelStr, ["model", "xid"]);
    const suffix = calculateSuffix({
      archived: archivedBool,
      deleted: deletedBool,
    });
    const pkValue = buildCompositeKey(
      { model: modelStr, xid: xidStr },
      ["model", "xid"],
      suffix,
    );
    const result = await executeQuery<StorableEntity>(index, pkValue, {
      limit: 1,
      skPrefix: scopePrefix(scopeStr),
    });
    return result.items[0] ?? null;
  },
});

// Internal exports for the unified query() layer
export { executeQuery, requireIndex, calculateSuffix, scopePrefix };
