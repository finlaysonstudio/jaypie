import { LlmTool } from "../types/LlmTool.interface.js";
import randomUtil from "../util/random.js";

export const random: LlmTool = {
  description:
    "Generate a random number with optional distribution, precision, range, and seeding",

  name: "random",
  parameters: {
    min: {
      type: "number",
      description:
        "Minimum value (inclusive). Default: 0. When used with mean/stddev, acts as a clamp on the normal distribution",
      optional: true,
    },
    max: {
      type: "number",
      description:
        "Maximum value (inclusive). Default: 1. When used with mean/stddev, acts as a clamp on the normal distribution",
      optional: true,
    },
    mean: {
      type: "number",
      description:
        "Mean value for normal distribution. When set with stddev, uses normal distribution (clamped by min/max if provided)",
      optional: true,
    },
    stddev: {
      type: "number",
      description:
        "Standard deviation for normal distribution. When set with mean, uses normal distribution (clamped by min/max if provided)",
      optional: true,
    },
    integer: {
      type: "boolean",
      description: "Whether to return an integer value. Default: false",
      optional: true,
    },
    seed: {
      type: "string",
      description:
        "Seed string for consistent random generation. Default: undefined (uses default RNG)",
      optional: true,
    },
    precision: {
      type: "number",
      description:
        "Number of decimal places for the result. Default: undefined (full precision)",
      optional: true,
    },
    currency: {
      type: "boolean",
      description:
        "Whether to format as currency (2 decimal places). Default: false",
      optional: true,
    },
  },
  type: "function",
  execute: (options) => {
    const rng = randomUtil();
    return rng(options);
  },
};
