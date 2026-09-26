import { describe, expect, it } from "vitest";

import { MODEL, PAGE_COST, PAGE_COST_ANNOTATED } from "../../constants.js";
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

  it("Prices annotated pages from the annotated table", () => {
    expect(
      pageCost({ annotated: true, model: MODEL.MISTRAL.OCR, pages: 1000 }),
    ).toBe(PAGE_COST_ANNOTATED[MODEL.MISTRAL.OCR]);
  });

  it("Falls back to the base rate when an id has no annotated rate", () => {
    expect(
      pageCost({ annotated: true, model: MODEL.LLAMAPARSE.FAST, pages: 1000 }),
    ).toBe(PAGE_COST[MODEL.LLAMAPARSE.FAST]);
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
