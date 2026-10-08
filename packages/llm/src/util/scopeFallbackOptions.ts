import { JsonObject } from "@jaypie/types";

import { LlmFallbackConfig } from "../types/LlmProvider.interface.js";

/**
 * Shape per-call options for a fallback attempt. A fallback runs its own
 * model and its own `providerOptions`: the per-call values were written for
 * the primary, and forwarding them would ask the next provider for a model it
 * does not serve or send fields its API rejects. `modelOptions` carries
 * through: it resolves against each attempt's own model.
 */
export function scopeFallbackOptions<
  TOptions extends { model?: unknown; providerOptions?: JsonObject },
>(
  options: TOptions,
  { config }: { config?: LlmFallbackConfig } = {},
): TOptions {
  return {
    ...options,
    model: undefined,
    providerOptions: config?.providerOptions,
  };
}
