/**
 * Field Categories - Semantic classification of fields
 *
 * Categories define the semantic boundary of fields within models.
 */

// =============================================================================
// Constants
// =============================================================================

/** Field categories defining semantic boundaries */
export const FIELD_CATEGORIES = [
  "identity",
  "input",
  "metadata",
  "state",
] as const;

// =============================================================================
// Types
// =============================================================================

/**
 * Field category - semantic classification of fields
 *
 * - identity: What the entity IS (immutable) - id, model, ou
 * - metadata: What the entity is ABOUT (usually immutable) - alias, xid, class, type
 * - state: What the entity TRACKS (mutable) - content, status, progress
 * - input: Request parameters (transient) - data, params, options
 */
export type FieldCategory = (typeof FIELD_CATEGORIES)[number];

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a string is a valid field category
 */
export function isFieldCategory(value: unknown): value is FieldCategory {
  return (
    typeof value === "string" &&
    FIELD_CATEGORIES.includes(value as FieldCategory)
  );
}
