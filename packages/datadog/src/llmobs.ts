import { createRequire } from "module";
import { pathToFileURL } from "url";

import { log } from "@jaypie/logger";

import { DATADOG } from "./constants.js";

//
//
// Types
//

/**
 * Minimal shape of the dd-trace `llmobs` SDK surface. The runtime object
 * exposes much more (`trace`, `annotate`, `submitEvaluation`, …); we type only
 * `flush` and allow arbitrary access for manual use cases.
 */
export interface LlmObs {
  flush: () => void;
  [key: string]: unknown;
}

//
//
// Constants
//

const MODULE = {
  // Computed at runtime so bundlers (esbuild/rollup) do not attempt to include
  // dd-trace. On Lambda, dd-trace is provided by the Datadog layer at runtime;
  // resolving a bundled copy would be a different module instance whose buffer
  // never ships (singleton correctness).
  DD_TRACE: ["dd", "trace"].join("-"),
};

//
//
// Helpers
//

// CJS/ESM compatible require - handles bundling to CJS where import.meta.url
// becomes undefined (mirrors packages/llm/src/observability/llmobs.ts).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - __filename exists in CJS context when ESM is bundled to CJS
const requireModule =
  typeof __filename !== "undefined"
    ? createRequire(pathToFileURL(__filename).href)
    : createRequire(import.meta.url);

let resolved = false;
let cachedLlmObs: LlmObs | null = null;
let injectedLlmObs: LlmObs | null | undefined;

/**
 * Lazily resolve the runtime dd-trace `llmobs` SDK singleton. Returns null (and
 * never throws) when dd-trace is absent or the SDK surface is unexpected.
 * Cached after the first attempt.
 */
function resolveLlmObs(): LlmObs | null {
  if (resolved) {
    return cachedLlmObs;
  }
  resolved = true;
  try {
    const ddTrace = requireModule(MODULE.DD_TRACE);
    const tracer = ddTrace?.default ?? ddTrace;
    const llmobs = tracer?.llmobs;
    if (llmobs && typeof llmobs === "object") {
      cachedLlmObs = llmobs as LlmObs;
    }
  } catch {
    cachedLlmObs = null;
  }
  return cachedLlmObs;
}

/** The injected (test) SDK when set, otherwise the runtime singleton. */
function currentLlmObs(): LlmObs | null {
  return injectedLlmObs !== undefined ? injectedLlmObs : resolveLlmObs();
}

/** Reset the cached SDK resolution. Exposed for tests. */
export function _resetLlmObs(): void {
  resolved = false;
  cachedLlmObs = null;
  injectedLlmObs = undefined;
}

/**
 * Inject an SDK to bypass dd-trace resolution. Test-only: dd-trace is not a
 * dependency, so the resolved path cannot otherwise be exercised in unit tests.
 */
export function _setLlmObs(sdk: LlmObs | null): void {
  injectedLlmObs = sdk;
}

//
//
// Main
//

/**
 * True when LLM Observability emission is opted in via `DD_LLMOBS_ENABLED`.
 * Accepts any truthy value except "false"/"0".
 */
export function isLlmObsEnabled(): boolean {
  const value = process.env[DATADOG.ENV.DD_LLMOBS_ENABLED];
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized !== "" && normalized !== "false" && normalized !== "0";
}

/**
 * Bundler-safe accessor for the runtime dd-trace `llmobs` SDK singleton.
 *
 * Returns the runtime `tracer.llmobs`, or `null` when dd-trace cannot be
 * resolved. Use it for the genuine manual cases — opening an enclosing
 * `workflow`/`agent` span so model/tool spans nest correctly via
 * AsyncLocalStorage, custom annotations, or `submitEvaluation`. Resolving the
 * runtime singleton (never a bundled copy) keeps spans on the buffer the layer
 * actually flushes.
 */
export function getLlmObs(): LlmObs | null {
  return currentLlmObs();
}

/**
 * Flush buffered LLM Observability spans through the runtime dd-trace
 * singleton. On Lambda the runtime freezes the instant the handler resolves, so
 * buffered spans are dropped unless flushed before return.
 *
 * Silent no-op when LLM Obs is disabled (`DD_LLMOBS_ENABLED` falsy) or dd-trace
 * cannot be resolved. Wrapped so instrumentation never breaks the caller.
 */
export function flushLlmObs(): void {
  if (!isLlmObsEnabled()) {
    return;
  }
  const llmobs = currentLlmObs();
  if (!llmobs || typeof llmobs.flush !== "function") {
    return;
  }
  try {
    llmobs.flush();
  } catch (error) {
    log.warn("[@jaypie/datadog] LLM Observability flush failed");
    log.var({ error });
  }
}
