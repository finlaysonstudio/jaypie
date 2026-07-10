/**
 * Model Registry for @jaypie/fabric
 *
 * Stores model schemas with their index definitions.
 * DynamoDB reads from this registry to create GSIs and select indexes for queries.
 */

import { BadRequestError, ConfigurationError } from "@jaypie/errors";

import { type IndexDefinition, type ModelSchema } from "./types.js";

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
 * @param schema - Model schema with model name and optional indexes/status
 */
export function registerModel(schema: ModelSchema): void {
  if (schema.status !== undefined) {
    if (
      !Array.isArray(schema.status) ||
      schema.status.length === 0 ||
      !schema.status.every(
        (value) => typeof value === "string" && value.length > 0,
      )
    ) {
      throw new ConfigurationError(
        `Model "${schema.model}" declared an invalid status vocabulary. Provide a non-empty array of non-empty strings.`,
      );
    }
  }
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
 * @param model - Model name to get indexes for
 * @returns Array of index definitions for the model
 * @throws ConfigurationError if the model is not registered
 */
export function getModelIndexes(model: string): IndexDefinition[] {
  const schema = MODEL_REGISTRY.get(model);
  if (!schema) {
    throw new ConfigurationError(
      `Model "${model}" is not registered. Call registerModel() before indexing or querying.`,
    );
  }
  return schema.indexes ?? [];
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
 * Get the declared `status` vocabulary for a model
 *
 * @param model - Model name to look up
 * @returns The declared status vocabulary, or undefined when the model is
 *   unregistered or declares no vocabulary (status is a free string)
 */
export function getModelStatus(model: string): string[] | undefined {
  return MODEL_REGISTRY.get(model)?.status;
}

/**
 * Check whether a value conforms to a model's declared `status` vocabulary
 *
 * A model that declares no vocabulary (unregistered or `status` omitted) treats
 * `status` as a free string, so any string value is valid.
 *
 * @param model - Model name to validate against
 * @param value - The status value to check
 * @returns true when the model declares no vocabulary, or the value is declared
 */
export function isModelStatus(model: string, value: unknown): boolean {
  const vocabulary = getModelStatus(model);
  if (vocabulary === undefined) {
    return typeof value === "string";
  }
  return typeof value === "string" && vocabulary.includes(value);
}

/**
 * Assert a value conforms to a model's declared `status` vocabulary
 *
 * @param model - Model name to validate against
 * @param status - The status value to check
 * @throws BadRequestError when the model declares a vocabulary and the value
 *   is not in it
 */
export function assertModelStatus(model: string, status: unknown): void {
  const vocabulary = getModelStatus(model);
  if (vocabulary === undefined) {
    return;
  }
  if (typeof status !== "string" || !vocabulary.includes(status)) {
    throw new BadRequestError(
      `Status "${String(status)}" is not in the declared vocabulary for model "${model}": ${vocabulary.join(", ")}.`,
    );
  }
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
