import { createRequire } from "module";
import { pathToFileURL } from "url";

import { getLogger } from "../util/index.js";

//
//
// Types
//

/**
 * LLM Observability span kinds supported by Datadog's `llmobs` SDK.
 * @see https://docs.datadoghq.com/llm_observability/setup/sdk/nodejs/
 */
export type LlmObsSpanKind =
  | "agent"
  | "embedding"
  | "llm"
  | "retrieval"
  | "task"
  | "tool"
  | "workflow";

export interface LlmObsSpanOptions {
  kind: LlmObsSpanKind;
  modelName?: string;
  modelProvider?: string;
  name: string;
}

export interface LlmObsAnnotation {
  inputData?: unknown;
  metadata?: Record<string, unknown>;
  metrics?: Record<string, number>;
  outputData?: unknown;
  tags?: Record<string, unknown>;
}

/** Manual span handle for streaming, where a callback cannot enclose the work. */
export interface LlmObsSpanHandle {
  annotate: (annotation: LlmObsAnnotation) => void;
  finish: () => void;
}

/** Minimal shape of the dd-trace `llmobs` SDK surface this module uses. */
interface LlmObsSdk {
  annotate: (span: unknown, annotation: LlmObsAnnotation) => void;
  trace: (
    options: LlmObsSpanOptions,
    fn: (span: unknown) => unknown,
  ) => unknown;
}

//
//
// Constants
//

const ENV = {
  DD_LLMOBS_ENABLED: "DD_LLMOBS_ENABLED",
};

const MODULE = {
  // Computed at runtime so bundlers (esbuild) do not attempt to include
  // dd-trace, which is provided by the Datadog Lambda layer at runtime.
  DD_TRACE: ["dd", "trace"].join("-"),
};

//
//
// Helpers
//

// CJS/ESM compatible require - handles bundling to CJS where import.meta.url
// becomes undefined (mirrors packages/testkit/src/mock/original.ts).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - __filename exists in CJS context when ESM is bundled to CJS
const requireModule =
  typeof __filename !== "undefined"
    ? createRequire(pathToFileURL(__filename).href)
    : createRequire(import.meta.url);

let resolved = false;
let cachedSdk: LlmObsSdk | null = null;
let injectedSdk: LlmObsSdk | null = null;

/**
 * Lazily resolve the dd-trace `llmobs` SDK. Returns null (and never throws)
 * when dd-trace is absent or the SDK surface is unexpected. Cached after the
 * first attempt.
 */
function resolveLlmObs(): LlmObsSdk | null {
  if (resolved) {
    return cachedSdk;
  }
  resolved = true;
  try {
    const ddTrace = requireModule(MODULE.DD_TRACE);
    const tracer = ddTrace?.default ?? ddTrace;
    const llmobs = tracer?.llmobs;
    if (
      llmobs &&
      typeof llmobs.trace === "function" &&
      typeof llmobs.annotate === "function"
    ) {
      cachedSdk = llmobs as LlmObsSdk;
    }
  } catch {
    cachedSdk = null;
  }
  return cachedSdk;
}

/** Reset the cached SDK resolution. Exposed for tests. */
export function _resetLlmObs(): void {
  resolved = false;
  cachedSdk = null;
  injectedSdk = null;
}

/**
 * Inject an SDK to bypass dd-trace resolution. Test-only: dd-trace is not a
 * dependency, so the enabled path cannot otherwise be exercised in unit tests.
 */
export function _setLlmObs(sdk: LlmObsSdk | null): void {
  injectedSdk = sdk;
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
  const value = process.env[ENV.DD_LLMOBS_ENABLED];
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized !== "" && normalized !== "false" && normalized !== "0";
}

/** Resolve the SDK only when enabled and available. */
function activeSdk(): LlmObsSdk | null {
  if (!isLlmObsEnabled()) {
    return null;
  }
  return injectedSdk ?? resolveLlmObs();
}

/**
 * Run `fn` inside an LLM Observability span. When emission is disabled or
 * dd-trace is absent, `fn` is invoked directly with no overhead. The active
 * span is established for the duration of `fn`, so nested `withLlmObsSpan`
 * calls (and `annotateLlmObs`) attach as children/annotations automatically.
 */
export async function withLlmObsSpan<T>(
  options: LlmObsSpanOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const sdk = activeSdk();
  if (!sdk) {
    return fn();
  }
  let started = false;
  try {
    return (await sdk.trace(options, () => {
      started = true;
      return fn();
    })) as T;
  } catch (error) {
    // If `fn` ran, propagate its error (the SDK re-throws after finishing the
    // span). Only swallow failures from the instrumentation itself, re-running
    // `fn` so observability never breaks the underlying call.
    if (started) {
      throw error;
    }
    getLogger().warn("[llmobs] span emission failed");
    getLogger().var({ error });
    return fn();
  }
}

/**
 * Annotate the currently active LLM Observability span. No-op when disabled.
 */
export function annotateLlmObs(annotation: LlmObsAnnotation): void {
  const sdk = activeSdk();
  if (!sdk) {
    return;
  }
  try {
    sdk.annotate(undefined, annotation);
  } catch (error) {
    getLogger().warn("[llmobs] annotate failed");
    getLogger().var({ error });
  }
}

/**
 * Open a manual span that is finished later. Used by streaming, where work is
 * yielded incrementally and cannot be enclosed in a single callback. The span
 * is kept open via a deferred promise resolved by `finish()`. Returns null when
 * emission is disabled or dd-trace is absent.
 *
 * Note: because the span is held open across `yield` boundaries (outside the
 * SDK's AsyncLocalStorage scope), manual spans are emitted flat rather than
 * nested. Annotations are applied to the explicit span reference.
 */
export function openLlmObsSpan(
  options: LlmObsSpanOptions,
): LlmObsSpanHandle | null {
  const sdk = activeSdk();
  if (!sdk) {
    return null;
  }
  try {
    let capturedSpan: unknown;
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    // trace() runs the callback synchronously, capturing the span; the returned
    // pending promise keeps the span open until finish() resolves it.
    void sdk.trace(options, (span) => {
      capturedSpan = span;
      return held;
    });
    let finished = false;
    return {
      annotate: (annotation: LlmObsAnnotation) => {
        try {
          sdk.annotate(capturedSpan, annotation);
        } catch (error) {
          getLogger().warn("[llmobs] annotate failed");
          getLogger().var({ error });
        }
      },
      finish: () => {
        if (finished) {
          return;
        }
        finished = true;
        release?.();
      },
    };
  } catch (error) {
    getLogger().warn("[llmobs] span emission failed");
    getLogger().var({ error });
    return null;
  }
}

//
//
// Mapping Helpers
//

/**
 * Sum an `LlmUsage` array into LLM Observability metric keys. Returns undefined
 * when there is no usage data so callers can omit the `metrics` field.
 */
export function usageToLlmObsMetrics(
  usage?: Array<{ input?: number; output?: number; total?: number }>,
): Record<string, number> | undefined {
  if (!usage || usage.length === 0) {
    return undefined;
  }
  const metrics = usage.reduce(
    (sum, item) => ({
      input_tokens: sum.input_tokens + (item.input ?? 0),
      output_tokens: sum.output_tokens + (item.output ?? 0),
      total_tokens: sum.total_tokens + (item.total ?? 0),
    }),
    { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
  );
  return metrics;
}
