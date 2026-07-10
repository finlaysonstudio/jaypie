/* eslint-disable no-console */
import { config } from "dotenv";

import { LLM, Llm } from "../src/index.js";

config();

//
//
// Constants
//

// Mirrors the production report in issue #393: a mix of single- and multi-word
// `format` keys plus declared arrays. The multi-word keys are the trap — when
// strict structured-output enforcement is silently disabled (e.g. OpenAI was
// shipped zod v4's `$schema` keyword), the model free-forms: it wraps
// multi-word keys in literal double quotes and/or omits empty declared arrays.
const REQUEST =
  "A merchant submitted a refund request for a damaged item and attached one " +
  "photo. Summarize the situation and assess it.";

const FORMAT = {
  "Merchant Request": String,
  "Merchant Attachments": [String],
  Confidence: Number,
  Summary: String,
  "Fulfilled Requirements": [String],
  "Unfulfilled Requirements": [String],
  "Recommended Actions": [String],
} as const;

const EXPECTED_KEYS = Object.keys(FORMAT).sort();

// Models to test for each provider (smallest of each, like structured.ts)
const MODELS = {
  anthropic: LLM.MODEL.HAIKU,
  google: LLM.MODEL.GEMINI_FLASH,
  openai: LLM.MODEL.TERRA,
  openrouter: LLM.MODEL.OPENROUTER.GLM,
  xai: LLM.MODEL.GROK,
} as const;

//
//
// Helpers
//

// Verify the returned content honors the declared `format` contract exactly:
// keys match verbatim (no quote-wrapping, none missing) and declared arrays are
// present as arrays. This is the universal invariant every provider must hold.
function validateKeys(
  content: unknown,
  provider: string,
): { errors: string[]; passed: boolean } {
  const errors: string[] = [];

  if (typeof content !== "object" || content === null) {
    errors.push(`content should be an object, got ${typeof content}`);
    return { errors, passed: false };
  }

  const record = content as Record<string, unknown>;
  const actualKeys = Object.keys(record).sort();

  const quoted = actualKeys.filter((k) => k.startsWith('"') && k.endsWith('"'));
  if (quoted.length > 0) {
    errors.push(`keys wrapped in literal double quotes: ${quoted.join(", ")}`);
  }

  for (const key of EXPECTED_KEYS) {
    if (!(key in record)) {
      errors.push(`missing declared key "${key}"`);
    }
  }

  const unexpected = actualKeys.filter((k) => !EXPECTED_KEYS.includes(k));
  if (unexpected.length > 0) {
    errors.push(`unexpected keys: ${unexpected.join(", ")}`);
  }

  for (const key of [
    "Merchant Attachments",
    "Fulfilled Requirements",
    "Unfulfilled Requirements",
    "Recommended Actions",
  ]) {
    if (key in record && !Array.isArray(record[key])) {
      errors.push(`"${key}" should be an array, got ${typeof record[key]}`);
    }
  }

  if (errors.length > 0) {
    console.error(`Validation errors for ${provider}:`);
    errors.forEach((e) => console.error(`  - ${e}`));
  }

  return { errors, passed: errors.length === 0 };
}

//
//
// Test Functions
//

async function testProvider(provider: string, model: string): Promise<boolean> {
  try {
    const effectiveModel = process.env.APP_MODEL || model;
    console.log(
      `\n============ Multi-word Format Keys: ${provider} (${effectiveModel})`,
    );

    const llm = new Llm(provider, { model: effectiveModel });

    const result = await llm.operate(REQUEST, {
      format: FORMAT,
      user: process?.env?.APP_USER || "[format] Jaypie User",
    });

    if (result.error) {
      console.error(`Error for ${provider}:`, result.error);
      return false;
    }

    console.log(`Actual keys:`, Object.keys(result.content ?? {}));

    const { passed } = validateKeys(result.content, provider);

    if (passed) {
      console.log(`✅ Multi-word format key test passed for ${provider}`);
      return true;
    }

    console.error(`Content received:`, JSON.stringify(result.content, null, 2));
    return false;
  } catch (error) {
    console.error(`Error for ${provider}:`, error);
    return false;
  }
}

//
//
// Test Runner
//

async function run() {
  console.log("\n========================================");
  console.log("     MULTI-WORD FORMAT KEY TESTS");
  console.log("========================================");

  // Default to OpenAI (where #393 was observed); override with APP_PROVIDER.
  const providers = process.env.APP_PROVIDER
    ? process.env.APP_PROVIDER.split(",").map((p) => p.trim())
    : ["openai"];

  let hasError = false;
  for (const provider of providers) {
    const model = MODELS[provider as keyof typeof MODELS];
    if (!model && !process.env.APP_MODEL) {
      console.error(`\n❌ Unknown provider "${provider}" (no model)`);
      hasError = true;
      continue;
    }
    const success = await testProvider(provider, model);
    if (!success) {
      console.error(`\n❌ Failed for provider "${provider}"`);
      hasError = true;
    }
  }

  if (hasError) {
    console.error("\n💀 Exiting with failure");
    process.exit(1);
  } else {
    console.log("\n🎉 Success");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
