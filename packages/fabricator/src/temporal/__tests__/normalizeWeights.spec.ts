import { describe, expect, it } from "vitest";

import { normalizeWeights } from "../normalizeWeights.js";

describe("normalizeWeights", () => {
  //
  // Base Cases
  //

  describe("Base Cases", () => {
    it("returns an array", () => {
      const result = normalizeWeights([1, 2, 3]);
      expect(Array.isArray(result)).toBe(true);
    });

    it("returns same length as input", () => {
      const input = [1, 2, 3, 4, 5];
      const result = normalizeWeights(input);
      expect(result.length).toBe(input.length);
    });

    it("returns empty array for empty input", () => {
      const result = normalizeWeights([]);
      expect(result).toEqual([]);
    });
  });

  //
  // Happy Paths
  //

  describe("Happy Paths", () => {
    it("normalizes simple weights to sum to 1", () => {
      const result = normalizeWeights([1, 2, 3, 4]);
      const sum = result.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0);
    });

    it("returns correct proportions for equal weights", () => {
      const result = normalizeWeights([5, 5]);
      expect(result[0]).toBeCloseTo(0.5);
      expect(result[1]).toBeCloseTo(0.5);
    });

    it("returns correct proportions for [1, 2, 3, 4]", () => {
      const result = normalizeWeights([1, 2, 3, 4]);
      expect(result[0]).toBeCloseTo(0.1);
      expect(result[1]).toBeCloseTo(0.2);
      expect(result[2]).toBeCloseTo(0.3);
      expect(result[3]).toBeCloseTo(0.4);
    });
  });

  //
  // Error Conditions
  //

  describe("Error Conditions", () => {
    it("handles all zero weights", () => {
      const result = normalizeWeights([0, 0, 0]);
      // Should return original (no division by zero error)
      expect(result).toEqual([0, 0, 0]);
    });
  });

  //
  // Features
  //

  describe("Features", () => {
    it("handles single value", () => {
      const result = normalizeWeights([5]);
      expect(result[0]).toBeCloseTo(1.0);
    });

    it("handles decimal weights", () => {
      const result = normalizeWeights([0.5, 1.5]);
      expect(result[0]).toBeCloseTo(0.25);
      expect(result[1]).toBeCloseTo(0.75);
    });

    it("handles large numbers", () => {
      const result = normalizeWeights([1000, 2000, 3000]);
      expect(result[0]).toBeCloseTo(1 / 6);
      expect(result[1]).toBeCloseTo(2 / 6);
      expect(result[2]).toBeCloseTo(3 / 6);
    });

    it("handles small numbers", () => {
      const result = normalizeWeights([0.001, 0.002, 0.003]);
      expect(result[0]).toBeCloseTo(1 / 6);
      expect(result[1]).toBeCloseTo(2 / 6);
      expect(result[2]).toBeCloseTo(3 / 6);
    });
  });

  //
  // Specific Scenarios
  //

  describe("Specific Scenarios", () => {
    it("preserves relative proportions", () => {
      const result = normalizeWeights([10, 20, 30, 40]);
      // Ratio between consecutive elements should be maintained
      expect(result[1] / result[0]).toBeCloseTo(2);
      expect(result[2] / result[1]).toBeCloseTo(1.5);
      expect(result[3] / result[2]).toBeCloseTo(4 / 3);
    });
  });
});
