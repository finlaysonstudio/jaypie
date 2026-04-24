/**
 * Unified Query Function with Auto-Detect Index Selection
 *
 * The query() function automatically selects the best index based on
 * the filter fields provided. This simplifies query construction by
 * removing the need to know which specific GSI to use.
 */

import { ConfigurationError } from "@jaypie/errors";
import { getModelIndexes, type IndexDefinition } from "@jaypie/fabric";

import { buildCompositeKey } from "./keyBuilders.js";
import { calculateSuffix, executeQuery, scopePrefix } from "./queries.js";
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
  /**
   * Filter object with field values to match. Used for index auto-detection
   * — the picker scores indexes by how many pk fields (after `model`) are
   * present in this filter.
   */
  filter?: Partial<T>;
  /** Maximum number of items to return */
  limit?: number;
  /** Model name (required) */
  model: string;
  /**
   * Optional scope narrower. Applied as `begins_with` on the GSI sort key
   * (composite scope + updatedAt). Omit to list across all scopes.
   */
  scope?: string;
  /** Pagination cursor from previous query */
  startKey?: Record<string, unknown>;
}

// =============================================================================
// Index Selection
// =============================================================================

/**
 * Select the best index for the given filter.
 *
 * Every model-level index has `model` as its first pk field. The picker
 * prefers the most specific index whose remaining pk fields are all
 * satisfied by the filter.
 */
function selectBestIndex(
  indexes: IndexDefinition[],
  filter: Record<string, unknown>,
): IndexDefinition {
  // Candidates: indexes whose pk starts with "model" and whose remaining
  // fields are all present in the filter.
  const candidates = indexes.filter((index) => {
    if (index.pk.length === 0 || index.pk[0] !== "model") return false;
    for (let i = 1; i < index.pk.length; i++) {
      if (filter[index.pk[i] as string] === undefined) return false;
    }
    return true;
  });

  if (candidates.length === 0) {
    const available = indexes.map((i) => `[${i.pk.join(", ")}]`).join(", ");
    const provided = Object.keys(filter).join(", ") || "(none)";
    throw new ConfigurationError(
      `No index matches filter for model. ` +
        `Filter fields: ${provided}. Available indexes: ${available}`,
    );
  }

  // Prefer the most specific index (longest pk).
  candidates.sort((a, b) => b.pk.length - a.pk.length);
  return candidates[0];
}

// =============================================================================
// Main Query Function
// =============================================================================

/**
 * Query entities with automatic index selection.
 *
 * @example
 *   // Uses indexModel (pk: ["model"]), optionally narrowed by scope
 *   const records = await query({ model: "record", scope: "@" });
 *
 * @example
 *   // Uses indexModelAlias (pk: ["model", "alias"])
 *   const byAlias = await query({
 *     model: "record",
 *     scope: "@",
 *     filter: { alias: "my-record" },
 *   });
 *
 * @example
 *   // Cross-scope listing (no scope narrower)
 *   const all = await query({ model: "record" });
 */
export async function query<T extends StorableEntity = StorableEntity>(
  params: QueryParams<T>,
): Promise<QueryResult<T>> {
  const {
    archived = false,
    ascending = false,
    deleted = false,
    filter,
    limit,
    model,
    scope,
    startKey,
  } = params;

  const indexes = getModelIndexes(model);
  const filterFields: Record<string, unknown> = {
    model,
    ...(filter as Record<string, unknown> | undefined),
  };
  const selectedIndex = selectBestIndex(indexes, filterFields);

  const suffix = calculateSuffix({ archived, deleted });
  const pkValue = buildCompositeKey(
    filterFields as Record<string, unknown> & { model: string },
    selectedIndex.pk as string[],
    suffix,
  );

  return executeQuery<T>(selectedIndex, pkValue, {
    ascending,
    limit,
    skPrefix: scopePrefix(scope),
    startKey,
  });
}

// Re-export for convenience
export { getModelIndexes };
