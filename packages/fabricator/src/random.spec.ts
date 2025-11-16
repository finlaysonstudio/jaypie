import { describe, it, expect } from "vitest";
import { random, DEFAULT_MIN, DEFAULT_MAX } from "./random.js";
import { ConfigurationError } from "@jaypie/errors";

describe("random", () => {
  describe("basic functionality", () => {
    it("should generate numbers between 0 and 1 by default", () => {
      const rng = random();
      const results = Array.from({ length: 10 }, () => rng());

      results.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(DEFAULT_MIN);
        expect(value).toBeLessThanOrEqual(DEFAULT_MAX);
      });
    });

    it("should generate deterministic results with same seed", () => {
      const rng1 = random("test-seed");
      const rng2 = random("test-seed");

      const results1 = Array.from({ length: 5 }, () => rng1());
      const results2 = Array.from({ length: 5 }, () => rng2());

      expect(results1).toEqual(results2);
    });

    it("should generate different results with different seeds", () => {
      const rng1 = random("seed1");
      const rng2 = random("seed2");

      const results1 = Array.from({ length: 5 }, () => rng1());
      const results2 = Array.from({ length: 5 }, () => rng2());

      expect(results1).not.toEqual(results2);
    });
  });

  describe("integer generation", () => {
    it("should generate integers when integer flag is true", () => {
      const rng = random("int-seed");
      const results = Array.from({ length: 10 }, () =>
        rng({ min: 1, max: 100, integer: true }),
      );

      results.forEach((value) => {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(100);
      });
    });

    it("should respect min and max for integers", () => {
      const rng = random();
      const results = Array.from({ length: 20 }, () =>
        rng({ min: 5, max: 10, integer: true }),
      );

      results.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(5);
        expect(value).toBeLessThanOrEqual(10);
        expect(Number.isInteger(value)).toBe(true);
      });
    });
  });

  describe("min/max bounds", () => {
    it("should generate floats within min/max range", () => {
      const rng = random();
      const results = Array.from({ length: 10 }, () =>
        rng({ min: 10, max: 20 }),
      );

      results.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(10);
        expect(value).toBeLessThanOrEqual(20);
      });
    });

    it("should double min when only min is provided", () => {
      const rng = random();
      const results = Array.from({ length: 10 }, () => rng({ min: 5 }));

      results.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(5);
        expect(value).toBeLessThanOrEqual(10); // min * 2
      });
    });

    it("should throw ConfigurationError when min > max", () => {
      const rng = random();

      expect(() => rng({ min: 10, max: 5 })).toThrow(ConfigurationError);
      expect(() => rng({ min: 10, max: 5 })).toThrow(
        "Invalid bounds: min (10) cannot be greater than max (5)",
      );
    });
  });

  describe("normal distribution", () => {
    it("should generate values from normal distribution", () => {
      const rng = random("normal-seed");
      const results = Array.from({ length: 100 }, () =>
        rng({ mean: 50, stddev: 10 }),
      );

      // Check that results cluster around mean
      const avg = results.reduce((a, b) => a + b, 0) / results.length;
      expect(avg).toBeGreaterThan(40);
      expect(avg).toBeLessThan(60);
    });

    it("should clamp normal distribution to min/max bounds", () => {
      const rng = random();
      const results = Array.from({ length: 50 }, () =>
        rng({ mean: 50, stddev: 100, min: 0, max: 100 }),
      );

      results.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      });
    });
  });

  describe("precision", () => {
    it("should respect precision parameter", () => {
      const rng = random();
      const results = Array.from({ length: 10 }, () =>
        rng({ precision: 2, min: 0, max: 10 }),
      );

      results.forEach((value) => {
        const decimalPlaces = (value.toString().split(".")[1] || "").length;
        expect(decimalPlaces).toBeLessThanOrEqual(2);
      });
    });

    it("should use 2 decimal places for currency", () => {
      const rng = random();
      const results = Array.from({ length: 10 }, () =>
        rng({ currency: true, min: 0, max: 100 }),
      );

      results.forEach((value) => {
        const decimalPlaces = (value.toString().split(".")[1] || "").length;
        expect(decimalPlaces).toBeLessThanOrEqual(2);
      });
    });

    it("should apply 0 precision for integers", () => {
      const rng = random();
      const results = Array.from({ length: 10 }, () =>
        rng({ integer: true, min: 1, max: 100 }),
      );

      results.forEach((value) => {
        expect(Number.isInteger(value)).toBe(true);
      });
    });
  });

  describe("start parameter", () => {
    it("should offset values by start parameter", () => {
      const rng = random("start-seed");
      const baseValue = rng({ min: 0, max: 10 });
      const offsetValue = rng({ min: 0, max: 10, start: 100 });

      expect(offsetValue).toBeGreaterThan(100);
      expect(baseValue).toBeLessThan(100);
    });
  });

  describe("per-call seeding", () => {
    it("should use per-call seed for consistent behavior", () => {
      const rng1 = random();
      const rng2 = random();

      // Each should get same value when using same per-call seed
      const value1 = rng1({ seed: "call-seed" });
      const value2 = rng2({ seed: "call-seed" });

      expect(value1).toBe(value2);
    });

    it("should cache and advance per-call seeds", () => {
      const rng = random();

      const value1 = rng({ seed: "cached-seed" });
      const value2 = rng({ seed: "cached-seed" });

      // Should be different because the seed advances
      expect(value1).not.toBe(value2);
    });

    it("should maintain separate sequences for different per-call seeds", () => {
      const rng = random();

      const values1 = Array.from({ length: 3 }, () => rng({ seed: "seed-a" }));
      const values2 = Array.from({ length: 3 }, () => rng({ seed: "seed-b" }));

      // Different seeds should produce different sequences
      expect(values1).not.toEqual(values2);
    });
  });
});
