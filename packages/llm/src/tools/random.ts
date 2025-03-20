import { LlmTool } from "../types/LlmTool.interface.js";

export const random: LlmTool = {
  description: "Generate a random number within a specified range",
  name: "random",
  parameters: {
    min: {
      type: "number",
      description: "Minimum value (inclusive)",
    },
    max: {
      type: "number",
      description: "Maximum value (inclusive)",
    },
  },
  type: "function",
  execute: ([min, max]) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
};
