/**
 * UUID v4 regex pattern (also matches v1, v3, v5)
 * Format: 8-4-4-4-12 hexadecimal characters
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks if a string is a valid UUID format
 * Validates the standard UUID format: 8-4-4-4-12 hexadecimal characters
 * Case-insensitive check
 *
 * @param input - String to check
 * @returns True if input is a valid UUID format, false otherwise
 *
 * @example
 * isUuid("550e8400-e29b-41d4-a716-446655440000"); // true
 * isUuid("not-a-uuid"); // false
 * isUuid("550E8400-E29B-41D4-A716-446655440000"); // true (case insensitive)
 */
export default function isUuid(input: string): boolean {
  return UUID_REGEX.test(input);
}
