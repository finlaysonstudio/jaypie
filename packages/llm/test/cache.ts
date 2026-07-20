/* eslint-disable no-console */
import { config } from "dotenv";

import { Llm, LLM } from "../src/index.js";
import type { LlmCache } from "../src/index.js";
import type { LlmUsageItem } from "../src/types/LlmProvider.interface.js";

config();

//
//
// Constants
//

// A large, byte-stable system prompt. Prompt caching only engages above the
// model's minimum cacheable prefix (~1024 tokens for Claude Sonnet, 4096 for
// Opus 4.8), so this is padded well past that. It must stay identical across
// calls for the cache to hit — no timestamps, no per-call interpolation.
const SYSTEM = [
  "You are a meticulous technical writer embedded in a software team.",
  "Answer precisely and concisely. Prefer plain language over jargon.",
  "The following is reference material you must keep in mind at all times.",
  ...Array.from(
    { length: 120 },
    (_unused, i) =>
      `Reference note ${i + 1}: Jaypie is a complete-stack toolkit for AWS ` +
      `CDK, Datadog, and TypeScript. It provides secrets handling, error ` +
      `types, event parsing, lifecycle management, structured logging, and ` +
      `queue messaging, plus an LLM provider abstraction across Anthropic, ` +
      `OpenAI, Google, OpenRouter, and Bedrock. Keep responses consistent ` +
      `with these conventions and never contradict prior reference notes.`,
  ),
].join("\n");

const INPUT = "In one sentence, what does Jaypie provide?";

//
//
// Helpers
//

function inferProvider(model: string): string {
  if (model.startsWith("claude")) return "anthropic";
  if (model.startsWith("gemini")) return "gemini";
  if (model.startsWith("grok")) return "xai";
  return "openai";
}

function sumUsage(usage: LlmUsageItem[]) {
  return usage.reduce(
    (acc, u) => ({
      input: acc.input + u.input,
      output: acc.output + u.output,
      cacheRead: acc.cacheRead + (u.cacheRead ?? 0),
      cacheWrite: acc.cacheWrite + (u.cacheWrite ?? 0),
    }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  );
}

async function callOnce(
  llm: Llm,
  label: string,
  cache: LlmCache,
): Promise<ReturnType<typeof sumUsage>> {
  const result = await llm.operate(INPUT, { cache, system: SYSTEM });
  if (result.error) {
    throw new Error(`${label}: ${JSON.stringify(result.error)}`);
  }
  const totals = sumUsage(result.usage);
  console.log(
    `\n[${label}] cache=${JSON.stringify(cache)}\n` +
      `  input(uncached): ${totals.input}\n` +
      `  cacheWrite:      ${totals.cacheWrite}  (tokens written to cache)\n` +
      `  cacheRead:       ${totals.cacheRead}  (tokens served from cache)\n` +
      `  output:          ${totals.output}`,
  );
  return totals;
}

//
//
// Main
//

async function main(): Promise<boolean> {
  const model = process.env.APP_MODEL || LLM.MODEL.SONNET;
  const provider = process.env.APP_PROVIDER || inferProvider(model);
  console.log(`Provider: ${provider}, Model: ${model}`);

  const llm = new Llm(provider, { model });

  try {
    // 1) No caching — baseline. Full prompt billed as input; no cache tokens.
    const off = await callOnce(llm, "no-cache", false);

    // 2) Cold cache write — first call at 5m TTL writes the prefix to cache.
    //    Expect cacheWrite > 0 (the middle call reports what got cached).
    const cold = await callOnce(llm, "cache-5m (cold)", "5m");

    // 3) Warm cache hit — same prefix, served from cache.
    //    Expect cacheRead > 0 (the final call reports how much cache was used).
    const warm = await callOnce(llm, "cache-5m (warm)", "5m");

    console.log("\n──────── summary ────────");
    console.log(
      `no-cache:        input=${off.input}, cacheWrite=${off.cacheWrite}, cacheRead=${off.cacheRead}`,
    );
    console.log(
      `cache-5m (cold): input=${cold.input}, cacheWrite=${cold.cacheWrite}, cacheRead=${cold.cacheRead}`,
    );
    console.log(
      `cache-5m (warm): input=${warm.input}, cacheWrite=${warm.cacheWrite}, cacheRead=${warm.cacheRead}`,
    );

    const wroteOnCold = cold.cacheWrite > 0;
    const readOnWarm = warm.cacheRead > 0;
    if (!wroteOnCold) {
      console.warn(
        "\n⚠️  Cold call reported no cacheWrite — prefix may be below the " +
          "model's minimum cacheable size, or the provider does not report it.",
      );
    }
    if (!readOnWarm) {
      console.warn(
        "\n⚠️  Warm call reported no cacheRead — cache may have expired or the " +
          "prefix changed between calls.",
      );
    }
    return wroteOnCold && readOnWarm;
  } catch (error) {
    console.error(error);
    return false;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((ok) => {
    if (ok) {
      console.log("\n🎉 Cache demonstrated: cold write, warm read");
    } else {
      console.error("\n💀 Cache not demonstrated");
      process.exit(1);
    }
  });
}
