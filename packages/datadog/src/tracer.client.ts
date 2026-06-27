import { createRequire } from "module";
import { pathToFileURL } from "url";

//
//
// Types
//

/** Minimal shape of a dd-trace span used by the span helpers. */
export interface DatadogSpan {
  setTag: (key: string, value: unknown) => unknown;
  finish: () => void;
  [key: string]: unknown;
}

/** Minimal shape of the dd-trace tracer surface used by the span helpers. */
export interface DatadogTracer {
  scope: () => { active: () => DatadogSpan | null };
  trace: <T>(name: string, fn: (span?: DatadogSpan) => T) => T;
  [key: string]: unknown;
}

//
//
// Constants
//

const MODULE = {
  // Computed at runtime so bundlers (esbuild/rollup) do not inline dd-trace. On
  // Lambda the Datadog layer provides dd-trace on NODE_PATH at runtime, honored
  // by CJS require but not ESM import; resolving a bundled copy would be a
  // different tracer instance with no active span (mirrors llmobs.ts).
  DD_TRACE: ["dd", "trace"].join("-"),
};

//
//
// Helpers
//

// CJS/ESM compatible require - handles bundling to CJS where import.meta.url
// is undefined (mirrors llmobs.ts).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - __filename exists in CJS context when ESM is bundled to CJS
const requireModule =
  typeof __filename !== "undefined"
    ? createRequire(pathToFileURL(__filename).href)
    : createRequire(import.meta.url);

let resolved = false;
let cachedTracer: DatadogTracer | null = null;
let injectedTracer: DatadogTracer | null | undefined;

/**
 * Lazily resolve the runtime dd-trace tracer singleton. Returns null (and never
 * throws) when dd-trace is absent or the surface is unexpected. Cached after
 * the first attempt.
 */
function resolveTracer(): DatadogTracer | null {
  if (resolved) {
    return cachedTracer;
  }
  resolved = true;
  try {
    const ddTrace = requireModule(MODULE.DD_TRACE);
    const tracer = ddTrace?.default ?? ddTrace;
    if (tracer && typeof tracer === "object") {
      cachedTracer = tracer as DatadogTracer;
    }
  } catch {
    cachedTracer = null;
  }
  return cachedTracer;
}

//
//
// Main
//

/**
 * Bundler-safe accessor for the runtime dd-trace tracer singleton. Returns the
 * injected tracer when set (tests), otherwise the resolved runtime singleton,
 * or null when dd-trace cannot be resolved (local / non-Lambda). Never throws.
 */
export function getTracer(): DatadogTracer | null {
  return injectedTracer !== undefined ? injectedTracer : resolveTracer();
}

/**
 * Inject a tracer to bypass dd-trace resolution. Test-only: dd-trace is not a
 * dependency, so the resolved path cannot otherwise be exercised in unit tests.
 */
export function _setTracer(tracer: DatadogTracer | null): void {
  injectedTracer = tracer;
}

/** Reset cached tracer resolution and any injected tracer. Exposed for tests. */
export function _resetTracer(): void {
  resolved = false;
  cachedTracer = null;
  injectedTracer = undefined;
}
