#!/usr/bin/env tsx

import "dotenv/config";

// Import directly from source files for development
import Llm from "../packages/llm/src/Llm.js";

async function main() {
  try {
    const model = new Llm();

    // Call the operate method with a simple message
    const result = await model.operate("hello, world");

    // Output the result
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
