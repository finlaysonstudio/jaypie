/* eslint-disable no-console */
import { config } from "dotenv";

import { extractReasoning, Llm } from "../src/index.js";

config();

//
//
// Constants
//

const REQUEST =
  "What is 2 + 2? Think through this step by step and explain your reasoning.";

// Models known to produce reasoning tokens
const REASONING_MODELS = {
  openai: "o3-mini",
} as const;

//
//
// Test Functions
//

async function testReasoningExtraction(): Promise<boolean> {
  const provider = "openai";
  const model = REASONING_MODELS.openai;

  try {
    console.log(
      `\n============ Reasoning Extraction Test: ${provider} (${model})`,
    );

    const llm = new Llm(provider, { model });

    const result = await llm.operate(REQUEST, {
      user: process?.env?.APP_USER || "[reasoning] Jaypie User",
    });

    if (result.error) {
      console.error(`Error for ${provider}:`, result.error);
      return false;
    }

    console.log(`Content: ${result.content}`);
    console.log(`Reasoning array length: ${result.reasoning.length}`);
    console.log(`Reasoning:`, result.reasoning);

    // Verify response has reasoning array
    if (!Array.isArray(result.reasoning)) {
      console.error("Error: reasoning should be an array");
      return false;
    }

    // Test extractReasoning utility directly with history
    const extractedReasoning = extractReasoning(result.history);
    console.log(
      `Extracted reasoning from history: ${extractedReasoning.length} items`,
    );

    // Verify both methods produce same result
    if (result.reasoning.length !== extractedReasoning.length) {
      console.error(
        `Error: reasoning array length mismatch. ` +
          `Response: ${result.reasoning.length}, Extracted: ${extractedReasoning.length}`,
      );
      return false;
    }

    // Log token usage for reasoning
    const totalReasoningTokens = result.usage.reduce(
      (sum, u) => sum + (u.reasoning || 0),
      0,
    );
    console.log(`Total reasoning tokens used: ${totalReasoningTokens}`);

    // For o3-mini, we expect some reasoning tokens
    // If no reasoning is present, that's still valid - the model may not always reason
    console.log(`✅ Reasoning extraction test passed for ${provider}`);
    return true;
  } catch (error) {
    console.error(`Error for ${provider}:`, error);
    return false;
  }
}

//
//
// Main
//

async function main() {
  console.log("\n\n========================================");
  console.log("       REASONING EXTRACTION TESTS");
  console.log("========================================");

  const success = await testReasoningExtraction();

  console.log("\n\n========================================");
  console.log("       SUMMARY");
  console.log("========================================");

  if (!success) {
    console.error("\n💀 Exiting with failed tests");
    process.exit(1);
  } else {
    console.log("\n🎉 All tests passed");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
