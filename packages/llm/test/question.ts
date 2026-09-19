/* eslint-disable no-console */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

import { LLM, Llm } from "../src/index.js";
import type {
  LlmChoiceAnswer,
  LlmNoulAnswer,
  LlmQuestionResponse,
  LlmQuestions,
  LlmScoreAnswer,
} from "../src/index.js";

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

const STATE = [
  "Subject: Charged twice!",
  "",
  "I have been charged twice for my September invoice and nobody has replied",
  "in three days. Cancel my account if this is not fixed today.",
].join("\n");

/** One question of each type, asked of every model in the same shape. */
const QUESTIONS: LlmQuestions = {
  department: {
    criteria: {
      billing: "Charges, invoices, refunds, payment disputes",
      sales: null,
      technical: "Bugs, outages, broken features",
    },
    instructions: "Which team should handle this message?",
    type: "choice",
  },
  frustration: {
    criteria: ["Calm", "Frustrated", "Very angry"],
    instructions: "How frustrated is the customer?",
    type: "score",
  },
  is_urgent: {
    instructions: "Does this message convey urgency?",
    type: "noul",
  },
};

/** What a correct answer looks like, whoever serves it. */
const EXPECTED = {
  choice: "billing",
  noulAtLeast: 0.5,
  scoreAtLeast: 1,
};

/** Jev natively, then one already-supported model per provider by emulation. */
const MODELS: Array<{ label: string; model: string }> = [
  { label: "typesafe (native)", model: LLM.MODEL.JEV },
  { label: "anthropic (emulated)", model: LLM.MODEL.HAIKU },
  { label: "openai (emulated)", model: LLM.MODEL.LUNA },
];

//
//
// Helpers
//

function fail(message: string): string[] {
  console.error(`  ✗ ${message}`);
  return [message];
}

function validate(response: LlmQuestionResponse): string[] {
  const errors: string[] = [];
  const ids = Object.keys(QUESTIONS);
  for (const id of ids) {
    if (!response.answers[id]) {
      errors.push(...fail(`missing answer for "${id}"`));
    }
  }
  if (errors.length > 0) {
    return errors;
  }

  const choice = response.answers.department as LlmChoiceAnswer;
  if (choice.type !== "choice") {
    errors.push(...fail(`department answered as ${choice.type}`));
  } else {
    if (choice.choice !== EXPECTED.choice) {
      errors.push(
        ...fail(
          `department is "${choice.choice}", expected "${EXPECTED.choice}"`,
        ),
      );
    }
    const total = Object.values(choice.probabilities).reduce(
      (sum, p) => sum + p,
      0,
    );
    if (Math.abs(total - 1) > 0.01) {
      errors.push(
        ...fail(`department probabilities sum to ${total.toFixed(3)}`),
      );
    }
    if (Object.keys(choice.probabilities).length !== 3) {
      errors.push(
        ...fail("department probabilities do not cover every option"),
      );
    }
    if (choice.confidence < 0 || choice.confidence > 1) {
      errors.push(
        ...fail(`department confidence out of range: ${choice.confidence}`),
      );
    }
  }

  const noul = response.answers.is_urgent as LlmNoulAnswer;
  if (noul.type !== "noul") {
    errors.push(...fail(`is_urgent answered as ${noul.type}`));
  } else if (noul.noul < EXPECTED.noulAtLeast) {
    errors.push(
      ...fail(
        `is_urgent is ${noul.noul}, expected at least ${EXPECTED.noulAtLeast}`,
      ),
    );
  }

  const score = response.answers.frustration as LlmScoreAnswer;
  if (score.type !== "score") {
    errors.push(...fail(`frustration answered as ${score.type}`));
  } else {
    if (score.score < EXPECTED.scoreAtLeast) {
      errors.push(
        ...fail(
          `frustration is ${score.score}, expected at least ${EXPECTED.scoreAtLeast}`,
        ),
      );
    }
    if (score.score < 0 || score.score > 2) {
      errors.push(
        ...fail(`frustration outside the 0..2 level range: ${score.score}`),
      );
    }
    if (Object.keys(score.legend).length !== 3) {
      errors.push(...fail("frustration legend does not cover every level"));
    }
  }

  return errors;
}

function report(response: LlmQuestionResponse): void {
  const choice = response.answers.department as LlmChoiceAnswer;
  const noul = response.answers.is_urgent as LlmNoulAnswer;
  const score = response.answers.frustration as LlmScoreAnswer;
  console.log(
    `  model      ${response.model} (emulated: ${response.emulated})`,
  );
  console.log(
    `  choice     ${choice.choice} @ ${choice.confidence.toFixed(2)} ${JSON.stringify(choice.probabilities)}`,
  );
  console.log(`  noul       ${noul.noul}`);
  console.log(
    `  score      ${score.score.toFixed(2)} @ ${score.confidence.toFixed(2)} ${JSON.stringify(score.probabilities)}`,
  );
  const usage = response.usage.reduce((sum, item) => sum + item.total, 0);
  console.log(`  usage      ${usage} tokens`);
}

//
//
// Test Functions
//

async function testModel({
  label,
  model,
}: {
  label: string;
  model: string;
}): Promise<boolean> {
  console.log(`\n============ Question Test: ${label} (${model})`);
  try {
    const response = await Llm.question(STATE, {
      model,
      questions: QUESTIONS,
      user: process.env.APP_USER || "[question] Jaypie User",
    });
    report(response);
    const errors = validate(response);
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

/** A chain that starts on a model nothing serves proves the fallback path. */
async function testFallback(): Promise<boolean> {
  console.log("\n============ Question Test: fallback chain");
  try {
    const response = await Llm.question(STATE, {
      model: ["jev-does-not-exist", LLM.MODEL.HAIKU],
      questions: QUESTIONS,
    });
    report(response);
    if (!response.fallbackUsed || response.fallbackAttempts !== 2) {
      console.error(
        `  ✗ expected a fallback, got attempts=${response.fallbackAttempts} used=${response.fallbackUsed}`,
      );
      return false;
    }
    if (!response.emulated) {
      console.error("  ✗ expected the fallback answer to be emulated");
      return false;
    }
    const errors = validate(response);
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

//
//
// Main
//

async function main(): Promise<void> {
  const only = process.env.APP_MODELS?.split(",").map((entry) => entry.trim());
  const selected = only
    ? MODELS.filter(({ model }) => only.includes(model))
    : MODELS;

  let passed = 0;
  let failed = 0;
  for (const entry of selected) {
    if (await testModel(entry)) {
      passed++;
    } else {
      failed++;
    }
  }
  if (!only) {
    if (await testFallback()) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log("\n\n========================================");
  console.log("       SUMMARY");
  console.log("========================================");
  console.log(`Question Tests: ${passed} passed, ${failed} failed`);

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
