/**
 * Index Module for @jaypie/fabric
 *
 * Exports all index-related types, functions, and constants.
 */

// =============================================================================
// Types
// =============================================================================

export {
  ARCHIVED_SUFFIX,
  DEFAULT_INDEXES,
  DEFAULT_SORT_KEY,
  DELETED_SUFFIX,
  type IndexDefinition,
  type IndexField,
  type ModelSchema,
} from "./types.js";

// =============================================================================
// Key Builders
// =============================================================================

export {
  buildCompositeKey,
  calculateIndexSuffix,
  calculateOu,
  generateIndexName,
  type IndexableModel,
  populateIndexKeys,
  tryBuildCompositeKey,
} from "./keyBuilder.js";

// =============================================================================
// Registry
// =============================================================================

export {
  clearRegistry,
  getAllRegisteredIndexes,
  getModelIndexes,
  getModelSchema,
  getRegisteredModels,
  isModelRegistered,
  registerModel,
} from "./registry.js";
