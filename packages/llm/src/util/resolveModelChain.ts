import { ConfigurationError } from "@jaypie/errors";
import { LlmFallbackConfig } from "../types/LlmProvider.interface.js";
import { determineModelProvider } from "./determineModelProvider.js";

/**
 * Normalizes a `model` option that may be a single model name or a
 * preference-ordered array of model names.
 *
 * A `string[]` is interpreted as a fallback chain: index `0` is the primary
 * model, indices `1..` become fallback entries with an auto-detected provider
 * (reusing `determineModelProvider`, exactly as the constructor's first
 * argument does).
 *
 * Returns the primary model plus the derived fallback chain. A bare string
 * yields an empty chain and is unchanged.
 */
export function resolveModelChain(model?: string | string[]): {
  model?: string;
  fallback: LlmFallbackConfig[];
} {
  if (!Array.isArray(model)) {
    return { fallback: [], model };
  }

  if (model.length === 0) {
    throw new ConfigurationError(
      "model array must contain at least one model name",
    );
  }

  const [primary, ...rest] = model;
  const fallback = rest.map((name) => {
    const determined = determineModelProvider(name);
    if (!determined.provider) {
      throw new ConfigurationError(
        `Unable to determine provider from model: ${name}`,
      );
    }
    return { model: determined.model, provider: determined.provider };
  });

  return { fallback, model: primary };
}
