import RandomLib from "random";
import { ConfigurationError } from "@jaypie/errors";

//
// Types
//

interface RandomOptions {
  min?: number;
  max?: number;
  mean?: number;
  stddev?: number;
  integer?: boolean;
  start?: number;
  seed?: string;
  precision?: number;
  currency?: boolean;
}

type RandomFunction = {
  (options?: RandomOptions): number;
};

//
// Constants
//

export const DEFAULT_MIN = 0;
export const DEFAULT_MAX = 1;

//
// Helper Functions
//

/**
 * Clamps a number between optional minimum and maximum values
 * @param num - The number to clamp
 * @param min - Optional minimum value
 * @param max - Optional maximum value
 * @returns The clamped number
 */
const clamp = (num: number, min?: number, max?: number): number => {
  let result = num;
  if (typeof min === "number") result = Math.max(result, min);
  if (typeof max === "number") result = Math.min(result, max);
  return result;
};

/**
 * Validates that min is not greater than max
 * @param min - Optional minimum value
 * @param max - Optional maximum value
 * @throws {ConfigurationError} If min is greater than max
 */
const validateBounds = (
  min: number | undefined,
  max: number | undefined,
): void => {
  if (typeof min === "number" && typeof max === "number" && min > max) {
    throw new ConfigurationError(
      `Invalid bounds: min (${min}) cannot be greater than max (${max})`,
    );
  }
};

//
// Main
//

/**
 * Creates a random number generator with optional seeding
 *
 * @param defaultSeed - Seed string for the default RNG
 * @returns A function that generates random numbers based on provided options
 *
 * @example
 * const rng = random("default-seed");
 *
 * // Generate a random float between 0 and 1
 * const basic = rng();
 *
 * // Generate an integer between 1 and 10
 * const integer = rng({ min: 1, max: 10, integer: true });
 *
 * // Generate from normal distribution
 * const normal = rng({ mean: 50, stddev: 10 });
 *
 * // Use consistent seeding
 * const seeded = rng({ seed: "my-seed" });
 */
export function random(defaultSeed?: string): RandomFunction {
  // Initialize default seeded RNG
  const defaultRng = RandomLib.clone(defaultSeed);

  // Store per-seed RNGs
  const seedMap = new Map<string, ReturnType<typeof RandomLib.clone>>();

  const rngFn = ({
    min,
    max: providedMax,
    mean,
    stddev,
    integer = false,
    start = 0,
    seed,
    precision,
    currency = false,
  }: RandomOptions = {}): number => {
    // Select the appropriate RNG based on seed
    const rng = seed
      ? seedMap.get(seed) ||
        (() => {
          const newRng = RandomLib.clone(seed);
          seedMap.set(seed, newRng);
          return newRng;
        })()
      : defaultRng;

    // If only min is set, set max to min*2, but keep track of whether max was provided
    let max = providedMax;
    if (typeof min === "number" && typeof max !== "number") {
      max = min * 2;
    }

    validateBounds(min, max);

    // Determine effective precision based on parameters
    const getEffectivePrecision = (): number | undefined => {
      if (integer) return 0;

      const precisions: number[] = [];
      if (typeof precision === "number" && precision >= 0) {
        precisions.push(precision);
      }
      if (currency) {
        precisions.push(2);
      }

      // Return the lowest precision if any are set, undefined otherwise
      return precisions.length > 0 ? Math.min(...precisions) : undefined;
    };

    // Helper function to apply precision
    const applyPrecision = (value: number): number => {
      const effectivePrecision = getEffectivePrecision();
      if (typeof effectivePrecision === "number") {
        const factor = Math.pow(10, effectivePrecision);
        return Math.round(value * factor) / factor;
      }
      return value;
    };

    // Use normal distribution if both mean and stddev are provided
    if (typeof mean === "number" && typeof stddev === "number") {
      const normalDist = rng.normal(mean, stddev);
      const value = normalDist();

      // Only clamp if min/max are defined
      const clampedValue = clamp(value, min, providedMax);

      // Switch to uniform distribution only if both bounds were explicitly provided and exceeded
      if (
        typeof min === "number" &&
        typeof providedMax === "number" &&
        clampedValue !== value
      ) {
        const baseValue = integer ? rng.int(min, max) : rng.float(min, max);
        return applyPrecision(start + baseValue);
      }

      return applyPrecision(
        start + (integer ? Math.round(clampedValue) : clampedValue),
      );
    }

    // For uniform distribution, use defaults if min/max are undefined
    const uniformMin = typeof min === "number" ? min : DEFAULT_MIN;
    const uniformMax = typeof max === "number" ? max : DEFAULT_MAX;

    const baseValue = integer
      ? rng.int(uniformMin, uniformMax)
      : rng.float(uniformMin, uniformMax);
    return applyPrecision(start + baseValue);
  };

  return rngFn;
}
