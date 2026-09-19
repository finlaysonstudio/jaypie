import { PAGE_COST } from "../constants.js";

//
//
// Constants
//

const PAGES_PER_PRICE_UNIT = 1000;

//
//
// Main
//

/**
 * USD for `pages` pages on `model`, from the per-thousand PAGE_COST table.
 * Undefined when the table does not price the id, so a caller distinguishes
 * "free" from "unknown".
 */
export function pageCost({
  model,
  pages,
}: {
  model: string;
  pages: number;
}): number | undefined {
  const perThousand = PAGE_COST[model];
  if (perThousand === undefined || !Number.isFinite(pages)) {
    return undefined;
  }
  return (perThousand * pages) / PAGES_PER_PRICE_UNIT;
}
