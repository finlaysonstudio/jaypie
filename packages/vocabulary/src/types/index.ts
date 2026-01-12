// @jaypie/vocabulary - Types
// Re-exports all types from the types folder

// Elementary Types
export {
  BOOLEAN_TYPE,
  DATE_TYPE,
  DATETIME_TYPE,
  DOLLARS_TYPE,
  ELEMENTARY_TYPE_REGISTRY,
  ELEMENTARY_TYPES,
  getAllElementaryTypes,
  getElementaryType,
  isElementaryType,
  MULTISELECT_TYPE,
  NUMBER_TYPE,
  REFERENCE_TYPE,
  SELECT_TYPE,
  TEXT_TYPE,
  TEXTAREA_TYPE,
} from "./elementaryTypes.js";
export type {
  ElementaryType,
  ElementaryTypeDefinition,
} from "./elementaryTypes.js";

// Field Category
export { FIELD_CATEGORIES, isFieldCategory } from "./fieldCategory.js";
export type { FieldCategory } from "./fieldCategory.js";

// Field Definition
export { isFieldDefinition } from "./fieldDefinition.js";
export type {
  FieldDefinition,
  FieldRef,
  ValidationRule,
} from "./fieldDefinition.js";
