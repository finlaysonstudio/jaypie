import { APEX, SEPARATOR } from "./constants.js";
import type { FabricEntity, ParentReference } from "./types.js";

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

/**
 * Calculate the organizational unit from a parent reference
 * @param parent - Optional parent entity reference
 * @returns APEX ("@") if no parent, otherwise "{parent.model}#{parent.id}"
 */
export function calculateOu(parent?: ParentReference): string {
  if (!parent) {
    return APEX;
  }
  return `${parent.model}${SEPARATOR}${parent.id}`;
}

/**
 * Auto-populate GSI index keys on an entity
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
export function indexEntity<T extends FabricEntity>(
  entity: T,
  suffix: string = "",
): T {
  const result = { ...entity };

  // indexOu is always set (from ou + model)
  result.indexOu = buildIndexOu(entity.ou, entity.model) + suffix;

  // Optional indexes - only set when the source field is present
  if (entity.alias !== undefined) {
    result.indexAlias =
      buildIndexAlias(entity.ou, entity.model, entity.alias) + suffix;
  }

  if (entity.class !== undefined) {
    result.indexClass =
      buildIndexClass(entity.ou, entity.model, entity.class) + suffix;
  }

  if (entity.type !== undefined) {
    result.indexType =
      buildIndexType(entity.ou, entity.model, entity.type) + suffix;
  }

  if (entity.xid !== undefined) {
    result.indexXid =
      buildIndexXid(entity.ou, entity.model, entity.xid) + suffix;
  }

  return result;
}
