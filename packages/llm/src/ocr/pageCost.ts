import { PAGE_COST, PAGE_COST_ANNOTATED } from "../constants.js";

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
 * `annotated` prices from PAGE_COST_ANNOTATED when it carries the id. Undefined
 * when the table does not price the id, so a caller distinguishes "free" from
 * "unknown".
 */
export function pageCost({
  annotated = false,
  model,
  pages,
}: {
  annotated?: boolean;
  model: string;
  pages: number;
}): number | undefined {
  const perThousand =
    (annotated ? PAGE_COST_ANNOTATED[model] : undefined) ?? PAGE_COST[model];
  if (perThousand === undefined || !Number.isFinite(pages)) {
    return undefined;
  }
  return (perThousand * pages) / PAGES_PER_PRICE_UNIT;
}
