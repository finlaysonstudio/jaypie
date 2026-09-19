import { describe, expect, it } from "vitest";

import { expandPageSelection } from "../expandPageSelection.js";

describe("expandPageSelection", () => {
  it("Works", () => {
    expect(expandPageSelection).toBeFunction();
  });

  describe("Base Cases", () => {
    it("Returns undefined for no selection", () => {
      expect(expandPageSelection()).toBeUndefined();
      expect(expandPageSelection([])).toBeUndefined();
      expect(expandPageSelection("")).toBeUndefined();
    });
  });

  describe("Error Conditions", () => {
    it("Rejects zero, negatives, and fractions in arrays", () => {
      expect(() => expandPageSelection([0])).toThrow(/positive integers/);
      expect(() => expandPageSelection([-1])).toThrow(/positive integers/);
      expect(() => expandPageSelection([1.5])).toThrow(/positive integers/);
    });

    it("Rejects malformed and descending range tokens", () => {
      expect(() => expandPageSelection("a")).toThrow(/not a page/);
      expect(() => expandPageSelection("5-3")).toThrow(/must ascend/);
      expect(() => expandPageSelection("0")).toThrow(/1-indexed/);
    });
  });

  describe("Happy Paths", () => {
    it("Sorts and de-duplicates an array", () => {
      expect(expandPageSelection([3, 1, 3, 2])).toEqual([1, 2, 3]);
    });

    it("Expands a range string", () => {
      expect(expandPageSelection("1,3,5-7")).toEqual([1, 3, 5, 6, 7]);
    });

    it("Tolerates whitespace and stray commas", () => {
      expect(expandPageSelection(" 2 , 4 - 5 ,, ")).toEqual([2, 4, 5]);
    });
  });
});
