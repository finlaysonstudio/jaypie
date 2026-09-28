import { COST, LlmModelCost } from "../constants.js";
import { LlmUsage, LlmUsageItem } from "../types/LlmProvider.interface.js";
import { CACHE_TTL_DEFAULT, CacheTtl } from "./cacheControl.js";

//
//
// Constants
//

const TOKENS_PER_PRICE_UNIT = 1_000_000;

//
//
// Helpers
//

/**
 * The cache-write rate for a model at a TTL. Scalar rates are TTL-invariant,
 * and an omitted rate bills at `input` per the `LlmModelCost` contract.
 */
function cacheWriteRate(price: LlmModelCost, ttl: CacheTtl): number {
  const rate = price.cachedInputWrite;
  if (rate === undefined) {
    return price.input;
  }
  return typeof rate === "number" ? rate : rate[ttl];
}

/**
 * Cache-write cost for one usage item. Writes the provider split by TTL bill
 * at that TTL's rate; any remainder bills at `ttl`.
 */
function cacheWriteCost(
  item: LlmUsageItem,
  { price, ttl }: { price: LlmModelCost; ttl: CacheTtl },
): number {
  const cacheWrite = item.cacheWrite ?? 0;
  const oneHour = item.cacheWriteTtl?.["1h"] ?? 0;
  const fiveMinute = item.cacheWriteTtl?.["5m"] ?? 0;
  const unsplit = Math.max(cacheWrite - oneHour - fiveMinute, 0);
  return (
    oneHour * cacheWriteRate(price, "1h") +
    fiveMinute * cacheWriteRate(price, "5m") +
    unsplit * cacheWriteRate(price, ttl)
  );
}

//
//
// Main
//

/**
 * USD for a usage list, from the per-million COST table. Each item is priced
 * by the model it names, or by `model` when its own id is unpriced (a vendor
 * may echo a dated alias, such as `claude-haiku-4-5-20251001`, for a catalog
 * id). An item neither prices makes the result undefined, so a caller
 * distinguishes "free" from "unknown". `cacheRead`/`cacheWrite` are subsets
 * of `input` and `reasoning` is a subset of `output`, so each token bills
 * once: cached tokens at their cache rates, reasoning at the `reasoning` rate
 * when listed and as output otherwise, and the remainder at `input`/`output`.
 * Cache writes bill per TTL from `cacheWriteTtl`; writes the provider did not
 * split bill at `ttl`, the TTL the request asked for (default `"1h"`).
 */
export function tokenCost(
  usage: LlmUsage,
  { model, ttl = CACHE_TTL_DEFAULT }: { model?: string; ttl?: CacheTtl } = {},
): number | undefined {
  if (usage.length === 0) {
    return undefined;
  }
  const fallback = model ? COST[model] : undefined;
  let total = 0;
  for (const item of usage) {
    const price = (item.model ? COST[item.model] : undefined) ?? fallback;
    if (!price) {
      return undefined;
    }
    const cacheRead = item.cacheRead ?? 0;
    const cacheWrite = item.cacheWrite ?? 0;
    const uncachedInput = Math.max(item.input - cacheRead - cacheWrite, 0);
    const visibleOutput = Math.max(item.output - item.reasoning, 0);
    total +=
      uncachedInput * price.input +
      cacheRead * (price.cachedInputRead ?? price.input) +
      cacheWriteCost(item, { price, ttl }) +
      visibleOutput * price.output +
      item.reasoning * (price.reasoning ?? price.output);
  }
  return total / TOKENS_PER_PRICE_UNIT;
}
