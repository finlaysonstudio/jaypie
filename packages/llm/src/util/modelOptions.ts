import { JsonObject } from "@jaypie/types";

import { LlmModelOptions } from "../types/LlmProvider.interface.js";
import { determineModelProvider } from "./determineModelProvider.js";
import { getLogger } from "./logger.js";
import { matchModelKeys } from "./modelKey.js";

//
//
// Types
//

export interface LlmModelOptionsResolution {
  /** Matched keys in merge order, least to most specific */
  keys: string[];
  model: string;
  /** Merged options; undefined when no key matched */
  options?: JsonObject;
  provider?: string;
}

//
//
// Helpers
//

function isPlainObject(value: unknown): value is JsonObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/** Merge `source` into a copy of `target`: objects merge, all else replaces */
function mergeOptions(target: JsonObject, source: JsonObject): JsonObject {
  const merged: JsonObject = { ...target };
  for (const [key, value] of Object.entries(source)) {
    const existing = merged[key];
    merged[key] =
      isPlainObject(existing) && isPlainObject(value)
        ? mergeOptions(existing, value)
        : value;
  }
  return merged;
}

/**
 * Merge every key of a `modelOptions` map that applies to one attempt, least
 * to most specific: `default`, provider (or alias), `MODEL` catalog key,
 * exact model id.
 */
export function resolveModelOptionsFor(
  modelOptions: LlmModelOptions | undefined,
  { model, provider }: { model?: string; provider?: string } = {},
): { keys: string[]; options?: JsonObject } {
  if (!modelOptions) return { keys: [] };
  const keys = matchModelKeys(
    Object.keys(modelOptions).filter((key) => isPlainObject(modelOptions[key])),
    { model, provider },
  );
  if (!keys.length) return { keys };
  return {
    keys,
    options: keys.reduce<JsonObject>(
      (merged, key) => mergeOptions(merged, modelOptions[key]!),
      {},
    ),
  };
}

/**
 * Replace an attempt's `providerOptions` with the `modelOptions` it resolves
 * to. When `modelOptions` is set, `providerOptions` is ignored. The operate
 * and stream loops run this first, so every request and exchange downstream
 * carries the options this attempt sends.
 */
export function withResolvedModelOptions<
  TOptions extends {
    model?: string;
    modelOptions?: LlmModelOptions;
    providerOptions?: JsonObject;
  },
>(
  options: TOptions,
  { defaultModel, provider }: { defaultModel: string; provider: string },
): TOptions & { providerOptions?: JsonObject } {
  if (!options.modelOptions) return options;
  if (options.providerOptions) {
    getLogger().debug("[llm] modelOptions set; ignoring providerOptions");
  }
  const { options: providerOptions } = resolveModelOptionsFor(
    options.modelOptions,
    { model: options.model ?? defaultModel, provider },
  );
  return { ...options, providerOptions };
}

//
//
// Main
//

/**
 * Resolve the provider options one model would receive from a `modelOptions`
 * map: the merged object and the keys that matched, in merge order.
 */
export function resolveModelOptions({
  model,
  modelOptions,
  provider,
}: {
  model: string;
  modelOptions?: LlmModelOptions;
  provider?: string;
}): LlmModelOptionsResolution {
  const determined = determineModelProvider(model);
  const resolvedProvider = provider ?? determined.provider;
  const { keys, options } = resolveModelOptionsFor(modelOptions, {
    model: determined.model,
    provider: resolvedProvider,
  });
  return {
    keys,
    model: determined.model,
    ...(options ? { options } : {}),
    provider: resolvedProvider,
  };
}
