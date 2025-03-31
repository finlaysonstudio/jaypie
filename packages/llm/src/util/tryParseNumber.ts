/**
 * Options for tryParseNumber function
 */
export interface TryParseNumberOptions {
  /**
   * Default value to return if parsing fails or results in NaN
   */
  defaultValue?: number;
  /**
   * Function to call with warning message if parsing fails or results in NaN
   */
  warnFunction?: (message: string) => void;
}

/**
 * Helper function to safely call a function that might throw
 * @param fn Function to call safely
 */
function callSafely(fn: () => void): void {
  try {
    fn();
  } catch {
    // Silently catch any errors from the function
  }
}

/**
 * Attempts to parse a value as a number. Returns the original input if parsing fails or results in NaN.
 * @param input - The value to attempt to parse as a number
 * @param options - Optional configuration
 * @param options.defaultValue - Default value to return if parsing fails or results in NaN
 * @param options.warnFunction - Function to call with warning message if parsing fails or results in NaN
 * @returns The parsed number, defaultValue (if specified and parsing fails), or the original input
 */
export function tryParseNumber(
  input: unknown,
  options?: TryParseNumberOptions,
): number | unknown {
  if (input === null || input === undefined) {
    return input;
  }

  try {
    const parsed = Number(input);

    if (Number.isNaN(parsed)) {
      if (options?.warnFunction) {
        const warningMessage = `Failed to parse "${String(input)}" as number`;
        callSafely(() => options.warnFunction!(warningMessage));
      }

      return typeof options?.defaultValue === "number"
        ? options.defaultValue
        : input;
    }

    return parsed;
  } catch (error: unknown) {
    if (options?.warnFunction) {
      let errorMessage = "";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      const warningMessage = `Error parsing "${String(input)}" as number${errorMessage ? "; " + errorMessage : ""}`;
      callSafely(() => options.warnFunction!(warningMessage));
    }

    return typeof options?.defaultValue === "number"
      ? options.defaultValue
      : input;
  }
}
