import { LlmOperateOptions } from "../types/LlmProvider.interface.js";

// Turn policy constants
export const MAX_TURNS_ABSOLUTE_LIMIT = 72;
export const MAX_TURNS_DEFAULT_LIMIT = 12;

/**
 * Determines the maximum number of turns based on the provided options
 * 
 * @param options - The LLM operate options
 * @returns The maximum number of turns
 */
export function maxTurnsFromOptions(options: LlmOperateOptions): number {
  // Default to single turn (1) when turns are disabled

  // Handle the turns parameter
  if (options.turns === undefined) {
    // Default to default limit when undefined
    return MAX_TURNS_DEFAULT_LIMIT;
  } else if (options.turns === true) {
    // Explicitly set to true
    return MAX_TURNS_DEFAULT_LIMIT;
  } else if (typeof options.turns === "number") {
    if (options.turns > 0) {
      // Positive number - use that limit (capped at absolute limit)
      return Math.min(options.turns, MAX_TURNS_ABSOLUTE_LIMIT);
    } else if (options.turns < 0) {
      // Negative number - use default limit
      return MAX_TURNS_DEFAULT_LIMIT;
    }
    // If turns is 0, return 1 (disabled)
    return 1;
  }
  // All other values (false, null, etc.) will return 1 (disabled)
  return 1;
}
