import {
  buildCompositeKey as fabricBuildCompositeKey,
  calculateScope as fabricCalculateScope,
  getModelIndexes,
  type IndexableModel,
  populateIndexKeys as fabricPopulateIndexKeys,
} from "@jaypie/fabric";

import { APEX } from "./constants.js";
import type { ParentReference, StorableEntity } from "./types.js";

// =============================================================================
// Key Builders
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
 * Auto-populate GSI index keys on an entity and advance its write timestamps.
 *
 * - Bumps `updatedAt` to now on every call.
 * - Backfills `createdAt` to the same now if not already set.
 * - Populates GSI attributes (pk composite and sk composite when applicable)
 *   using the indexes registered for the entity's model.
 *
 * Callers (createEntity, updateEntity, deleteEntity, archiveEntity,
 * transactWriteEntities) go through this one function so `updatedAt` is
 * always fresh and never forgotten.
 *
 * @param entity - The entity to index
 * @param suffix - Optional suffix override (defaults to archived/deleted state)
 * @returns A new entity with timestamps bumped and index keys populated
 */
export function indexEntity<T extends StorableEntity>(
  entity: T,
  suffix?: string,
): T {
  const now = new Date().toISOString();
  const bumped = {
    ...entity,
    createdAt: entity.createdAt ?? now,
    updatedAt: now,
  } as T;

  const indexes = getModelIndexes(entity.model);
  return fabricPopulateIndexKeys(
    bumped as unknown as IndexableModel,
    indexes,
    suffix,
  ) as unknown as T;
}
