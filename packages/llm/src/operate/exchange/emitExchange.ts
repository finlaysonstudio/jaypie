import {
  LlmExchangeCallback,
  LlmExchangeEnvelope,
} from "../../types/LlmProvider.interface.js";
import { getLogger } from "../../util/index.js";

/**
 * Truthy-except-"false"/"0" gate on LLM_EXCHANGE_ENABLED, matching the
 * DD_LLMOBS_ENABLED convention in observability/llmobs.ts.
 */
export function isExchangeStoreEnabled(): boolean {
  const flag = process.env.LLM_EXCHANGE_ENABLED;
  if (!flag) {
    return false;
  }
  return flag.toLowerCase() !== "false" && flag !== "0";
}

/**
 * Whether the loop should assemble an exchange envelope at settlement.
 */
export function isExchangeRequested({
  onExchange,
}: {
  onExchange?: LlmExchangeCallback;
}): boolean {
  return Boolean(onExchange) || isExchangeStoreEnabled();
}

/**
 * Deliver an exchange envelope to a callback. Errors thrown by the callback
 * are logged and swallowed — exchange capture must never interrupt the call.
 */
export async function emitExchange({
  envelope,
  onExchange,
}: {
  envelope: LlmExchangeEnvelope;
  onExchange?: LlmExchangeCallback;
}): Promise<void> {
  if (!onExchange) {
    return;
  }
  try {
    await onExchange(envelope);
  } catch (error) {
    const log = getLogger();
    log.warn("[operate] onExchange callback threw");
    log.var({ error });
  }
}
