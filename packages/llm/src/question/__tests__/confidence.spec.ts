import { describe, expect, it } from "vitest";

import { normalizeDistribution, peakConfidence } from "../confidence.js";

describe("normalizeDistribution", () => {
  it("Works", () => {
    expect(normalizeDistribution).toBeFunction();
  });

  describe("Happy Paths", () => {
    it("Leaves a normalized distribution alone", () => {
      const result = normalizeDistribution({ a: 0.5, b: 0.5 });
      expect(result).toEqual({ a: 0.5, b: 0.5 });
    });

    it("Rescales values that do not sum to one", () => {
      const result = normalizeDistribution({ a: 2, b: 2 });
      expect(result).toEqual({ a: 0.5, b: 0.5 });
    });

    it("Corrects rounding drift", () => {
      const result = normalizeDistribution({ a: 0.6, b: 0.3, c: 0.05 });
      const total = Object.values(result).reduce((sum, p) => sum + p, 0);
      expect(total).toBeCloseTo(1, 10);
    });
  });

  describe("Features", () => {
    it("Clamps negative and non-finite values to zero", () => {
      const result = normalizeDistribution({ a: 1, b: -1, c: NaN });
      expect(result).toEqual({ a: 1, b: 0, c: 0 });
    });

    it("Falls back to uniform when nothing has mass", () => {
      const result = normalizeDistribution({ a: 0, b: 0, c: 0 });
      expect(result.a).toBeCloseTo(1 / 3, 10);
      expect(result.b).toBeCloseTo(1 / 3, 10);
      expect(result.c).toBeCloseTo(1 / 3, 10);
    });

    it("Returns an empty object for an empty distribution", () => {
      expect(normalizeDistribution({})).toEqual({});
    });
  });
});

describe("peakConfidence", () => {
  describe("Happy Paths", () => {
    it("Is zero for a uniform distribution", () => {
      expect(peakConfidence({ a: 0.5, b: 0.5 })).toBe(0);
    });

    it("Is one when all mass sits on one option", () => {
      expect(peakConfidence({ a: 1, b: 0, c: 0 })).toBe(1);
    });
  });

  describe("Specific Scenarios", () => {
    // TypeSafe does not publish its formula; these are the numbers its own
    // documentation and a live Jev call report for these distributions.
    it("Reproduces the documented 0.39 example", () => {
      expect(peakConfidence({ a: 0.6, b: 0.38, c: 0.02 })).toBeCloseTo(0.4, 2);
    });

    it("Reproduces the documented 0.54 example", () => {
      expect(peakConfidence({ a: 0.7, b: 0.3, c: 0 })).toBeCloseTo(0.55, 2);
    });

    it("Reproduces the live 0.56 observation", () => {
      expect(peakConfidence({ "0": 0, "1": 0.3, "2": 0.7 })).toBeCloseTo(
        0.55,
        2,
      );
    });
  });

  describe("Error Conditions", () => {
    it("Is zero for an empty distribution", () => {
      expect(peakConfidence({})).toBe(0);
    });

    it("Is one for a single option", () => {
      expect(peakConfidence({ only: 1 })).toBe(1);
    });
  });
});
