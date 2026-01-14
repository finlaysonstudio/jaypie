/**
 * Fallback Resolution Helper
 *
 * Resolves a field value with a fallback chain.
 */

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Resolve a field value with fallbacks
 *
 * @param entity - The entity to read from
 * @param field - The primary field name
 * @param fallbacks - Fallback field names in priority order
 * @returns First defined value, or undefined
 *
 * @example
 * ```typescript
 * const model = { title: undefined, name: "My Model", description: "A description" };
 * resolveWithFallback(model, "title", ["name", "description"]);
 * // Returns "My Model"
 * ```
 */
export function resolveWithFallback(
  entity: Record<string, unknown>,
  field: string,
  fallbacks: string[] = [],
): unknown {
  // Check primary field
  if (entity[field] !== undefined) {
    return entity[field];
  }

  // Check fallbacks in order
  for (const fallback of fallbacks) {
    if (entity[fallback] !== undefined) {
      return entity[fallback];
    }
  }

  return undefined;
}
