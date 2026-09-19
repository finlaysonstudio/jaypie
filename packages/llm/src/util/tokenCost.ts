import { COST, LlmModelCost } from "../constants.js";
import { LlmUsage } from "../types/LlmProvider.interface.js";

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
 * The cache-write rate for a model. `COST` keys some rates by TTL; without
 * the request's TTL in hand, the five-minute rate stands in, and an omitted
 * rate bills at `input` per the `LlmModelCost` contract.
 */
function cacheWriteRate(price: LlmModelCost): number {
  const rate = price.cachedInputWrite;
  if (rate === undefined) {
    return price.input;
  }
  return typeof rate === "number" ? rate : rate["5m"];
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
 * distinguishes "free" from "unknown". Reasoning tokens bill at the
 * `reasoning` rate when listed and as output otherwise.
 */
export function tokenCost(
  usage: LlmUsage,
  { model }: { model?: string } = {},
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
    total +=
      item.input * price.input +
      item.output * price.output +
      item.reasoning * (price.reasoning ?? price.output) +
      (item.cacheRead ?? 0) * (price.cachedInputRead ?? price.input) +
      (item.cacheWrite ?? 0) * cacheWriteRate(price);
  }
  return total / TOKENS_PER_PRICE_UNIT;
}
