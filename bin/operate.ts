#!/usr/bin/env tsx

import "dotenv/config";

// Import directly from source files for development
import Llm from "../packages/llm/src/Llm.js";
import { tools } from "../packages/llm/src/tools/index.js";
import { z } from "zod";

const INSTRUCTIONS =
  "Provide crisp, punchy answers. Be direct and to the point. Avoid flowery language.";

async function main() {
  try {
    const model = new Llm();

    // Call the operate method with a simple message
    const result = await model.operate(
      // "What is the weather right now? Will it rain in the foreseeable future?",
      "Suggest some taco ingredients",
      {
        instructions: INSTRUCTIONS,
        format: {
          Filling: String,
          Sauce: String,
          Shell: String,
          Toppings: [String],
        },
        // tools,
      },
    );

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
