/* eslint-disable no-console */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

import { LLM, Llm } from "../src/index.js";
import type { LlmOcrResponse } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Walk up to the nearest .env: `npm run -w packages/llm` sets cwd to the
// package and would otherwise miss the repo-root file.
function loadEnv(): void {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, ".env");
    if (existsSync(candidate)) {
      config({ path: candidate });
      return;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  config();
}
loadEnv();

//
//
// Constants
//

/** Fixtures, or any documents named in APP_DOCUMENTS (comma-separated paths or URLs) */
const DEFAULT_DOCUMENTS = [
  join(__dirname, "fixtures/page.pdf"),
  join(__dirname, "fixtures/page.png"),
];

/** Strings the fixture pages contain; a caller-supplied document skips these */
const EXPECTED_FIXTURE_TEXT = ["mock page"];

/** Every OCR engine, cheapest LlamaParse tier first */
const MODELS: Array<{ label: string; model: string }> = [
  { label: "mistral", model: LLM.MODEL.MISTRAL.OCR },
  { label: "llamaparse fast", model: LLM.MODEL.LLAMAPARSE.FAST },
  {
    label: "llamaparse cost_effective",
    model: LLM.MODEL.LLAMAPARSE.COST_EFFECTIVE,
  },
  { label: "llamaparse agentic", model: LLM.MODEL.LLAMAPARSE.AGENTIC },
  {
    label: "llamaparse agentic_plus",
    model: LLM.MODEL.LLAMAPARSE.AGENTIC_PLUS,
  },
];

//
//
// Helpers
//

function fail(message: string): string[] {
  console.error(`  ✗ ${message}`);
  return [message];
}

function validate(response: LlmOcrResponse, expected: string[]): string[] {
  const errors: string[] = [];
  if (response.pages.length === 0) {
    errors.push(...fail("no pages returned"));
  }
  if (response.pages.some((page) => page.page < 1)) {
    errors.push(...fail("a page number is below 1"));
  }
  if (response.usage.pages < 1) {
    errors.push(...fail(`usage.pages is ${response.usage.pages}`));
  }
  const lower = response.markdown.toLowerCase();
  for (const text of expected) {
    if (!lower.includes(text)) {
      errors.push(...fail(`markdown does not contain "${text}"`));
    }
  }
  return errors;
}

function report(response: LlmOcrResponse, elapsedMs: number): void {
  const failed = response.pages.filter((page) => !page.success).length;
  console.log(`  model      ${response.model}`);
  console.log(`  provider   ${response.provider}`);
  console.log(
    `  pages      ${response.pages.length}${failed ? ` (${failed} failed)` : ""}`,
  );
  console.log(`  images     ${response.images.length}`);
  console.log(
    `  usage      ${response.usage.pages} page(s)${response.usage.credits !== undefined ? `, ${response.usage.credits} credits` : ""}${response.usage.cost !== undefined ? `, $${response.usage.cost.toFixed(4)}` : ""}`,
  );
  console.log(`  elapsed    ${(elapsedMs / 1000).toFixed(1)}s`);
  const preview = response.markdown.replace(/\s+/g, " ").trim().slice(0, 160);
  console.log(
    `  markdown   ${preview}${response.markdown.length > 160 ? "…" : ""}`,
  );
}

//
//
// Test Functions
//

async function testDocument({
  document,
  expected,
  label,
  model,
}: {
  document: string;
  expected: string[];
  label: string;
  model: string;
}): Promise<boolean> {
  const name = document.split("/").pop();
  console.log(`\n============ OCR Test: ${label} (${model}) — ${name}`);
  const started = Date.now();
  try {
    const response = await Llm.ocr(document, {
      images: process.env.APP_IMAGES === "true",
      model,
    });
    report(response, Date.now() - started);
    const errors = validate(response, expected);
    if (errors.length === 0) {
      console.log("  ✓ passed");
      return true;
    }
    return false;
  } catch (error) {
    console.error(`  ✗ ${(error as Error).message}`);
    return false;
  }
}

/** A chain that starts on a tier nothing serves proves the fallback path. */
async function testFallback(document: string): Promise<boolean> {
  console.log("\n============ OCR Test: fallback chain");
  try {
    const response = await Llm.ocr(document, {
      model: ["llamaparse-does-not-exist", LLM.MODEL.MISTRAL.OCR],
    });
    report(response, 0);
    if (!response.fallbackUsed || response.fallbackAttempts !== 2) {
      console.error(
        `  ✗ expected a fallback, got attempts=${response.fallbackAttempts} used=${response.fallbackUsed}`,
      );
      return false;
    }
    console.log("  ✓ passed");
    return true;
  } catch (error) {
    console.error(`  ✗ ${(error as Error).message}`);
    return false;
  }
}

//
//
// Main
//

async function main(): Promise<void> {
  const only = process.env.APP_MODELS?.split(",").map((entry) => entry.trim());
  const selected = only
    ? MODELS.filter(({ model }) => only.includes(model))
    : MODELS;
  const custom = process.env.APP_DOCUMENTS?.split(",").map((entry) =>
    entry.trim(),
  );
  const documents = custom?.length ? custom : DEFAULT_DOCUMENTS;
  const expected = custom?.length ? [] : EXPECTED_FIXTURE_TEXT;

  let passed = 0;
  let failed = 0;
  for (const entry of selected) {
    for (const document of documents) {
      if (await testDocument({ ...entry, document, expected })) {
        passed++;
      } else {
        failed++;
      }
    }
  }
  if (!only && !custom) {
    if (await testFallback(documents[0])) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log("\n\n========================================");
  console.log("       SUMMARY");
  console.log("========================================");
  console.log(`OCR Tests: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.error("\n💀 Exiting with failed tests");
    process.exit(1);
  } else if (passed > 0) {
    console.log("\n🎉 All tests passed");
  } else {
    console.log("\n⚠️ No tests ran");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
