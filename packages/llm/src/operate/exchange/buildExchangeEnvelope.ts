import {
  LlmExchangeEnvelope,
  LlmHistory,
  LlmInputMessage,
  LlmOperateInput,
  LlmOperateOptions,
  LlmOperateResponse,
  LlmUsageItem,
} from "../../types/LlmProvider.interface.js";
import { OperateLoopState } from "../types.js";

//
//
// Helpers
//

function sumUsageByProviderModel(
  usage: LlmUsageItem[],
): Record<string, LlmUsageItem> | undefined {
  if (!usage.length) {
    return undefined;
  }
  const totals: Record<string, LlmUsageItem> = {};
  for (const item of usage) {
    const key = `${item.provider ?? "unknown"}:${item.model ?? "unknown"}`;
    if (!totals[key]) {
      totals[key] = {
        input: 0,
        model: item.model,
        output: 0,
        provider: item.provider,
        reasoning: 0,
        total: 0,
      };
    }
    totals[key].input += item.input;
    totals[key].output += item.output;
    totals[key].reasoning += item.reasoning;
    totals[key].total += item.total;
  }
  return totals;
}

function extractResponseIds(responses: unknown[]): string[] | undefined {
  const ids = responses
    .map((response) =>
      response && typeof response === "object"
        ? (response as { id?: unknown }).id
        : undefined,
    )
    .filter((id): id is string => typeof id === "string");
  return ids.length ? ids : undefined;
}

//
//
// Main
//

/**
 * Assemble the serializable exchange envelope for one operate() settlement.
 * The `resolution` block is stamped by the Llm facade, which is the layer
 * that knows fallback outcome; the loop fills provider/model best-effort.
 */
export function buildExchangeEnvelope({
  duration,
  initialHistoryLength,
  input,
  options,
  response,
  startedAt,
  state,
}: {
  duration: number;
  initialHistoryLength: number;
  input: string | LlmHistory | LlmInputMessage | LlmOperateInput;
  options: LlmOperateOptions;
  response: LlmOperateResponse;
  startedAt: string;
  state: OperateLoopState;
}): LlmExchangeEnvelope {
  const historyDelta = response.history.slice(initialHistoryLength);
  return {
    ids: extractResponseIds(response.responses),
    request: {
      data: options.data,
      effort: options.effort,
      explain: options.explain,
      format: state.formattedFormat,
      input,
      instructions: options.instructions,
      model: options.model,
      placeholders: options.placeholders,
      providerOptions: options.providerOptions,
      system: options.system,
      temperature: options.temperature,
      tools: state.formattedTools?.map(({ name }) => name),
      turns: options.turns,
      user: options.user,
    },
    resolution: {
      model: response.model,
      provider: response.provider,
      retries: state.retries,
    },
    response: {
      content: response.content,
      error: response.error,
      historyDelta,
      reasoning: response.reasoning,
      status: response.status,
      stopReason: state.lastStopReason,
      usage: response.usage,
      usageTotals: sumUsageByProviderModel(response.usage),
    },
    timing: {
      duration,
      startedAt,
    },
  };
}
