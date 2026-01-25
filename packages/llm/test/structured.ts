/* eslint-disable no-console */
import { config } from "dotenv";

import { LLM, Llm } from "../src/index.js";

config();

//
//
// Constants
//

const REQUEST =
  "Analyze the following text and extract the key information:\n\n" +
  '"The quick brown fox jumps over the lazy dog. ' +
  "This pangram contains every letter of the English alphabet. " +
  'It is commonly used for font testing and typing practice."';

// Models to test for each provider
const MODELS = {
  anthropic: LLM.PROVIDER.ANTHROPIC.MODEL.SMALL,
  gemini: LLM.PROVIDER.GEMINI.MODEL.SMALL,
  openai: LLM.PROVIDER.OPENAI.MODEL.SMALL,
  openrouter: LLM.PROVIDER.OPENROUTER.MODEL.SMALL,
} as const;

// Natural schema format for structured output
const FORMAT = {
  animals: [String],
  main_topic: String,
  sentence_count: Number,
  use_cases: [String],
};

// Expected values for validation
const EXPECTED = {
  animals: ["fox", "dog"],
  mainTopicKeywords: ["pangram", "alphabet", "letter"],
  sentenceCount: 3,
  useCasesKeywords: ["font", "typing", "test"],
};

//
//
// Types
//

interface StructuredResult {
  animals?: string[];
  main_topic?: string;
  sentence_count?: number;
  use_cases?: string[];
}

//
//
// Helpers
//

function validateResult(
  result: StructuredResult,
  provider: string,
): { errors: string[]; passed: boolean } {
  const errors: string[] = [];

  // Check animals array
  if (!Array.isArray(result.animals)) {
    errors.push(`animals should be an array, got ${typeof result.animals}`);
  } else {
    const animalsLower = result.animals.map((a) => a.toLowerCase());
    for (const expected of EXPECTED.animals) {
      if (!animalsLower.some((a) => a.includes(expected))) {
        errors.push(`animals should include "${expected}"`);
      }
    }
  }

  // Check main_topic string
  if (typeof result.main_topic !== "string") {
    errors.push(
      `main_topic should be a string, got ${typeof result.main_topic}`,
    );
  } else {
    const topicLower = result.main_topic.toLowerCase();
    const hasKeyword = EXPECTED.mainTopicKeywords.some((kw) =>
      topicLower.includes(kw),
    );
    if (!hasKeyword) {
      errors.push(
        `main_topic should include one of: ${EXPECTED.mainTopicKeywords.join(", ")}`,
      );
    }
  }

  // Check sentence_count number
  if (typeof result.sentence_count !== "number") {
    errors.push(
      `sentence_count should be a number, got ${typeof result.sentence_count}`,
    );
  } else if (result.sentence_count !== EXPECTED.sentenceCount) {
    // Allow some flexibility - LLMs might count differently
    if (result.sentence_count < 2 || result.sentence_count > 4) {
      errors.push(
        `sentence_count should be around ${EXPECTED.sentenceCount}, got ${result.sentence_count}`,
      );
    }
  }

  // Check use_cases array
  if (!Array.isArray(result.use_cases)) {
    errors.push(`use_cases should be an array, got ${typeof result.use_cases}`);
  } else {
    const useCasesLower = result.use_cases.map((u) => u.toLowerCase());
    const hasKeyword = EXPECTED.useCasesKeywords.some((kw) =>
      useCasesLower.some((u) => u.includes(kw)),
    );
    if (!hasKeyword) {
      errors.push(
        `use_cases should include one of: ${EXPECTED.useCasesKeywords.join(", ")}`,
      );
    }
  }

  if (errors.length > 0) {
    console.error(`Validation errors for ${provider}:`);
    errors.forEach((e) => console.error(`  - ${e}`));
  }

  return { errors, passed: errors.length === 0 };
}

function tryParseJson(content: unknown): StructuredResult | null {
  if (typeof content === "object" && content !== null) {
    return content as StructuredResult;
  }

  if (typeof content !== "string") {
    return null;
  }

  // Try direct JSON parse
  try {
    return JSON.parse(content) as StructuredResult;
  } catch {
    // Not valid JSON
  }

  // Try to extract JSON from markdown code blocks
  const jsonBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1].trim()) as StructuredResult;
    } catch {
      // Not valid JSON in code block
    }
  }

  return null;
}

//
//
// Test Functions
//

async function testProvider(provider: string, model: string): Promise<boolean> {
  try {
    console.log(`\n============ Structured JSON Test: ${provider} (${model})`);

    const llm = new Llm(provider, { model });

    const result = await llm.operate(REQUEST, {
      format: FORMAT,
      user: process?.env?.APP_USER || "[structured] Jaypie User",
    });

    if (result.error) {
      console.error(`Error for ${provider}:`, result.error);
      return false;
    }

    console.log(`Raw content type: ${typeof result.content}`);

    // Try to parse the content as structured JSON
    const structured = tryParseJson(result.content);

    if (!structured) {
      console.error(`Failed to parse structured output for ${provider}`);
      console.error(`Content received:`, result.content);
      return false;
    }

    console.log(`Parsed result:`, JSON.stringify(structured, null, 2));

    const { passed } = validateResult(structured, provider);

    if (passed) {
      console.log(`✅ Structured JSON test passed for ${provider}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error for ${provider}:`, error);
    return false;
  }
}

async function testOpenAI(): Promise<boolean> {
  return testProvider("openai", MODELS.openai);
}

async function testAnthropic(): Promise<boolean> {
  return testProvider("anthropic", MODELS.anthropic);
}

async function testGemini(): Promise<boolean> {
  return testProvider("gemini", MODELS.gemini);
}

async function testOpenRouter(): Promise<boolean> {
  return testProvider("openrouter", MODELS.openrouter);
}

//
//
// Test Runners
//

async function runTests(): Promise<{ failed: number; passed: number }> {
  console.log("\n\n========================================");
  console.log("       STRUCTURED JSON TESTS");
  console.log("========================================");

  const results = {
    failed: 0,
    passed: 0,
  };

  const providers = process.env.APP_PROVIDER
    ? process.env.APP_PROVIDER.split(",").map((p) => p.trim())
    : [];

  if (providers.length === 0) {
    console.log("No providers specified, running all structured JSON tests...");
    // Run all by default
    const tests = [testAnthropic, testGemini, testOpenAI, testOpenRouter];
    for (const test of tests) {
      const success = await test();
      if (success) {
        results.passed++;
      } else {
        results.failed++;
      }
    }
  } else {
    for (const provider of providers) {
      let success = false;
      switch (provider.toLowerCase()) {
        case "anthropic":
          success = await testAnthropic();
          break;
        case "gemini":
          success = await testGemini();
          break;
        case "openai":
          success = await testOpenAI();
          break;
        case "openrouter":
          success = await testOpenRouter();
          break;
        default:
          console.error(`Unknown provider: ${provider}`);
          results.failed++;
          continue;
      }
      if (success) {
        results.passed++;
      } else {
        results.failed++;
      }
    }
  }

  return results;
}

async function main() {
  const results = await runTests();

  console.log("\n\n========================================");
  console.log("       SUMMARY");
  console.log("========================================");

  console.log(
    `Structured JSON Tests: ${results.passed} passed, ${results.failed} failed`,
  );

  if (results.failed > 0) {
    console.error("\n💀 Exiting with failed tests");
    process.exit(1);
  } else if (results.passed > 0) {
    console.log("\n🎉 All tests passed");
  } else {
    console.log("\n⚠️ No tests ran");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
