import { LlmTool } from "../types/LlmTool.interface.js";
import { log, random, tryParseNumber } from "../util";

export const roll: LlmTool = {
  description: "Roll one or more dice with a specified number of sides",
  name: "roll",
  parameters: {
    type: "object",
    properties: {
      number: {
        type: "number",
        description: "Number of dice to roll. Default: 1",
      },
      sides: {
        type: "number",
        description: "Number of sides on each die. Default: 6",
      },
    },
    required: ["number", "sides"],
  },
  type: "function",
  call: ({ number = 1, sides = 6 } = {}): {
    rolls: number[];
    total: number;
  } => {
    const rng = random();
    const rolls: number[] = [];
    let total = 0;

    const parsedNumber = tryParseNumber(number, {
      defaultValue: 1,
      warnFunction: log.warn,
    }) as number;
    const parsedSides = tryParseNumber(sides, {
      defaultValue: 6,
      warnFunction: log.warn,
    }) as number;

    for (let i = 0; i < parsedNumber; i++) {
      const rollValue = rng({ min: 1, max: parsedSides, integer: true });
      rolls.push(rollValue);
      total += rollValue;
    }

    return { rolls, total };
  },
  message: ({ number = 1, sides = 6 } = {}) => {
    return `Rolling ${number} ${sides}-sided dice`;
  },
};
