/**
 * Resolved Name Helper
 *
 * Computes a resolved name from model fields using a priority chain.
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Model with optional name fields
 */
export interface ResolvedNameModel {
  abbreviation?: string;
  alias?: string;
  description?: string;
  name?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Compute resolved name from model fields
 *
 * Priority: name > alias > abbreviation > description
 * Result is lowercase for consistent sorting/indexing
 *
 * @param model - The model to compute the resolved name from
 * @returns The resolved name (lowercase) or undefined if no name fields exist
 */
export function computeResolvedName(
  model: ResolvedNameModel,
): string | undefined {
  const value =
    model.name || model.alias || model.abbreviation || model.description;
  return value?.toLowerCase();
}
