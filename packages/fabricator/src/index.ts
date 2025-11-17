/* eslint-disable no-redeclare */

// Export Fabricator classes and types
export { Fabricator, type FabricatorOptions } from "./Fabricator.js";

// Re-import Fabricator for the function
import { Fabricator, type FabricatorOptions } from "./Fabricator.js";

/**
 * Creates and returns a new Fabricator instance with optional seeding
 * Supports multiple signatures:
 * - fabricator()
 * - fabricator(seed)
 * - fabricator(seed, options)
 * - fabricator(options)
 */
export function fabricator(): Fabricator;
export function fabricator(seed: string | number): Fabricator;
export function fabricator(
  seed: string | number,
  options: FabricatorOptions,
): Fabricator;
export function fabricator(options: FabricatorOptions): Fabricator;
export function fabricator(
  seedOrOptions?: string | number | FabricatorOptions,
  options?: FabricatorOptions,
): Fabricator {
  if (typeof seedOrOptions === "object" && seedOrOptions !== null) {
    // Called as: fabricator(options)
    return new Fabricator(seedOrOptions);
  } else if (options) {
    // Called as: fabricator(seed, options)
    // seedOrOptions must be string | number here since it's not an object
    return new Fabricator(seedOrOptions as string | number, options);
  } else if (seedOrOptions !== undefined) {
    // Called as: fabricator(seed)
    return new Fabricator(seedOrOptions);
  } else {
    // Called as: fabricator()
    return new Fabricator();
  }
}

// Export random function and types
export { DEFAULT_MIN, DEFAULT_MAX, random } from "./random.js";
export type { RandomOptions, RandomFunction } from "./random.js";

// Export types and utilities
export * from "./util";

// Export constants
export * from "./constants.js";
