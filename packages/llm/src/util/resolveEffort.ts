import { JsonObject } from "@jaypie/types";

import { type LlmEffort, type LlmEffortMap } from "../constants.js";
import {
  anthropicAdapter,
  bedrockAdapter,
  fireworksAdapter,
  googleAdapter,
  metaAdapter,
  mistralAdapter,
  openAiAdapter,
  openRouterAdapter,
  xaiAdapter,
} from "../operate/adapters/index.js";
import { ProviderAdapter } from "../operate/adapters/ProviderAdapter.interface.js";
import { determineModelProvider } from "./determineModelProvider.js";
import { resolveEffortLevel } from "./effort.js";

//
//
// Constants
//

const ADAPTERS: Record<string, ProviderAdapter> = Object.fromEntries(
  [
    anthropicAdapter,
    bedrockAdapter,
    fireworksAdapter,
    googleAdapter,
    metaAdapter,
    mistralAdapter,
    openAiAdapter,
    openRouterAdapter,
    xaiAdapter,
  ].map((adapter) => [adapter.name, adapter]),
);

//
//
// Types
//

export interface LlmEffortResolution {
  /** Neutral level the effort resolved to; undefined leaves the provider default */
  level?: LlmEffort;
  model: string;
  /**
   * Request fragment the provider adapter sends for `level`, e.g.
   * `{ thinkingConfig: { thinkingLevel: "LOW" } }` or
   * `{ reasoning: { effort: "max" } }`. Undefined when no level resolved or
   * the model has no reasoning control.
   */
  native?: JsonObject;
  /** True when `level` had no distinct native rung and landed on a neighbor */
  papered?: boolean;
  provider?: string;
}

//
//
// Main
//

/**
 * Resolve the reasoning effort one model would run at: the neutral level a
 * single `effort` or an effort map selects for it, and the native control the
 * provider adapter would send. Comparing `native` across levels shows which
 * levels are distinct on a model.
 */
export function resolveEffort({
  effort,
  model,
  provider,
}: {
  effort?: LlmEffort | LlmEffortMap;
  model: string;
  provider?: string;
}): LlmEffortResolution {
  const determined = determineModelProvider(model);
  const resolvedProvider = provider ?? determined.provider;
  const resolvedModel = determined.model;
  const level = resolveEffortLevel(effort, {
    model: resolvedModel,
    provider: resolvedProvider,
  });
  const adapter = resolvedProvider ? ADAPTERS[resolvedProvider] : undefined;
  const resolved =
    level && adapter?.resolveEffort
      ? adapter.resolveEffort(level, { model: resolvedModel })
      : undefined;

  return {
    level,
    model: resolvedModel,
    ...(resolved
      ? { native: resolved.native, papered: resolved.mapping.papered }
      : {}),
    provider: resolvedProvider,
  };
}
