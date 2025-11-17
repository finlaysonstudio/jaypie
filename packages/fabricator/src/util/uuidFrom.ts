import { v5 as uuidv5 } from "uuid";
import { JAYPIE_FABRICATOR_UUID } from "../constants.js";
import isUuid from "./isUuid.js";

/**
 * Deterministically generates a UUID v5 from a string or number
 * Uses JAYPIE_FABRICATOR_UUID as the namespace for consistent UUID generation
 *
 * If the input is already a valid UUID, a warning is logged and the input is returned unchanged.
 *
 * @param input - String or number to convert to UUID
 * @returns A deterministic UUID v5 string, or the input if it's already a UUID
 *
 * @example
 * const id1 = uuidFrom("my-entity");
 * const id2 = uuidFrom("my-entity");
 * // id1 === id2 (deterministic)
 *
 * @example
 * const numberId = uuidFrom(12345);
 * // Always generates the same UUID for 12345
 *
 * @example
 * const existingUuid = uuidFrom("550e8400-e29b-41d4-a716-446655440000");
 * // Logs warning and returns "550e8400-e29b-41d4-a716-446655440000"
 */
export function uuidFrom(input: string | number): string {
  const str = String(input);

  // Check if input is already a UUID
  if (isUuid(str)) {
    console.warn(
      `[uuidFrom] Input is already a UUID: ${str}. Returning input unchanged.`,
    );
    return str;
  }

  return uuidv5(str, JAYPIE_FABRICATOR_UUID);
}
