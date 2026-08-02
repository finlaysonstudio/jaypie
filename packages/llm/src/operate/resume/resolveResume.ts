import { BadRequestError } from "@jaypie/errors";

import {
  LlmExchangePending,
  LlmHistory,
  LlmMessageType,
  LlmResponseStatus,
  LlmResumeOption,
  LlmToolResult,
} from "../../types/LlmProvider.interface.js";
import { getLogger } from "../../util/index.js";

//
//
// Types
//

export interface ResolvedResume {
  /** Tool-error streak after applying the supplied results */
  consecutiveToolErrors: number;
  /** Full re-entrant history: the parked history plus the result items */
  history: LlmHistory;
  /** The validated pending block off the envelope */
  pending: LlmExchangePending;
  /** Just the appended function_call_output items, in pending-call order */
  resultItems: LlmHistory;
}

//
//
// Main
//

/**
 * Validate a resume payload against the adapter about to serve it and turn
 * the supplied results into provider-neutral function_call_output items,
 * formatted exactly like the loop's own tool outputs. Shared by OperateLoop
 * and StreamLoop.
 */
export function resolveResume({
  adapterName,
  model,
  resume,
}: {
  adapterName: string;
  /** The model this segment will use; mismatch with the served model warns */
  model?: string;
  resume: LlmResumeOption;
}): ResolvedResume {
  const log = getLogger();
  const { exchange, results } = resume;
  const pending = exchange?.pending;
  if (
    !pending ||
    !Array.isArray(pending.calls) ||
    pending.calls.length === 0 ||
    exchange.response?.status !== LlmResponseStatus.InProgress
  ) {
    throw new BadRequestError("Cannot resume: exchange is not parked");
  }

  const servedProvider = exchange.resolution?.provider;
  if (servedProvider && servedProvider !== adapterName) {
    throw new BadRequestError(
      `Cannot resume: exchange was served by provider '${servedProvider}', not '${adapterName}'`,
    );
  }
  const servedModel = exchange.resolution?.model;
  if (servedModel && model && servedModel !== model) {
    log.warn(
      `[operate] Resuming exchange served by model '${servedModel}' with model '${model}'`,
    );
  }

  // Results must cover the pending calls exactly: no provider accepts a
  // partial tool-result turn. A missing outcome is reported as an error
  // result, not omitted.
  const suppliedResults = Array.isArray(results) ? results : [];
  const expectedXids = new Set(pending.calls.map((call) => call.xid));
  const missing = pending.calls
    .filter(
      (call) => !suppliedResults.some((result) => result.xid === call.xid),
    )
    .map((call) => call.xid);
  const extra = suppliedResults
    .filter((result) => !expectedXids.has(result.xid))
    .map((result) => result.xid);
  if (missing.length > 0 || extra.length > 0) {
    const detail = [
      missing.length > 0 ? `missing results for: ${missing.join(", ")}` : "",
      extra.length > 0 ? `unexpected results for: ${extra.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("; ");
    throw new BadRequestError(
      `Resume results must cover the pending calls exactly (${detail})`,
    );
  }

  // Append the supplied results in the pending-call order the model issued
  // them, formatted exactly like the loop's own tool outputs.
  const resultItems: LlmHistory = [];
  let consecutiveToolErrors = pending.consecutiveToolErrors ?? 0;
  for (const call of pending.calls) {
    const result = suppliedResults.find(
      (candidate) => candidate.xid === call.xid,
    )!;
    const failed = result.error !== undefined;
    const output = failed
      ? JSON.stringify({ error: result.error || "Tool execution failed" })
      : JSON.stringify(result.output ?? null);
    resultItems.push({
      call_id: call.xid,
      name: call.name,
      output,
      type: LlmMessageType.FunctionCallOutput,
    } as LlmToolResult & { name: string });
    consecutiveToolErrors = failed ? consecutiveToolErrors + 1 : 0;
  }

  return {
    consecutiveToolErrors,
    history: [...pending.history, ...resultItems],
    pending,
    resultItems,
  };
}
