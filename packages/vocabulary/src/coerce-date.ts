/**
 * Date Type Coercion for @jaypie/vocabulary
 *
 * Adds Date as a supported type in the vocabulary type system.
 * Follows the same coercion patterns as String, Number, Boolean.
 */

import { BadRequestError } from "@jaypie/errors";

/**
 * Check if a value is a valid Date
 */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Coerce a value to a Date
 *
 * Supported inputs:
 * - Date: returned as-is (validated)
 * - Number: treated as Unix timestamp (milliseconds)
 * - String: parsed via Date constructor (ISO 8601, etc.)
 * - Object with value property: unwrapped and coerced
 *
 * @throws BadRequestError if value cannot be coerced to valid Date
 */
export function coerceToDate(value: unknown): Date {
  // Already a Date
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new BadRequestError("Invalid Date value");
    }
    return value;
  }

  // Null/undefined
  if (value === null || value === undefined) {
    throw new BadRequestError("Cannot coerce null or undefined to Date");
  }

  // Object with value property (vocabulary pattern)
  if (typeof value === "object" && value !== null && "value" in value) {
    return coerceToDate((value as { value: unknown }).value);
  }

  // Number (timestamp in milliseconds)
  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      throw new BadRequestError("Cannot coerce NaN to Date");
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestError(`Cannot coerce ${value} to Date`);
    }
    return date;
  }

  // String (ISO 8601 or parseable format)
  if (typeof value === "string") {
    // Empty string is invalid
    if (value.trim() === "") {
      throw new BadRequestError("Cannot coerce empty string to Date");
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestError(`Cannot coerce "${value}" to Date`);
    }
    return date;
  }

  // Boolean cannot be coerced to Date
  if (typeof value === "boolean") {
    throw new BadRequestError("Cannot coerce boolean to Date");
  }

  // Arrays - attempt single element extraction
  if (Array.isArray(value)) {
    if (value.length === 1) {
      return coerceToDate(value[0]);
    }
    throw new BadRequestError(
      `Cannot coerce array with ${value.length} elements to Date`,
    );
  }

  throw new BadRequestError(`Cannot coerce ${typeof value} to Date`);
}

/**
 * Coerce a value from a Date to another type
 *
 * @param value - Date to coerce
 * @param targetType - Target type (String, Number)
 */
export function coerceFromDate(
  value: Date,
  targetType: typeof Number | typeof String,
): number | string {
  if (!isValidDate(value)) {
    throw new BadRequestError("Invalid Date value");
  }

  if (targetType === String) {
    return value.toISOString();
  }

  if (targetType === Number) {
    return value.getTime();
  }

  throw new BadRequestError(`Cannot coerce Date to ${targetType}`);
}

/**
 * Date type constant for use in serviceHandler input definitions
 *
 * Usage:
 * ```typescript
 * const handler = serviceHandler({
 *   input: {
 *     startDate: { type: Date },
 *     endDate: { type: Date, default: undefined }
 *   }
 * });
 * ```
 */
export const DateType = Date;

/**
 * Type guard for Date type in schema definitions
 */
export function isDateType(type: unknown): type is typeof Date {
  return type === Date;
}
