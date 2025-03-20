import { LlmTool } from "../types/LlmTool.interface.js";
import random from "../util/random.js";

export const roll: LlmTool = {
  description: "Roll one or more dice with a specified number of sides",

  name: "roll",
  parameters: {
    number: {
      type: "number",
      description: "Number of dice to roll. Default: 1",
      optional: true,
    },
    sides: {
      type: "number",
      description: "Number of sides on each die. Default: 6",
      optional: true,
    },
  },
  type: "function",
  call: ({ number = 1, sides = 6 }) => {
    const rng = random();
    const rolls: number[] = [];
    let total = 0;

    for (let i = 0; i < number; i++) {
      const rollValue = rng({ min: 1, max: sides, integer: true });
      rolls.push(rollValue);
      total += rollValue;
    }

    return { rolls, total };
  },
};
