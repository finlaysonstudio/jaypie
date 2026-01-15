/**
 * Field Definition - Describes a field's structure and behavior
 *
 * Field definitions are the building blocks of model definitions,
 * specifying type, validation, and metadata for each field.
 */

// =============================================================================
// Interfaces
// =============================================================================

/**
 * Validation rule for a field
 */
export interface ValidationRule {
  /** Error message if validation fails */
  message?: string;
  /** Rule type (required, min, max, pattern, etc.) */
  type: string;
  /** Rule value (varies by type) */
  value?: unknown;
}

/**
 * Field definition - describes a field's structure and behavior
 */
export interface FieldDefinition {
  /** Field identifier (unique within model) */
  alias: string;
  /** Default value */
  defaultValue?: unknown;
  /** Description */
  description?: string;
  /** Fallback chain for value resolution */
  fallback?: string[];
  /** Icon (lucide name or custom) */
  icon?: string;
  /** Display name */
  name: string;
  /** Field type (text, number, dollars, etc.) */
  type: string;
  /** Validation rules */
  validation?: ValidationRule[];
}

/**
 * Field reference - either an alias string or inline definition
 */
export type FieldRef = FieldDefinition | string;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a field ref is an inline definition
 */
export function isFieldDefinition(ref: FieldRef): ref is FieldDefinition {
  return typeof ref === "object" && "alias" in ref && "type" in ref;
}
