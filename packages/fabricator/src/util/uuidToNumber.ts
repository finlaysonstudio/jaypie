import { parse as parseUuid } from "uuid";

/**
 * Converts a UUID string into a numeric value by using the last 6 bytes
 * to ensure better uniqueness between different UUIDs
 * @param uuid - UUID string to convert
 * @returns Numeric value derived from the UUID
 */
export default function uuidToNumber(uuid: string): number {
  if (!uuid) {
    return 0;
  }

  // Parse UUID into bytes
  const bytes = parseUuid(uuid);

  // Use the last 6 bytes (48 bits) to stay within safe JavaScript integer range
  // Convert to hex string and parse as integer
  const lastBytes = Array.from(bytes.slice(-6))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return parseInt(lastBytes, 16);
}
