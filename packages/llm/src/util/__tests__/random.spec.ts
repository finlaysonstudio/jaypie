import { afterEach, describe, expect, it, vi } from "vitest";

// Subject
import random, { DEFAULT_MAX, DEFAULT_MIN } from "../random.js";

//
//
// Mock modules
//

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Random Number Generator", () => {
  it("generates consistent numbers with same seed", () => {
    const rng1 = random("test-seed");
    const rng2 = random("test-seed");

    expect(rng1()).toBe(rng2());
  });

  it("generates different numbers with different seeds", () => {
    const rng1 = random("seed1");
    const rng2 = random("seed2");

    expect(rng1()).not.toBe(rng2());
  });

  it("respects min and max bounds", () => {
    const rng = random("test");
    const min = 10;
    const max = 20;

    for (let i = 0; i < 100; i++) {
      const value = rng({ min, max });
      expect(value).toBeGreaterThanOrEqual(min);
      expect(value).toBeLessThanOrEqual(max);
    }
  });

  it("generates integers when specified", () => {
    const rng = random("test");
    const value = rng({ integer: true });
    expect(Number.isInteger(value)).toBe(true);
  });

  it("uses normal distribution when mean and stddev are provided", () => {
    const rng = random("test");
    const mean = 5;
    const stddev = 1;

    // Generate a sample to verify it's roughly normally distributed
    const samples = Array.from({ length: 1000 }, () => rng({ mean, stddev }));

    const sampleMean = samples.reduce((a, b) => a + b) / samples.length;
    expect(Math.abs(sampleMean - mean)).toBeLessThan(0.5);
  });

  it("clamps normal distribution to min/max", () => {
    const rng = random("test");
    const min = 0;
    const max = 10;
    const mean = 5;
    const stddev = 10; // Large stddev to ensure values would go outside bounds

    for (let i = 0; i < 100; i++) {
      const value = rng({ min, max, mean, stddev });
      expect(value).toBeGreaterThanOrEqual(min);
      expect(value).toBeLessThanOrEqual(max);
    }
  });

  it("adds start value to the result", () => {
    const rng = random("test");
    const start = 100;
    const min = 0;
    const max = 1;

    for (let i = 0; i < 100; i++) {
      const value = rng({ start, min, max });
      expect(value).toBeGreaterThanOrEqual(start + min);
      expect(value).toBeLessThanOrEqual(start + max);
    }
  });

  it("adds start value to normal distribution", () => {
    const rng = random("test");
    const start = 100;
    const mean = 5;
    const stddev = 1;

    const samples = Array.from({ length: 1000 }, () =>
      rng({ start, mean, stddev }),
    );

    const sampleMean = samples.reduce((a, b) => a + b) / samples.length;
    expect(Math.abs(sampleMean - (start + mean))).toBeLessThan(0.5);
  });

  it("uses defaults when min/max are undefined", () => {
    const rng = random("test");

    for (let i = 0; i < 100; i++) {
      const value = rng({});
      expect(value).toBeGreaterThanOrEqual(DEFAULT_MIN);
      expect(value).toBeLessThanOrEqual(DEFAULT_MAX);
    }
  });

  it("respects single bound when only min is provided", () => {
    const rng = random("test");
    const min = 10;

    for (let i = 0; i < 100; i++) {
      const value = rng({ min });
      expect(value).toBeGreaterThanOrEqual(min);
      expect(value).toBeLessThanOrEqual(min * 2);
    }
  });

  it("respects single bound when only max is provided", () => {
    const rng = random("test");
    const max = 0.5;

    for (let i = 0; i < 100; i++) {
      const value = rng({ max });
      expect(value).toBeGreaterThanOrEqual(DEFAULT_MIN);
      expect(value).toBeLessThanOrEqual(max);
    }
  });

  it("allows normal distribution to exceed undefined bounds", () => {
    const rng = random("test");
    const mean = 5;
    const stddev = 2;
    let hasValueBelow0 = false;
    let hasValueAbove10 = false;

    // Generate enough samples to likely get values outside 0-10 range
    for (let i = 0; i < 1000; i++) {
      const value = rng({ mean, stddev });
      if (value < 0) hasValueBelow0 = true;
      if (value > 10) hasValueAbove10 = true;
    }

    expect(hasValueBelow0).toBe(true);
    expect(hasValueAbove10).toBe(true);
  });

  it("only clamps normal distribution on defined bounds", () => {
    const rng = random("test");
    const min = 0; // Only clamp lower bound
    const mean = 5;
    const stddev = 4;
    let hasValueAbove10 = false;

    // Generate samples - should never go below 0, but should go above 10
    for (let i = 0; i < 1000; i++) {
      const value = rng({ min, mean, stddev });
      expect(value).toBeGreaterThanOrEqual(min);
      if (value > 10) hasValueAbove10 = true;
    }

    expect(hasValueAbove10).toBe(true);
  });

  it("throws ConfigurationError when min is greater than max", () => {
    const rng = random("test");
    expect(() => rng({ min: 10, max: 5 })).toThrowConfigurationError();
  });

  it("sets max to min*2 when only min is provided", () => {
    const rng = random("test");
    const min = 10;

    for (let i = 0; i < 100; i++) {
      const value = rng({ min });
      expect(value).toBeGreaterThanOrEqual(min);
      expect(value).toBeLessThanOrEqual(min * 2);
    }
  });

  it("throws ConfigurationError with normal distribution when min > max", () => {
    const rng = random("test");
    expect(() =>
      rng({ min: 10, max: 5, mean: 7, stddev: 1 }),
    ).toThrowConfigurationError();
  });

  it("should generate number between 0-1 when called directly without options", () => {
    const rng = random("test-seed");
    const value = rng();

    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
    expect(typeof value).toBe("number");
  });

  it("uses different RNG when seed is provided in options", () => {
    const rng1 = random("default-seed");
    const rng2 = random("default-seed");
    const rng3 = random("default-seed");

    // Same seed string should produce same sequence
    const value1 = rng1({ seed: "seed1" });
    const value2 = rng2({ seed: "seed1" });
    expect(value1).toBe(value2);

    // Different seeds should produce different sequences
    const value3 = rng3({ seed: "seed2" });
    expect(value1).not.toBe(value3);
  });

  it("respects precision parameter for decimal places", () => {
    const rng = random("test");
    const precision = 2;

    for (let i = 0; i < 100; i++) {
      const value = rng({ precision });
      const decimalPlaces = value.toString().split(".")[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(precision);
    }
  });

  it("ignores precision parameter when integer is true", () => {
    const rng = random("test");
    const value = rng({ precision: 2, integer: true });
    expect(Number.isInteger(value)).toBe(true);
  });

  it("respects precision with normal distribution", () => {
    const rng = random("test");
    const precision = 3;
    const mean = 5;
    const stddev = 1;

    for (let i = 0; i < 100; i++) {
      const value = rng({ precision, mean, stddev });
      const decimalPlaces = value.toString().split(".")[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(precision);
    }
  });

  it("handles precision of 0 correctly", () => {
    const rng = random("test");
    const value = rng({ precision: 0 });
    expect(Number.isInteger(value)).toBe(true);
  });

  it("uses precision 2 when currency is true", () => {
    const rng = random("test");

    for (let i = 0; i < 100; i++) {
      const value = rng({ currency: true });
      const decimalPlaces = value.toString().split(".")[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    }
  });

  it("uses lowest precision when multiple precision options are set", () => {
    const rng = random("test");

    // Test precision vs currency
    const value1 = rng({ precision: 1, currency: true }); // Should use precision 1
    const decimals1 = value1.toString().split(".")[1]?.length || 0;
    expect(decimals1).toBeLessThanOrEqual(1);

    // Test precision vs integer
    const value2 = rng({ precision: 3, integer: true }); // Should use precision 0
    expect(Number.isInteger(value2)).toBe(true);

    // Test all three
    const value3 = rng({ precision: 3, currency: true, integer: true }); // Should use precision 0
    expect(Number.isInteger(value3)).toBe(true);
  });

  it("uses currency precision with normal distribution", () => {
    const rng = random("test");
    const mean = 5;
    const stddev = 1;

    for (let i = 0; i < 100; i++) {
      const value = rng({ currency: true, mean, stddev });
      const decimalPlaces = value.toString().split(".")[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    }
  });

  it("respects precision precedence", () => {
    const rng = random("test");

    // Test cases in order of precedence (lowest wins)
    const testCases = [
      { options: { integer: true, precision: 2, currency: true }, expected: 0 },
      { options: { precision: 1, currency: true }, expected: 1 },
      { options: { precision: 3, currency: true }, expected: 2 },
      { options: { precision: 4 }, expected: 4 },
      { options: { currency: true }, expected: 2 },
    ];

    testCases.forEach(({ options, expected }) => {
      const value = rng(options);
      const decimalPlaces = value.toString().split(".")[1]?.length || 0;
      expect(decimalPlaces).toBeLessThanOrEqual(expected);
    });
  });
});
