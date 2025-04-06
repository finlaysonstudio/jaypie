import { LlmTool } from "../types/LlmTool.interface.js";
import { random as randomUtil } from "../util/random.js";

export const random: LlmTool = {
  description:
    "Generate a random number with optional distribution, precision, range, and seeding",

  name: "random",
  parameters: {
    type: "object",
    properties: {
      min: {
        type: "number",
        description:
          "Minimum value (inclusive). Default: 0. When used with mean/stddev, acts as a clamp on the normal distribution",
      },
      max: {
        type: "number",
        description:
          "Maximum value (inclusive). Default: 1. When used with mean/stddev, acts as a clamp on the normal distribution",
      },
      mean: {
        type: "number",
        description:
          "Mean value for normal distribution. When set with stddev, uses normal distribution (clamped by min/max if provided)",
      },
      stddev: {
        type: "number",
        description:
          "Standard deviation for normal distribution. When set with mean, uses normal distribution (clamped by min/max if provided)",
      },
      integer: {
        type: "boolean",
        description: "Whether to return an integer value. Default: false",
      },
      seed: {
        type: "string",
        description:
          "Seed string for consistent random generation. Default: undefined (uses default RNG)",
      },
      precision: {
        type: "number",
        description:
          "Number of decimal places for the result. Default: undefined (full precision)",
      },
      currency: {
        type: "boolean",
        description:
          "Whether to format as currency (2 decimal places). Default: false",
      },
    },
    required: [],
  },
  type: "function",
  call: (options) => {
    const rng = randomUtil();
    return rng(options);
  },
};
