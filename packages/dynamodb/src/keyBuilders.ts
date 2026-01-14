import {
  buildCompositeKey as fabricBuildCompositeKey,
  calculateOu as fabricCalculateOu,
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
 * Build the indexOu key for hierarchical queries
 * @param ou - The organizational unit (APEX or "{parent.model}#{parent.id}")
 * @param model - The entity model name
 * @returns Composite key: "{ou}#{model}"
 */
export function buildIndexOu(ou: string, model: string): string {
  return `${ou}${SEPARATOR}${model}`;
}

/**
 * Build the indexAlias key for human-friendly lookups
 * @param ou - The organizational unit
 * @param model - The entity model name
 * @param alias - The human-friendly alias
 * @returns Composite key: "{ou}#{model}#{alias}"
 */
export function buildIndexAlias(
  ou: string,
  model: string,
  alias: string,
): string {
  return `${ou}${SEPARATOR}${model}${SEPARATOR}${alias}`;
}

/**
 * Build the indexClass key for category filtering
 * @param ou - The organizational unit
 * @param model - The entity model name
 * @param recordClass - The category classification
 * @returns Composite key: "{ou}#{model}#{class}"
 */
export function buildIndexClass(
  ou: string,
  model: string,
  recordClass: string,
): string {
  return `${ou}${SEPARATOR}${model}${SEPARATOR}${recordClass}`;
}

/**
 * Build the indexType key for type filtering
 * @param ou - The organizational unit
 * @param model - The entity model name
 * @param type - The type classification
 * @returns Composite key: "{ou}#{model}#{type}"
 */
export function buildIndexType(
  ou: string,
  model: string,
  type: string,
): string {
  return `${ou}${SEPARATOR}${model}${SEPARATOR}${type}`;
}

/**
 * Build the indexXid key for external ID lookups
 * @param ou - The organizational unit
 * @param model - The entity model name
 * @param xid - The external ID
 * @returns Composite key: "{ou}#{model}#{xid}"
 */
export function buildIndexXid(ou: string, model: string, xid: string): string {
  return `${ou}${SEPARATOR}${model}${SEPARATOR}${xid}`;
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
 * Calculate the organizational unit from a parent reference
 * @param parent - Optional parent entity reference
 * @returns APEX ("@") if no parent, otherwise "{parent.model}#{parent.id}"
 */
export function calculateOu(parent?: ParentReference): string {
  if (!parent) {
    return APEX;
  }
  return fabricCalculateOu(parent);
}

/**
 * Auto-populate GSI index keys on an entity
 *
 * Uses the model's registered indexes (from vocabulary registry) or
 * DEFAULT_INDEXES if no custom indexes are registered.
 *
 * - indexOu is always populated from ou + model
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
