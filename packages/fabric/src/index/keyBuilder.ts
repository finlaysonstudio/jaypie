/**
 * Key Builder for @jaypie/fabric
 *
 * Builds composite keys from model fields and index definitions.
 */

import { ConfigurationError } from "@jaypie/errors";

import { SEPARATOR } from "../constants.js";

import {
  ARCHIVED_SUFFIX,
  DELETED_SUFFIX,
  type IndexDefinition,
  type IndexField,
} from "./types.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Model with fields for indexing.
 *
 * Does not extend FabricModel to allow flexibility with timestamp types
 * (DynamoDB uses string timestamps, FabricModel uses Date objects).
 */
export interface IndexableModel {
  /** Schema reference (required for indexing) */
  model: string;
  /** Scope (optional) */
  scope?: string;
  /** Chronological ordering timestamp (optional) */
  sequence?: number;
  /** Archived timestamp - presence triggers #archived suffix */
  archivedAt?: Date | string | null;
  /** Deleted timestamp - presence triggers #deleted suffix */
  deletedAt?: Date | string | null;
  /** Allow any additional fields */
  [key: string]: unknown;
}

// =============================================================================
// Key Builders
// =============================================================================

/**
 * Build a composite key from model fields
 *
 * @param model - Model with fields to extract
 * @param fields - Field names to combine
 * @param suffix - Optional suffix to append (e.g., "#deleted")
 * @returns Composite key string (e.g., "@#record#my-alias")
 * @throws ConfigurationError if a required field is missing
 */
export function buildCompositeKey(
  model: IndexableModel,
  fields: IndexField[],
  suffix?: string,
): string {
  const parts = fields.map((field) => {
    const value = model[field as keyof typeof model];
    if (value === undefined || value === null) {
      throw new ConfigurationError(`Missing field for index key: ${field}`);
    }
    return String(value);
  });

  const key = parts.join(SEPARATOR);
  return suffix ? key + suffix : key;
}

/**
 * Try to build a composite key, returning undefined if fields are missing
 *
 * @param model - Model with fields to extract
 * @param fields - Field names to combine
 * @param suffix - Optional suffix to append
 * @returns Composite key string or undefined if fields missing
 */
export function tryBuildCompositeKey(
  model: IndexableModel,
  fields: IndexField[],
  suffix?: string,
): string | undefined {
  for (const field of fields) {
    const value = model[field as keyof typeof model];
    if (value === undefined || value === null) {
      return undefined;
    }
  }
  return buildCompositeKey(model, fields, suffix);
}

/**
 * Generate an index name from partition key fields
 *
 * @param pk - Partition key field names
 * @returns Generated index name (e.g., "indexOuModelAlias")
 */
export function generateIndexName(pk: IndexField[]): string {
  const suffix = pk
    .map((field) => {
      const str = String(field);
      return str.charAt(0).toUpperCase() + str.slice(1);
    })
    .join("");
  return `index${suffix}`;
}

/**
 * Calculate the suffix for index keys based on model state
 *
 * @param model - Model to check for archived/deleted state
 * @returns Suffix string (e.g., "", "#archived", "#deleted", "#archived#deleted")
 */
export function calculateIndexSuffix(model: IndexableModel): string {
  let suffix = "";
  if (model.archivedAt !== undefined && model.archivedAt !== null) {
    suffix += ARCHIVED_SUFFIX;
  }
  if (model.deletedAt !== undefined && model.deletedAt !== null) {
    suffix += DELETED_SUFFIX;
  }
  return suffix;
}

/**
 * Get GSI attribute names for an index definition
 *
 * Single source of truth for the attribute names that `populateIndexKeys`
 * writes and that GSI provisioning references.
 *
 * - `pk` is always the index name
 * - `sk` is the single sk field name when `sk.length === 1`, or
 *   `{indexName}Sk` when `sk.length > 1` (composite sk attribute)
 */
export function getGsiAttributeNames(index: IndexDefinition): {
  pk: string;
  sk: string | undefined;
} {
  const name = index.name ?? generateIndexName(index.pk);
  let sk: string | undefined;
  if (index.sk && index.sk.length > 1) {
    sk = `${name}Sk`;
  } else if (index.sk && index.sk.length === 1) {
    sk = String(index.sk[0]);
  }
  return { pk: name, sk };
}

/**
 * Populate index keys on a model based on index definitions
 *
 * For each index:
 * - The partition key composite is stored on the model under the index name,
 *   with the archived/deleted suffix appended (e.g., `indexModel = "record#deleted"`).
 * - When `sk.length > 1`, a sort key composite is also stored under
 *   `{indexName}Sk` (no suffix — the suffix lives only on pk).
 * - When `sk.length <= 1`, no sk attribute is written; the GSI references the
 *   single sk field (e.g., `updatedAt`, `sequence`) as a plain attribute.
 *
 * Sparse behavior: if any pk or sk field is missing, the corresponding
 * composite is skipped (not written). The `sparse` flag is advisory for
 * provisioning — this function always behaves sparsely at write time.
 *
 * @param model - Model to populate index keys on
 * @param indexes - Index definitions to use
 * @param suffix - Optional suffix override (defaults to archived/deleted state)
 * @returns Model with index keys populated
 */
export function populateIndexKeys<T extends IndexableModel>(
  model: T,
  indexes: IndexDefinition[],
  suffix?: string,
): T {
  const result = { ...model };
  const appliedSuffix = suffix ?? calculateIndexSuffix(model);

  for (const index of indexes) {
    const { pk: pkKey, sk: skKey } = getGsiAttributeNames(index);

    const pkValue = tryBuildCompositeKey(model, index.pk, appliedSuffix);
    if (pkValue !== undefined) {
      (result as Record<string, unknown>)[pkKey] = pkValue;
    }

    if (index.sk && index.sk.length > 1 && skKey) {
      const skValue = tryBuildCompositeKey(model, index.sk);
      if (skValue !== undefined) {
        (result as Record<string, unknown>)[skKey] = skValue;
      }
    }
  }

  return result;
}

/**
 * Calculate scope from parent reference
 *
 * @param parent - Parent model with model and id
 * @returns Scope string ("{parent.model}#{parent.id}") or APEX ("@") if no parent
 */
export function calculateScope(parent?: { id: string; model: string }): string {
  if (!parent) {
    return "@"; // APEX
  }
  return `${parent.model}${SEPARATOR}${parent.id}`;
}
