/**
 * Resolved Name Helper
 *
 * Computes a resolved name from entity fields using a priority chain.
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Entity with optional name fields
 */
export interface ResolvedNameEntity {
  abbreviation?: string;
  alias?: string;
  description?: string;
  name?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Compute resolved name from entity fields
 *
 * Priority: name > alias > abbreviation > description
 * Result is lowercase for consistent sorting/indexing
 *
 * @param entity - The entity to compute the resolved name from
 * @returns The resolved name (lowercase) or undefined if no name fields exist
 */
export function computeResolvedName(
  entity: ResolvedNameEntity,
): string | undefined {
  const value =
    entity.name || entity.alias || entity.abbreviation || entity.description;
  return value?.toLowerCase();
}
