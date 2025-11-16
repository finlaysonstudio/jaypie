import numericSeed from "./numericSeed.js";
import uuidToBytes from "./uuidToBytes.js";
import uuidToNumber from "./uuidToNumber.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Converts a string into an array of numeric values.
 * If the string is a UUID, attempts to convert using uuidToBytes.
 * Falls back to uuidToNumber if uuidToBytes fails.
 * Finally falls back to numericSeed for non-UUID strings.
 * @param seed - String to convert into numeric array
 * @returns Array of numeric values derived from the input
 */
export default function numericSeedArray(seed: string): number[] {
  if (!UUID_REGEX.test(seed)) {
    return [numericSeed(seed)];
  }

  try {
    return uuidToBytes(seed);
  } catch {
    try {
      return [uuidToNumber(seed)];
    } catch {
      return [numericSeed(seed)];
    }
  }
}
