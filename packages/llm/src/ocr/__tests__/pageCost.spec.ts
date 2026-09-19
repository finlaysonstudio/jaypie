import { describe, expect, it } from "vitest";

import { MODEL, PAGE_COST } from "../../constants.js";
import { pageCost } from "../pageCost.js";

describe("pageCost", () => {
  it("Works", () => {
    expect(pageCost).toBeFunction();
  });

  it("Prices per thousand pages", () => {
    expect(pageCost({ model: MODEL.MISTRAL.OCR, pages: 1000 })).toBe(
      PAGE_COST[MODEL.MISTRAL.OCR],
    );
    expect(pageCost({ model: MODEL.LLAMAPARSE.FAST, pages: 8 })).toBeCloseTo(
      0.01,
    );
  });

  it("Returns undefined for an unpriced id", () => {
    expect(pageCost({ model: "mistral-ocr-latest", pages: 3 })).toBeUndefined();
  });

  it("Prices every LlamaParse tier and Mistral OCR", () => {
    for (const model of [
      ...Object.values(MODEL.LLAMAPARSE),
      MODEL.MISTRAL.OCR,
    ]) {
      expect(pageCost({ model, pages: 1 })).toBeGreaterThan(0);
    }
  });
});
