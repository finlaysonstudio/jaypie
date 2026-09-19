import { BadRequestError } from "@jaypie/errors";

//
//
// Constants
//

const RANGE_PATTERN = /^(\d+)\s*-\s*(\d+)$/;
const SINGLE_PATTERN = /^\d+$/;

//
//
// Main
//

/**
 * Normalize a page selection to sorted, de-duplicated 1-indexed integers.
 *
 * Accepts an array (`[3, 1, 3]` → `[1, 3]`) or a range string in the form
 * both vendors understand (`"1,3,5-10"`). Page numbers below 1 and tokens
 * that are not integers or ascending ranges are rejected: a silent drop
 * would OCR the wrong pages and bill for them.
 */
export function expandPageSelection(
  pages?: number[] | string,
): number[] | undefined {
  if (pages === undefined) {
    return undefined;
  }

  const collected = new Set<number>();

  if (Array.isArray(pages)) {
    for (const page of pages) {
      if (!Number.isInteger(page) || page < 1) {
        throw new BadRequestError(
          `Page selection must contain positive integers; received ${page}`,
        );
      }
      collected.add(page);
    }
  } else {
    const tokens = pages
      .split(",")
      .map((token) => token.trim())
      .filter((token) => token.length > 0);
    for (const token of tokens) {
      if (SINGLE_PATTERN.test(token)) {
        collected.add(Number(token));
        continue;
      }
      const range = RANGE_PATTERN.exec(token);
      if (!range) {
        throw new BadRequestError(
          `Page selection token "${token}" is not a page or an ascending range`,
        );
      }
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start > end) {
        throw new BadRequestError(
          `Page range "${token}" must ascend; received ${start} after ${end}`,
        );
      }
      for (let page = start; page <= end; page++) {
        collected.add(page);
      }
    }
    for (const page of collected) {
      if (page < 1) {
        throw new BadRequestError(
          `Page selection is 1-indexed; received page ${page}`,
        );
      }
    }
  }

  const sorted = [...collected].sort((a, b) => a - b);
  return sorted.length > 0 ? sorted : undefined;
}
