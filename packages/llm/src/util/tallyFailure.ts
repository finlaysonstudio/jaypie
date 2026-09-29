import { log } from "@jaypie/logger";

import { LlmError, LlmTimeoutError } from "../errors/LlmError.js";
import { ErrorCategory } from "../operate/types.js";

const TIMEOUT = "timeout";
const UNKNOWN = "unknown";

interface TallyFailureOptions {
  error: unknown;
  /** True when another model takes over after this failure */
  failover?: boolean;
  model?: string;
  provider?: string;
}

/**
 * The kind a failure is tallied under: `timeout` for an attempt that outlived
 * its deadline, otherwise the LlmError category (`rate_limit`, `retryable`,
 * `quota`, `unrecoverable`, `unknown`).
 */
export function failureKind(error: unknown): string {
  if (error instanceof LlmTimeoutError) return TIMEOUT;
  if (error instanceof LlmError) return error.category;
  return ErrorCategory.Unknown;
}

/**
 * Tally one failed provider attempt onto the root logger's report session:
 * `llm.failures` counts by `provider:model` and kind, and `llm.fallbacks`
 * counts each hand-off to another model. Silently no-ops outside an active
 * session or when the logger predates tally or sessionActive support.
 */
export function tallyFailure({
  error,
  failover = false,
  model,
  provider,
}: TallyFailureOptions): void {
  if (typeof log.tally !== "function") return;
  if (log.sessionActive === false) return;
  const llmError = error instanceof LlmError ? error : undefined;
  const key =
    [llmError?.provider ?? provider, llmError?.model ?? model]
      .filter(Boolean)
      .join(":") || UNKNOWN;
  const llm: Record<string, unknown> = {
    failures: { [key]: { [failureKind(error)]: 1 } },
  };
  if (failover) {
    llm.fallbacks = 1;
  }
  log.tally({ llm });
}
