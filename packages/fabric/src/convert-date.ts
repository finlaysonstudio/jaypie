/**
 * Date Type Conversion for @jaypie/fabric
 *
 * Adds Date as a supported type in the fabric type system.
 * Follows the same conversion patterns as String, Number, Boolean.
 */

import { BadRequestError } from "@jaypie/errors";

/**
 * Check if a value is a valid Date
 */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Convert a value to a Date
 *
 * Supported inputs:
 * - Date: returned as-is (validated)
 * - Number: treated as Unix timestamp (milliseconds)
 * - String: parsed via Date constructor (ISO 8601, etc.)
 * - Object with value property: unwrapped and converted
 *
 * @throws BadRequestError if value cannot be converted to valid Date
 */
export function convertToDate(value: unknown): Date {
  // Already a Date
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new BadRequestError("Invalid Date value");
    }
    return value;
  }

  // Null/undefined
  if (value === null || value === undefined) {
    throw new BadRequestError("Cannot convert null or undefined to Date");
  }

  // Object with value property (fabric pattern)
  if (typeof value === "object" && value !== null && "value" in value) {
    return convertToDate((value as { value: unknown }).value);
  }

  // Number (timestamp in milliseconds)
  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      throw new BadRequestError("Cannot convert NaN to Date");
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestError(`Cannot convert ${value} to Date`);
    }
    return date;
  }

  // String (ISO 8601 or parseable format)
  if (typeof value === "string") {
    // Empty string is invalid
    if (value.trim() === "") {
      throw new BadRequestError("Cannot convert empty string to Date");
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestError(`Cannot convert "${value}" to Date`);
    }
    return date;
  }

  // Boolean cannot be converted to Date
  if (typeof value === "boolean") {
    throw new BadRequestError("Cannot convert boolean to Date");
  }

  // Arrays - attempt single element extraction
  if (Array.isArray(value)) {
    if (value.length === 1) {
      return convertToDate(value[0]);
    }
    throw new BadRequestError(
      `Cannot convert array with ${value.length} elements to Date`,
    );
  }

  throw new BadRequestError(`Cannot convert ${typeof value} to Date`);
}

/**
 * Convert a value from a Date to another type
 *
 * @param value - Date to convert
 * @param targetType - Target type (String, Number)
 */
export function convertFromDate(
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

  throw new BadRequestError(`Cannot convert Date to ${targetType}`);
}

/**
 * Date type constant for use in createService input definitions
 *
 * Usage:
 * ```typescript
 * const handler = createService({
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
