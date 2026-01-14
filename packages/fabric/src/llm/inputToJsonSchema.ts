// Convert fabric input definitions to JSON Schema

import { isDateType } from "../convert-date.js";
import type { ConversionType, InputFieldDefinition } from "../types.js";

/**
 * JSON Schema property definition
 */
interface JsonSchemaProperty {
  description?: string;
  enum?: unknown[];
  items?: { type: string };
  type: string;
}

/**
 * JSON Schema object definition
 */
export interface JsonSchema {
  [key: string]: unknown;
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
  type: "object";
}

/**
 * Check if a single-element array is a typed array type constructor.
 */
function isTypedArrayConstructor(element: unknown): boolean {
  return (
    element === Boolean ||
    element === Number ||
    element === String ||
    element === Object ||
    element === "boolean" ||
    element === "number" ||
    element === "string" ||
    element === "object" ||
    element === "" ||
    (typeof element === "object" &&
      element !== null &&
      !(element instanceof RegExp) &&
      Object.keys(element as Record<string, unknown>).length === 0)
  );
}

/**
 * Get the JSON Schema type string for a conversion type
 */
function getJsonSchemaType(type: ConversionType): string {
  // Handle constructors
  if (type === Boolean || type === "boolean") return "boolean";
  if (type === Number || type === "number") return "number";
  if (type === String || type === "string") return "string";
  if (type === Object || type === "object") return "object";
  if (type === Array || type === "array") return "array";

  // Handle Date type (represented as string in JSON Schema)
  if (isDateType(type)) return "string";

  // Handle RegExp (converts to string)
  if (type instanceof RegExp) return "string";

  // Handle arrays
  if (Array.isArray(type)) {
    // Empty array = untyped array
    if (type.length === 0) return "array";

    // Single-element typed array like [String], [Number], etc.
    if (type.length === 1 && isTypedArrayConstructor(type[0])) {
      return "array";
    }

    // Validated string type: ["value1", "value2"] or [/regex/]
    if (
      type.every((item) => typeof item === "string" || item instanceof RegExp)
    ) {
      return "string";
    }

    // Validated number type: [1, 2, 3]
    if (type.every((item) => typeof item === "number")) {
      return "number";
    }
  }

  // Default to string
  return "string";
}

/**
 * Get the array item type for typed arrays
 */
function getArrayItemType(type: ConversionType): string | undefined {
  if (!Array.isArray(type) || type.length !== 1) return undefined;

  const element = type[0];
  if (element === Boolean || element === "boolean") return "boolean";
  if (element === Number || element === "number") return "number";
  if (element === String || element === "string" || element === "")
    return "string";
  if (element === Object || element === "object") return "object";
  if (
    typeof element === "object" &&
    element !== null &&
    !(element instanceof RegExp) &&
    Object.keys(element as Record<string, unknown>).length === 0
  ) {
    return "object";
  }

  return undefined;
}

/**
 * Get enum values for validated types
 */
function getEnumValues(type: ConversionType): unknown[] | undefined {
  if (!Array.isArray(type)) return undefined;
  if (type.length === 0) return undefined;
  if (type.length === 1 && isTypedArrayConstructor(type[0])) return undefined;

  // Check if it's a validated string type (strings only, no RegExp)
  if (type.every((item) => typeof item === "string")) {
    return type;
  }

  // Check if it's a validated number type
  if (type.every((item) => typeof item === "number")) {
    return type;
  }

  return undefined;
}

/**
 * Check if a field is required
 */
function isFieldRequired(definition: InputFieldDefinition): boolean {
  if (definition.required === false) {
    return false;
  }
  if (definition.default !== undefined) {
    return false;
  }
  return true;
}

/**
 * Convert a single input field definition to JSON Schema property
 */
function inputFieldToJsonSchema(
  definition: InputFieldDefinition,
): JsonSchemaProperty {
  const schemaType = getJsonSchemaType(definition.type);

  const property: JsonSchemaProperty = {
    type: schemaType,
  };

  // Add description
  if (definition.description) {
    property.description = definition.description;
  }

  // Add enum for validated types
  const enumValues = getEnumValues(definition.type);
  if (enumValues) {
    property.enum = enumValues;
  }

  // Add items for typed arrays
  if (schemaType === "array") {
    const itemType = getArrayItemType(definition.type);
    if (itemType) {
      property.items = { type: itemType };
    }
  }

  return property;
}

/**
 * Convert fabric input definitions to JSON Schema
 *
 * @param input - The input definitions
 * @param options - Conversion options
 * @returns JSON Schema object compatible with LLM tool parameters
 */
export function inputToJsonSchema(
  input?: Record<string, InputFieldDefinition>,
  options: { exclude?: string[] } = {},
): JsonSchema {
  const { exclude = [] } = options;

  const schema: JsonSchema = {
    properties: {},
    required: [],
    type: "object",
  };

  if (!input) {
    return schema;
  }

  // Sort keys alphabetically
  const sortedKeys = Object.keys(input).sort();

  for (const key of sortedKeys) {
    // Skip excluded fields
    if (exclude.includes(key)) {
      continue;
    }

    const definition = input[key];
    schema.properties[key] = inputFieldToJsonSchema(definition);

    if (isFieldRequired(definition)) {
      schema.required.push(key);
    }
  }

  return schema;
}
