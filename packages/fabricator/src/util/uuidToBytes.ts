import { parse as parseUuid } from "uuid";

/**
 * Converts a UUID string into a numeric value by using the last 6 bytes
 * to ensure better uniqueness between different UUIDs
 * @param uuid - UUID string to convert
 * @returns Numeric value derived from the UUID
 */
export default function uuidToBytes(uuid: string): number[] {
  if (!uuid) {
    return [0];
  }

  const bytes = parseUuid(uuid);
  return Array.from(bytes);
}
