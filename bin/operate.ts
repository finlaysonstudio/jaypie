#!/usr/bin/env tsx

import "dotenv/config";

// Import directly from source files for development
import Llm from "../packages/llm/src/Llm.js";
import { tools } from "../packages/llm/src/tools/index.js";

async function main() {
  try {
    const model = new Llm();

    // Call the operate method with a simple message
    const result = await model.operate(
      "Roll five six-sided dice and tell me how many points it is worth in Yahtzee",
      {
        instructions: "Respond in one-word answers whenever possible.",
        tools,
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
