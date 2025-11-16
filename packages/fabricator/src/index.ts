// Export Fabricator class
export { Fabricator } from "./Fabricator.js";

// Re-import Fabricator for the function
import { Fabricator } from "./Fabricator.js";

/**
 * Creates and returns a new Fabricator instance with optional seeding
 * @param seed - Optional seed (string or number) for deterministic data generation
 * @returns A new Fabricator instance
 */
export function fabricator(seed?: string | number): Fabricator {
  return new Fabricator(seed);
}

// Export random function and types
export { DEFAULT_MIN, DEFAULT_MAX, random } from "./random.js";
export type { RandomOptions, RandomFunction } from "./random.js";

// Export types and utilities
export * from "./util";

// Export constants
export * from "./constants.js";
