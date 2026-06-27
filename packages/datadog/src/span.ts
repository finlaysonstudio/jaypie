import { log } from "@jaypie/logger";

import { getTracer } from "./tracer.client.js";

//
//
// Types
//

type TagValue = string | number | boolean;

//
//
// Main
//

/**
 * Set one or more tags on the active APM span. Accepts a single key/value pair
 * or an object of tags. Silently no-ops when there is no active span (local /
 * non-Lambda) and never throws. The caller chooses the key namespace — avoid
 * Datadog's reserved `test.*` / `ci.*` namespaces.
 */
export function tagSpan(
  keyOrTags: string | Record<string, TagValue>,
  value?: TagValue,
): void {
  try {
    const span = getTracer()?.scope?.()?.active?.();
    if (!span) {
      return;
    }
    if (typeof keyOrTags === "string") {
      span.setTag(keyOrTags, value);
    } else {
      for (const [key, tagValue] of Object.entries(keyOrTags)) {
        span.setTag(key, tagValue);
      }
    }
  } catch (error) {
    log.warn("[@jaypie/datadog] tagSpan failed");
    log.var({ error });
  }
}

/**
 * Run `fn` as a child span named `name`, kept active across awaits so its
 * duration is measured on its own. Returns `fn`'s result; when `fn` returns a
 * promise dd-trace finishes the span on settle, and a throw still finishes the
 * span. No-ops to just running `fn` when no tracer is present.
 */
export function traceSpan<T>(name: string, fn: () => T): T {
  const tracer = getTracer();
  if (!tracer?.trace) {
    return fn();
  }
  return tracer.trace(name, () => fn());
}
