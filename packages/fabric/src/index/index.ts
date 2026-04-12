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
  DELETED_SUFFIX,
  type IndexDefinition,
  type IndexField,
  type ModelSchema,
} from "./types.js";

// =============================================================================
// Factories
// =============================================================================

export { fabricIndex } from "./fabricIndex.js";

// =============================================================================
// Key Builders
// =============================================================================

export {
  buildCompositeKey,
  calculateIndexSuffix,
  calculateScope,
  generateIndexName,
  getGsiAttributeNames,
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
