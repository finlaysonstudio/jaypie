#!/usr/bin/env tsx

import "dotenv/config";

// Import directly from source files for development
import Llm from "../packages/llm/src/Llm.js";
import { tools } from "../packages/llm/src/tools/index.js";

const INSTRUCTIONS =
  "Provide crisp, punchy answers. Be direct and to the point. Avoid flowery language.";

async function playYahtzee() {
  const model = new Llm();
  const result = await model.operate(
    "Roll five 6-sided dice. Tell me the best Yahtzee score in the upper section, the best non-chance score in the lower section, the best chance score, and which category the highest of the three is (e.g., 'Ones', 'Full House', 'Chance'). Include the dice roll.",
    {
      explain: true,
      format: {
        Upper: String,
        Lower: String,
        Chance: String,
        Category: String,
        Dice: [Number],
      },
      instructions: INSTRUCTIONS,
      tools,
    },
  );
  return result;
}

async function suggestTaco() {
  const model = new Llm();
  const result = await model.operate("Suggest some taco ingredients", {
    instructions: INSTRUCTIONS,
    format: {
      Shell: String,
      Filling: String,
      Toppings: [String],
      Sauce: String,
    },
    tools,
    providerOptions: {
      temperature: 0.25,
    },
  });
  return result;
}

async function getWeather() {
  const model = new Llm();
  const result = await model.operate(
    "Tell me the current weather and any forecast for rain or other precipitation.",
    {
      instructions: INSTRUCTIONS,
      tools,
    },
  );
  return result;
}

async function main() {
  try {
    // Get the operation parameter from command line arguments
    const param = process.argv[2] || "weather"; // Default to weather if no parameter provided

    let result;

    // Choose operation based on parameter
    switch (param.toLowerCase()) {
      case "roll":
      case "yahtzee":
        result = await playYahtzee();
        break;
      case "taco":
        result = await suggestTaco();
        break;
      case "weather":
      default:
        result = await getWeather();
        break;
    }

    // Output the results
    const outputs = result.map((r) => r.output);

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(outputs, null, 2));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
