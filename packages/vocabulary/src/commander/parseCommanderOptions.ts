// Parse Commander.js options back to handler input format

import type { CoercionType } from "../types.js";
import type { ParseCommanderOptionsConfig } from "./types.js";

/**
 * Convert kebab-case to camelCase
 */
function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

/**
 * Convert camelCase to kebab-case
 */
function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Check if a type is a typed array (e.g., [String], [Number])
 */
function isTypedArrayType(type: CoercionType): boolean {
  if (!Array.isArray(type)) {
    return false;
  }
  if (type.length === 0) {
    return true; // [] is untyped array
  }
  if (type.length !== 1) {
    return false;
  }
  const element = type[0];
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
 * Check if a type represents a number (scalar or validated)
 */
function isNumberType(type: CoercionType): boolean {
  if (type === Number || type === "number") {
    return true;
  }
  // Check for validated number type [1, 2, 3]
  if (Array.isArray(type) && type.length > 0) {
    // If it's not a typed array and all elements are numbers, it's a validated number
    if (
      !isTypedArrayType(type) &&
      type.every((item) => typeof item === "number")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a type represents a boolean
 */
function isBooleanType(type: CoercionType): boolean {
  return type === Boolean || type === "boolean";
}

/**
 * Check if a type is an array type (Array, "array", or typed array)
 */
function isArrayType(type: CoercionType): boolean {
  if (type === Array || type === "array") {
    return true;
  }
  return isTypedArrayType(type);
}

/**
 * Check if a type is an object type
 */
function isObjectType(type: CoercionType): boolean {
  return type === Object || type === "object";
}

/**
 * Coerce a single value based on its target type
 */
function coerceValue(value: unknown, type: CoercionType): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }

  // Boolean type - Commander handles this automatically
  if (isBooleanType(type)) {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const lower = value.toLowerCase();
      if (lower === "true" || lower === "1" || lower === "yes") {
        return true;
      }
      if (lower === "false" || lower === "0" || lower === "no") {
        return false;
      }
    }
    return Boolean(value);
  }

  // Number type
  if (isNumberType(type)) {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const num = Number(value);
      if (!isNaN(num)) {
        return num;
      }
    }
    return value;
  }

  // Array types - handle variadic options
  if (isArrayType(type)) {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === "string") {
      // Try to parse as JSON first
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // Not JSON, check for comma or tab separated
        if (value.includes(",")) {
          return value.split(",").map((s) => s.trim());
        }
        if (value.includes("\t")) {
          return value.split("\t").map((s) => s.trim());
        }
      }
      // Single value becomes array
      return [value];
    }
    return [value];
  }

  // Object type - try to parse JSON
  if (isObjectType(type)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value;
    }
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed)
        ) {
          return parsed;
        }
      } catch {
        // Not valid JSON
      }
    }
    return value;
  }

  // String type (default) - just return as-is
  return value;
}

/**
 * Parse Commander.js options back to handler input format
 *
 * This function converts the options object from Commander.js (which uses
 * kebab-case converted to camelCase) back to the expected handler input
 * format with proper type coercion based on the input definitions.
 *
 * @param options - The options object from Commander.js (program.opts())
 * @param config - Configuration including input field definitions
 * @returns An object suitable for passing to a serviceHandler
 *
 * @example
 * ```typescript
 * const handler = serviceHandler({
 *   input: {
 *     userName: { type: String },
 *     age: { type: Number },
 *     tags: { type: [String] },
 *   },
 *   service: (input) => input,
 * });
 *
 * program.action((options) => {
 *   const input = parseCommanderOptions(options, {
 *     input: handler.input,
 *   });
 *   await handler(input);
 * });
 * ```
 */
export function parseCommanderOptions(
  options: Record<string, unknown>,
  config: ParseCommanderOptionsConfig = {},
): Record<string, unknown> {
  const { exclude = [], input: inputDefinitions } = config;
  const result: Record<string, unknown> = {};

  // Build reverse mapping from flag name (camelCase) to field name
  // This handles cases where input.flag overrides the default flag name
  const flagToFieldMap = new Map<string, string>();
  if (inputDefinitions) {
    for (const [fieldName, definition] of Object.entries(inputDefinitions)) {
      if (definition.flag) {
        // Custom flag: map flag (as camelCase) -> fieldName
        const flagCamelCase = toCamelCase(definition.flag);
        flagToFieldMap.set(flagCamelCase, fieldName);
      } else {
        // Default: kebab-case of fieldName -> fieldName
        const defaultFlag = toKebabCase(fieldName);
        const defaultFlagCamelCase = toCamelCase(defaultFlag);
        flagToFieldMap.set(defaultFlagCamelCase, fieldName);
      }
    }
  }

  for (const [key, value] of Object.entries(options)) {
    // Skip excluded fields
    if (exclude.includes(key)) {
      continue;
    }

    // Convert kebab-case Commander option to camelCase
    const keyCamelCase = toCamelCase(key);

    // Look up the actual field name from our mapping
    const fieldName = flagToFieldMap.get(keyCamelCase) ?? keyCamelCase;

    // Skip if excluded after resolution
    if (exclude.includes(fieldName)) {
      continue;
    }

    // Get field definition for type coercion
    const definition = inputDefinitions?.[fieldName];

    if (definition) {
      // Coerce based on type definition
      result[fieldName] = coerceValue(value, definition.type);
    } else {
      // No definition, pass through as-is
      result[fieldName] = value;
    }
  }

  return result;
}
