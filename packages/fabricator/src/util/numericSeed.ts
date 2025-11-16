import uuidToNumber from "./uuidToNumber.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Converts a string or number seed into a deterministic numeric value.
 * If the input is a number, returns it directly.
 * If the string is a UUID, uses uuidToNumber for conversion.
 * @param seed - String or number to convert into a numeric seed
 * @returns Absolute numeric value derived from the input
 */
export default function numericSeed(seed: string | number): number {
  // If seed is already a number, return it
  if (typeof seed === "number") {
    return Math.abs(seed);
  }

  // Check if the string matches UUID format
  if (UUID_REGEX.test(seed)) {
    return uuidToNumber(seed);
  }

  // Original hash calculation for non-UUID strings
  return Math.abs(
    seed.split("").reduce((hash: number, char: string) => {
      const charCode = char.charCodeAt(0);
      return ((hash << 5) - hash + charCode) | 0;
    }, 0),
  );
}
