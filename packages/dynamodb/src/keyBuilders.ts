import {
  buildCompositeKey as fabricBuildCompositeKey,
  calculateScope as fabricCalculateScope,
  DEFAULT_INDEXES,
  getModelIndexes,
  type IndexableModel,
  populateIndexKeys as fabricPopulateIndexKeys,
} from "@jaypie/fabric";

import { APEX, SEPARATOR } from "./constants.js";
import type { ParentReference, StorableEntity } from "./types.js";

// =============================================================================
// Key Builders
// =============================================================================

/**
 * Build the indexScope key for hierarchical queries
 * @param scope - The scope (APEX or "{parent.model}#{parent.id}")
 * @param model - The entity model name
 * @returns Composite key: "{scope}#{model}"
 */
export function buildIndexScope(scope: string, model: string): string {
  return `${scope}${SEPARATOR}${model}`;
}

/**
 * Build the indexAlias key for human-friendly lookups
 * @param scope - The scope
 * @param model - The entity model name
 * @param alias - The human-friendly alias
 * @returns Composite key: "{scope}#{model}#{alias}"
 */
export function buildIndexAlias(
  scope: string,
  model: string,
  alias: string,
): string {
  return `${scope}${SEPARATOR}${model}${SEPARATOR}${alias}`;
}

/**
 * Build the indexClass key for category filtering
 * @param scope - The scope
 * @param model - The entity model name
 * @param recordClass - The category classification
 * @returns Composite key: "{scope}#{model}#{class}"
 */
export function buildIndexClass(
  scope: string,
  model: string,
  recordClass: string,
): string {
  return `${scope}${SEPARATOR}${model}${SEPARATOR}${recordClass}`;
}

/**
 * Build the indexType key for type filtering
 * @param scope - The scope
 * @param model - The entity model name
 * @param type - The type classification
 * @returns Composite key: "{scope}#{model}#{type}"
 */
export function buildIndexType(
  scope: string,
  model: string,
  type: string,
): string {
  return `${scope}${SEPARATOR}${model}${SEPARATOR}${type}`;
}

/**
 * Build the indexXid key for external ID lookups
 * @param scope - The scope
 * @param model - The entity model name
 * @param xid - The external ID
 * @returns Composite key: "{scope}#{model}#{xid}"
 */
export function buildIndexXid(scope: string, model: string, xid: string): string {
  return `${scope}${SEPARATOR}${model}${SEPARATOR}${xid}`;
}

// =============================================================================
// New Vocabulary-Based Functions
// =============================================================================

/**
 * Build a composite key from entity fields
 *
 * @param entity - Entity with fields to extract
 * @param fields - Field names to combine with SEPARATOR
 * @param suffix - Optional suffix to append (e.g., "#deleted")
 * @returns Composite key string
 */
export function buildCompositeKey(
  entity: IndexableModel,
  fields: string[],
  suffix?: string,
): string {
  return fabricBuildCompositeKey(entity, fields, suffix);
}

/**
 * Calculate the scope from a parent reference
 * @param parent - Optional parent entity reference
 * @returns APEX ("@") if no parent, otherwise "{parent.model}#{parent.id}"
 */
export function calculateScope(parent?: ParentReference): string {
  if (!parent) {
    return APEX;
  }
  return fabricCalculateScope(parent);
}

/**
 * Auto-populate GSI index keys on an entity
 *
 * Uses the model's registered indexes (from vocabulary registry) or
 * DEFAULT_INDEXES if no custom indexes are registered.
 *
 * - indexScope is always populated from scope + model
 * - indexAlias is populated only when alias is present
 * - indexClass is populated only when class is present
 * - indexType is populated only when type is present
 * - indexXid is populated only when xid is present
 *
 * @param entity - The entity to populate index keys for
 * @param suffix - Optional suffix to append to all index keys (e.g., "#deleted", "#archived")
 * @returns The entity with populated index keys
 */
export function indexEntity<T extends StorableEntity>(
  entity: T,
  suffix: string = "",
): T {
  const indexes = getModelIndexes(entity.model);
  // Cast through unknown to bridge the type gap between StorableEntity and IndexableModel
  return fabricPopulateIndexKeys(
    entity as unknown as IndexableModel,
    indexes,
    suffix,
  ) as unknown as T;
}

// Re-export DEFAULT_INDEXES for convenience
export { DEFAULT_INDEXES };
