// Fabric functions for @jaypie/fabric

import { BadRequestError } from "@jaypie/errors";

import { fabricDate, isDateType } from "./resolve-date.js";
import type { ConversionType, TypedArrayType } from "./types.js";

/**
 * Try to parse a string as JSON if it looks like JSON
 * Returns the parsed value or the original string if not JSON
 */
function tryParseJson(value: string): unknown {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Not valid JSON, return original
      return value;
    }
  }
  return value;
}

/**
 * Unwrap arrays and objects to get to the scalar value
 * - Single-element arrays unwrap to their element
 * - Objects with value property unwrap to that value
 * - Recursively unwraps nested structures
 */
function unwrapToScalar(value: unknown): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  // Unwrap single-element arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return undefined;
    }
    if (value.length === 1) {
      return unwrapToScalar(value[0]);
    }
    throw new BadRequestError("Cannot convert multi-value array to scalar");
  }

  // Unwrap objects with value property
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("value" in obj) {
      return unwrapToScalar(obj.value);
    }
    throw new BadRequestError("Object must have a value attribute");
  }

  return value;
}

/**
 * Prepare a value for scalar conversion by parsing JSON strings and unwrapping
 */
function prepareForScalarConversion(value: unknown): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  // Try to parse JSON strings
  if (typeof value === "string") {
    const parsed = tryParseJson(value);
    if (parsed !== value) {
      // Successfully parsed, unwrap the result
      return unwrapToScalar(parsed);
    }
    return value;
  }

  // Unwrap arrays and objects
  if (Array.isArray(value) || typeof value === "object") {
    return unwrapToScalar(value);
  }

  return value;
}

/**
 * Convert a value to a boolean
 * - Arrays, objects, and JSON strings are unwrapped first
 * - String "true" becomes true
 * - String "false" becomes false
 * - Strings that parse to numbers: positive = true, zero or negative = false
 * - Numbers: positive = true, zero or negative = false
 * - Boolean passes through
 */
export function fabricBoolean(value: unknown): boolean | undefined {
  // Prepare value by parsing JSON and unwrapping arrays/objects
  const prepared = prepareForScalarConversion(value);

  if (prepared === undefined || prepared === null) {
    return undefined;
  }

  if (typeof prepared === "boolean") {
    return prepared;
  }

  if (typeof prepared === "string") {
    if (prepared === "") {
      return undefined;
    }
    const lower = prepared.toLowerCase();
    if (lower === "true") {
      return true;
    }
    if (lower === "false") {
      return false;
    }
    // Try to parse as number
    const num = parseFloat(prepared);
    if (isNaN(num)) {
      throw new BadRequestError(`Cannot convert "${prepared}" to Boolean`);
    }
    return num > 0;
  }

  if (typeof prepared === "number") {
    if (isNaN(prepared)) {
      throw new BadRequestError("Cannot convert NaN to Boolean");
    }
    return prepared > 0;
  }

  throw new BadRequestError(`Cannot convert ${typeof prepared} to Boolean`);
}

/**
 * Convert a value to a number
 * - Arrays, objects, and JSON strings are unwrapped first
 * - String "" becomes undefined
 * - String "true" becomes 1
 * - String "false" becomes 0
 * - Strings that parse to numbers use those values
 * - Strings that parse to NaN throw BadRequestError
 * - Boolean true becomes 1, false becomes 0
 * - Number passes through
 */
export function fabricNumber(value: unknown): number | undefined {
  // Prepare value by parsing JSON and unwrapping arrays/objects
  const prepared = prepareForScalarConversion(value);

  if (prepared === undefined || prepared === null) {
    return undefined;
  }

  if (typeof prepared === "number") {
    if (isNaN(prepared)) {
      throw new BadRequestError("Cannot convert NaN to Number");
    }
    return prepared;
  }

  if (typeof prepared === "boolean") {
    return prepared ? 1 : 0;
  }

  if (typeof prepared === "string") {
    if (prepared === "") {
      return undefined;
    }
    const lower = prepared.toLowerCase();
    if (lower === "true") {
      return 1;
    }
    if (lower === "false") {
      return 0;
    }
    const num = parseFloat(prepared);
    if (isNaN(num)) {
      throw new BadRequestError(`Cannot convert "${prepared}" to Number`);
    }
    return num;
  }

  throw new BadRequestError(`Cannot convert ${typeof prepared} to Number`);
}

/**
 * Convert a value to a string
 * - Arrays, objects, and JSON strings are unwrapped first
 * - String "" becomes undefined
 * - Boolean true becomes "true", false becomes "false"
 * - Number converts to string representation
 * - String passes through
 */
export function fabricString(value: unknown): string | undefined {
  // Prepare value by parsing JSON and unwrapping arrays/objects
  const prepared = prepareForScalarConversion(value);

  if (prepared === undefined || prepared === null) {
    return undefined;
  }

  if (typeof prepared === "string") {
    if (prepared === "") {
      return undefined;
    }
    return prepared;
  }

  if (typeof prepared === "boolean") {
    return prepared ? "true" : "false";
  }

  if (typeof prepared === "number") {
    if (isNaN(prepared)) {
      throw new BadRequestError("Cannot convert NaN to String");
    }
    return String(prepared);
  }

  throw new BadRequestError(`Cannot convert ${typeof prepared} to String`);
}

/**
 * Convert a value to an array
 * - Non-arrays become arrays containing that value
 * - Arrays of a single value become that value (unwrapped)
 * - Multi-value arrays throw BadRequestError
 * - undefined/null become undefined
 */
export function fabricArray(value: unknown): unknown[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    // Arrays pass through (single-element unwrapping happens when converting FROM array)
    return value;
  }

  // Non-arrays become single-element arrays
  return [value];
}

/**
 * Resolve a value from an array to a scalar
 * - Single-element arrays become that element
 * - Multi-element arrays throw BadRequestError
 * - Non-arrays pass through
 */
export function resolveFromArray(value: unknown): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return undefined;
    }
    if (value.length === 1) {
      return value[0];
    }
    throw new BadRequestError("Cannot convert multi-value array to scalar");
  }

  return value;
}

/**
 * Convert a value to an object with a value property
 * - Scalars become { value: scalar }
 * - Arrays become { value: array }
 * - Objects with a value attribute pass through
 * - Objects without a value attribute throw BadRequestError
 * - undefined/null become undefined
 */
export function fabricObject(value: unknown): { value: unknown } | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  // Check if already an object (but not an array)
  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if ("value" in obj) {
      return obj as { value: unknown };
    }
    throw new BadRequestError("Object must have a value attribute");
  }

  // Scalars and arrays become { value: ... }
  return { value };
}

/**
 * Resolve a value from an object to its value property
 * - Objects with a value property return that value
 * - Objects without a value throw BadRequestError
 * - Scalars pass through
 */
export function resolveFromObject(value: unknown): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if ("value" in obj) {
      return obj.value;
    }
    throw new BadRequestError("Object must have a value attribute");
  }

  return value;
}

/**
 * Check if a type is a typed array (e.g., [String], [Number], [], etc.)
 */
function isTypedArrayType(type: ConversionType): type is TypedArrayType {
  return Array.isArray(type);
}

/**
 * Split a string on comma or tab delimiters for typed array conversion.
 * Only splits if the string contains commas or tabs.
 * Returns the original value if not a string or no delimiters found.
 */
function splitStringForArray(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  // Check for comma or tab delimiters
  if (value.includes(",")) {
    return value.split(",").map((s) => s.trim());
  }
  if (value.includes("\t")) {
    return value.split("\t").map((s) => s.trim());
  }

  return value;
}

/**
 * Try to parse a string as JSON for array context.
 * Returns parsed value if it's an array, otherwise returns original.
 */
function tryParseJsonArray(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Not valid JSON, fall through
    }
  }

  return value;
}

/**
 * Get the element type from a typed array type
 * Returns undefined for untyped arrays ([])
 */
function getArrayElementType(
  type: TypedArrayType,
): "boolean" | "number" | "object" | "string" | undefined {
  if (type.length === 0) {
    return undefined; // Untyped array
  }

  const elementType = type[0];

  // Handle constructor types
  if (elementType === Boolean) return "boolean";
  if (elementType === Number) return "number";
  if (elementType === String) return "string";
  if (elementType === Object) return "object";

  // Handle string types
  if (elementType === "boolean") return "boolean";
  if (elementType === "number") return "number";
  if (elementType === "string") return "string";
  if (elementType === "object") return "object";

  // Handle shorthand types
  if (elementType === "") return "string"; // "" shorthand for String
  if (
    typeof elementType === "object" &&
    elementType !== null &&
    Object.keys(elementType).length === 0
  ) {
    return "object"; // {} shorthand for Object
  }

  throw new BadRequestError(
    `Unknown array element type: ${String(elementType)}`,
  );
}

/**
 * Convert a value to a typed array
 * - Tries to parse JSON arrays first
 * - Splits strings on comma/tab if present
 * - Wraps non-arrays in an array
 * - Converts each element to the specified element type
 */
function fabricTypedArray(
  value: unknown,
  elementType: "boolean" | "number" | "object" | "string" | undefined,
): unknown[] | undefined {
  // Try to parse JSON array first
  let processed = tryParseJsonArray(value);

  // If still a string, try to split on comma/tab
  processed = splitStringForArray(processed);

  // Convert to array (wraps non-arrays)
  const array = fabricArray(processed);

  if (array === undefined) {
    return undefined;
  }

  // If no element type specified, return as-is
  if (elementType === undefined) {
    return array;
  }

  // Convert each element to the element type
  return array.map((element, index) => {
    try {
      switch (elementType) {
        case "boolean":
          return fabricBoolean(element);
        case "number":
          return fabricNumber(element);
        case "object":
          return fabricObject(element);
        case "string":
          return fabricString(element);
        default:
          throw new BadRequestError(`Unknown element type: ${elementType}`);
      }
    } catch (error) {
      if (error instanceof BadRequestError) {
        throw new BadRequestError(
          `Cannot convert array element at index ${index}: ${error.message}`,
        );
      }
      throw error;
    }
  });
}

/**
 * Fabric a value to the specified type
 */
export function fabric(value: unknown, type: ConversionType): unknown {
  // Check for Date type first
  if (isDateType(type)) {
    return fabricDate(value);
  }

  // Check for typed array types
  if (isTypedArrayType(type)) {
    const elementType = getArrayElementType(type);
    return fabricTypedArray(value, elementType);
  }

  const normalizedType = normalizeType(type);

  switch (normalizedType) {
    case "array":
      return fabricArray(value);
    case "boolean":
      return fabricBoolean(value);
    case "number":
      return fabricNumber(value);
    case "object":
      return fabricObject(value);
    case "string":
      return fabricString(value);
    default:
      throw new BadRequestError(`Unknown type: ${String(type)}`);
  }
}

/**
 * Normalize type to string representation
 */
function normalizeType(
  type: ConversionType,
): "array" | "boolean" | "number" | "object" | "string" {
  if (type === Array || type === "array") {
    return "array";
  }
  if (type === Boolean || type === "boolean") {
    return "boolean";
  }
  if (type === Number || type === "number") {
    return "number";
  }
  if (type === Object || type === "object") {
    return "object";
  }
  if (type === String || type === "string") {
    return "string";
  }
  throw new BadRequestError(`Unknown type: ${String(type)}`);
}
