// Coercion functions for @jaypie/vocabulary

import { BadRequestError } from "@jaypie/errors";

import type { CoercionType } from "./types.js";

/**
 * Coerce a value to a boolean
 * - String "true" becomes true
 * - String "false" becomes false
 * - Strings that parse to numbers: positive = true, zero or negative = false
 * - Numbers: positive = true, zero or negative = false
 * - Boolean passes through
 */
export function coerceToBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "") {
      return undefined;
    }
    const lower = value.toLowerCase();
    if (lower === "true") {
      return true;
    }
    if (lower === "false") {
      return false;
    }
    // Try to parse as number
    const num = parseFloat(value);
    if (isNaN(num)) {
      throw new BadRequestError(`Cannot coerce "${value}" to Boolean`);
    }
    return num > 0;
  }

  if (typeof value === "number") {
    if (isNaN(value)) {
      throw new BadRequestError("Cannot coerce NaN to Boolean");
    }
    return value > 0;
  }

  throw new BadRequestError(`Cannot coerce ${typeof value} to Boolean`);
}

/**
 * Coerce a value to a number
 * - String "" becomes undefined
 * - String "true" becomes 1
 * - String "false" becomes 0
 * - Strings that parse to numbers use those values
 * - Strings that parse to NaN throw BadRequestError
 * - Boolean true becomes 1, false becomes 0
 * - Number passes through
 */
export function coerceToNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "number") {
    if (isNaN(value)) {
      throw new BadRequestError("Cannot coerce NaN to Number");
    }
    return value;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value === "string") {
    if (value === "") {
      return undefined;
    }
    const lower = value.toLowerCase();
    if (lower === "true") {
      return 1;
    }
    if (lower === "false") {
      return 0;
    }
    const num = parseFloat(value);
    if (isNaN(num)) {
      throw new BadRequestError(`Cannot coerce "${value}" to Number`);
    }
    return num;
  }

  throw new BadRequestError(`Cannot coerce ${typeof value} to Number`);
}

/**
 * Coerce a value to a string
 * - String "" becomes undefined
 * - Boolean true becomes "true", false becomes "false"
 * - Number converts to string representation
 * - String passes through
 */
export function coerceToString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    if (value === "") {
      return undefined;
    }
    return value;
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "number") {
    if (isNaN(value)) {
      throw new BadRequestError("Cannot coerce NaN to String");
    }
    return String(value);
  }

  throw new BadRequestError(`Cannot coerce ${typeof value} to String`);
}

/**
 * Coerce a value to an array
 * - Non-arrays become arrays containing that value
 * - Arrays of a single value become that value (unwrapped)
 * - Multi-value arrays throw BadRequestError
 * - undefined/null become undefined
 */
export function coerceToArray(value: unknown): unknown[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    // Arrays pass through (single-element unwrapping happens when coercing FROM array)
    return value;
  }

  // Non-arrays become single-element arrays
  return [value];
}

/**
 * Coerce a value from an array to a scalar
 * - Single-element arrays become that element
 * - Multi-element arrays throw BadRequestError
 * - Non-arrays pass through
 */
export function coerceFromArray(value: unknown): unknown {
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
    throw new BadRequestError("Cannot coerce multi-value array to scalar");
  }

  return value;
}

/**
 * Coerce a value to an object with a value property
 * - Scalars become { value: scalar }
 * - Arrays become { value: array }
 * - Objects with a value attribute pass through
 * - Objects without a value attribute throw BadRequestError
 * - undefined/null become undefined
 */
export function coerceToObject(
  value: unknown,
): { value: unknown } | undefined {
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
 * Coerce a value from an object to its value property
 * - Objects with a value property return that value
 * - Objects without a value throw BadRequestError
 * - Scalars pass through
 */
export function coerceFromObject(value: unknown): unknown {
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
 * Coerce a value to the specified type
 */
export function coerce(
  value: unknown,
  type: CoercionType,
): unknown {
  const normalizedType = normalizeType(type);

  switch (normalizedType) {
    case "array":
      return coerceToArray(value);
    case "boolean":
      return coerceToBoolean(value);
    case "number":
      return coerceToNumber(value);
    case "object":
      return coerceToObject(value);
    case "string":
      return coerceToString(value);
    default:
      throw new BadRequestError(`Unknown type: ${String(type)}`);
  }
}

/**
 * Normalize type to string representation
 */
function normalizeType(
  type: CoercionType,
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
