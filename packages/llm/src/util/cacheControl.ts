import { type LlmCache } from "../types/LlmProvider.interface.js";

export const CACHE_TTL_DEFAULT = "5m" as const;

/**
 * Anthropic bills a 1h cache write at 2x input (vs 1.25x for 5m) but reads at
 * the same ~0.1x, so an hour of reuse pays for itself after ~three reads and
 * survives the gaps between turns in a long agentic session.
 */
export const CACHE_TTL_ANTHROPIC_DEFAULT = "1h" as const;

export type CacheTtl = "5m" | "1h";

export interface ResolvedCache {
  enabled: boolean;
  ttl: CacheTtl;
}

/**
 * Normalize the caller-facing `cache` option into a concrete decision.
 * - `undefined` / `true` → enabled at `defaultTtl`
 * - `false` / `0` → disabled
 * - `"5m"` / `"1h"` → enabled at that TTL
 */
export function resolveCache(
  cache: LlmCache | undefined,
  { defaultTtl = CACHE_TTL_DEFAULT }: { defaultTtl?: CacheTtl } = {},
): ResolvedCache {
  if (cache === false || cache === 0) {
    return { enabled: false, ttl: defaultTtl };
  }
  if (cache === "5m" || cache === "1h") {
    return { enabled: true, ttl: cache };
  }
  // undefined or true
  return { enabled: true, ttl: defaultTtl };
}

/**
 * Deterministic short key for providers with automatic, prefix-based caching
 * (e.g. OpenAI `prompt_cache_key`). Derived from the stable prefix so the same
 * system prompt + tools + model always routes to the same cache. Dependency-
 * free FNV-1a; not cryptographic.
 */
export function promptCacheKey(seed: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `jaypie-${(hash >>> 0).toString(16)}`;
}
