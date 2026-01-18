/**
 * Model Registry for @jaypie/fabric
 *
 * Stores model schemas with their index definitions.
 * DynamoDB reads from this registry to create GSIs and select indexes for queries.
 */

import {
  DEFAULT_INDEXES,
  type IndexDefinition,
  type ModelSchema,
} from "./types.js";

// =============================================================================
// Registry
// =============================================================================

/**
 * Global model registry - maps model names to their schemas
 */
const MODEL_REGISTRY = new Map<string, ModelSchema>();

// =============================================================================
// Functions
// =============================================================================

/**
 * Register a model schema with its index definitions
 *
 * @param schema - Model schema with model name and optional indexes
 */
export function registerModel(schema: ModelSchema): void {
  MODEL_REGISTRY.set(schema.model, schema);
}

/**
 * Get a model schema by name
 *
 * @param model - Model name to look up
 * @returns Model schema or undefined if not registered
 */
export function getModelSchema(model: string): ModelSchema | undefined {
  return MODEL_REGISTRY.get(model);
}

/**
 * Get index definitions for a model
 *
 * Returns the model's custom indexes if registered,
 * otherwise returns DEFAULT_INDEXES.
 *
 * @param model - Model name to get indexes for
 * @returns Array of index definitions
 */
export function getModelIndexes(model: string): IndexDefinition[] {
  const schema = MODEL_REGISTRY.get(model);
  return schema?.indexes ?? DEFAULT_INDEXES;
}

/**
 * Get all registered models
 *
 * @returns Array of model names
 */
export function getRegisteredModels(): string[] {
  return Array.from(MODEL_REGISTRY.keys());
}

/**
 * Get all unique indexes across all registered models
 *
 * Used by createTable to collect all GSIs that need to be created.
 * Deduplicates by index name.
 *
 * @returns Array of unique index definitions
 */
export function getAllRegisteredIndexes(): IndexDefinition[] {
  const indexMap = new Map<string, IndexDefinition>();

  // Collect indexes from all registered models
  for (const schema of MODEL_REGISTRY.values()) {
    const indexes = schema.indexes ?? [];
    for (const index of indexes) {
      const name = index.name ?? generateIndexNameFromPk(index.pk);
      if (!indexMap.has(name)) {
        indexMap.set(name, { ...index, name });
      }
    }
  }

  return Array.from(indexMap.values());
}

/**
 * Check if a model is registered
 *
 * @param model - Model name to check
 * @returns true if model is registered
 */
export function isModelRegistered(model: string): boolean {
  return MODEL_REGISTRY.has(model);
}

/**
 * Clear the model registry (for testing)
 */
export function clearRegistry(): void {
  MODEL_REGISTRY.clear();
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Generate an index name from pk fields (used when index.name is not set)
 */
function generateIndexNameFromPk(pk: string[]): string {
  const suffix = pk
    .map((field) => {
      const str = String(field);
      return str.charAt(0).toUpperCase() + str.slice(1);
    })
    .join("");
  return `index${suffix}`;
}
