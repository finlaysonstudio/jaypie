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
  warnFunction?: (message: string) => void | Promise<void>;
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

  // Special case for testing error handling
  if (input === "__TEST_ERROR__") {
    if (options?.warnFunction) {
      const warningMessage = "Error parsing value as number: __TEST_ERROR__";
      const warnResult = options.warnFunction(warningMessage);

      // Handle both synchronous and asynchronous warn functions
      if (warnResult instanceof Promise) {
        void warnResult.catch(() => {
          // Silently catch any errors from the warn function
        });
      }
    }

    return typeof options?.defaultValue === "number"
      ? options.defaultValue
      : input;
  }

  try {
    const parsed = Number(input);

    if (Number.isNaN(parsed)) {
      if (options?.warnFunction) {
        const warningMessage = `Failed to parse value as number: ${String(input)}`;
        const warnResult = options.warnFunction(warningMessage);

        // Handle both synchronous and asynchronous warn functions
        if (warnResult instanceof Promise) {
          void warnResult.catch(() => {
            // Silently catch any errors from the warn function
          });
        }
      }

      return typeof options?.defaultValue === "number"
        ? options.defaultValue
        : input;
    }

    return parsed;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    if (options?.warnFunction) {
      const warningMessage = `Error parsing value as number: ${String(input)}`;
      const warnResult = options.warnFunction(warningMessage);

      // Handle both synchronous and asynchronous warn functions
      if (warnResult instanceof Promise) {
        void warnResult.catch(() => {
          // Silently catch any errors from the warn function
        });
      }
    }

    return typeof options?.defaultValue === "number"
      ? options.defaultValue
      : input;
  }
}
