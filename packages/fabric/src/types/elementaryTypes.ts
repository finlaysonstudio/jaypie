/**
 * Elementary Field Types
 *
 * Defines the 10 elementary field types for the Fabric vocabulary.
 * Each type has: alias, name, icon, and optional validation/format rules.
 */

import type { FieldDefinition } from "./fieldDefinition.js";

// =============================================================================
// Constants
// =============================================================================

/** Elementary type aliases */
export const ELEMENTARY_TYPES = [
  "boolean",
  "date",
  "datetime",
  "dollars",
  "multiselect",
  "number",
  "reference",
  "select",
  "text",
  "textarea",
] as const;

// =============================================================================
// Types
// =============================================================================

export type ElementaryType = (typeof ELEMENTARY_TYPES)[number];

/**
 * Extended field definition for elementary types
 */
export interface ElementaryTypeDefinition extends FieldDefinition {
  /** The elementary type alias */
  alias: ElementaryType;
  /** Display format pattern */
  formatPattern?: string;
  /** Input component type (for UI rendering) */
  inputComponent?: string;
  /** Options for select/multiselect types */
  options?: Array<{ label: string; value: string }>;
  /** Reference model for reference types */
  referenceModel?: string;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a string is an elementary type
 */
export function isElementaryType(value: unknown): value is ElementaryType {
  return (
    typeof value === "string" &&
    ELEMENTARY_TYPES.includes(value as ElementaryType)
  );
}

// =============================================================================
// Elementary Type Definitions
// =============================================================================

/**
 * Boolean - True/false toggle
 */
export const BOOLEAN_TYPE: ElementaryTypeDefinition = {
  alias: "boolean",
  category: "state",
  defaultValue: false,
  description: "True/false toggle",
  icon: "lucide#toggle-left",
  inputComponent: "checkbox",
  name: "Boolean",
  type: "boolean",
};

/**
 * Date - Date picker (ISO format)
 */
export const DATE_TYPE: ElementaryTypeDefinition = {
  alias: "date",
  category: "state",
  description: "Date value (YYYY-MM-DD)",
  formatPattern: "YYYY-MM-DD",
  icon: "lucide#calendar",
  inputComponent: "date-picker",
  name: "Date",
  type: "date",
};

/**
 * Datetime - Date + time picker
 */
export const DATETIME_TYPE: ElementaryTypeDefinition = {
  alias: "datetime",
  category: "state",
  description: "Date and time value (ISO 8601)",
  formatPattern: "YYYY-MM-DDTHH:mm:ssZ",
  icon: "lucide#calendar-clock",
  inputComponent: "datetime-picker",
  name: "Date & Time",
  type: "datetime",
};

/**
 * Dollars - Currency with formatting
 */
export const DOLLARS_TYPE: ElementaryTypeDefinition = {
  alias: "dollars",
  category: "state",
  description: "Currency value formatted as $X.XX",
  formatPattern: "$0,0.00",
  icon: "lucide#dollar-sign",
  inputComponent: "currency-input",
  name: "Dollars",
  type: "dollars",
  validation: [
    { message: "Must be a valid number", type: "numeric" },
    { message: "Cannot be negative", type: "min", value: 0 },
  ],
};

/**
 * Multiselect - Multiple selections from options
 */
export const MULTISELECT_TYPE: ElementaryTypeDefinition = {
  alias: "multiselect",
  category: "state",
  description: "Multiple selections from predefined options",
  icon: "lucide#list-checks",
  inputComponent: "multiselect",
  name: "Multi-Select",
  options: [], // Populated per-field
  type: "multiselect",
};

/**
 * Number - Numeric input (integer or float)
 */
export const NUMBER_TYPE: ElementaryTypeDefinition = {
  alias: "number",
  category: "state",
  description: "Numeric value (integer or decimal)",
  icon: "lucide#hash",
  inputComponent: "input[type=number]",
  name: "Number",
  type: "number",
  validation: [{ message: "Must be a valid number", type: "numeric" }],
};

/**
 * Reference - Link to another model
 */
export const REFERENCE_TYPE: ElementaryTypeDefinition = {
  alias: "reference",
  category: "metadata",
  description: "Link to another model by id or alias",
  icon: "lucide#link",
  inputComponent: "entity-picker",
  name: "Reference",
  referenceModel: undefined, // Set per-field
  type: "reference",
};

/**
 * Select - Single selection from options
 */
export const SELECT_TYPE: ElementaryTypeDefinition = {
  alias: "select",
  category: "state",
  description: "Single selection from predefined options",
  icon: "lucide#list",
  inputComponent: "select",
  name: "Select",
  options: [], // Populated per-field
  type: "select",
};

/**
 * Text - Single-line string input
 */
export const TEXT_TYPE: ElementaryTypeDefinition = {
  alias: "text",
  category: "state",
  description: "Single-line text input",
  icon: "lucide#type",
  inputComponent: "input",
  name: "Text",
  type: "text",
};

/**
 * Textarea - Multi-line string input
 */
export const TEXTAREA_TYPE: ElementaryTypeDefinition = {
  alias: "textarea",
  category: "state",
  description: "Multi-line text input",
  icon: "lucide#align-left",
  inputComponent: "textarea",
  name: "Text Area",
  type: "textarea",
};

// =============================================================================
// Type Registry
// =============================================================================

/**
 * Registry of all elementary types
 */
export const ELEMENTARY_TYPE_REGISTRY: Record<
  ElementaryType,
  ElementaryTypeDefinition
> = {
  boolean: BOOLEAN_TYPE,
  date: DATE_TYPE,
  datetime: DATETIME_TYPE,
  dollars: DOLLARS_TYPE,
  multiselect: MULTISELECT_TYPE,
  number: NUMBER_TYPE,
  reference: REFERENCE_TYPE,
  select: SELECT_TYPE,
  text: TEXT_TYPE,
  textarea: TEXTAREA_TYPE,
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get an elementary type definition by alias
 */
export function getElementaryType(
  alias: ElementaryType,
): ElementaryTypeDefinition {
  return ELEMENTARY_TYPE_REGISTRY[alias];
}

/**
 * Get all elementary type definitions
 */
export function getAllElementaryTypes(): ElementaryTypeDefinition[] {
  return Object.values(ELEMENTARY_TYPE_REGISTRY);
}
