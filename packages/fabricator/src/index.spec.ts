import { describe, it, expect } from "vitest";
import { fabricator, Fabricator, random } from "./index.js";

describe("fabricator", () => {
  it("should return a Fabricator instance without seed", () => {
    const result = fabricator();
    expect(result).toBeInstanceOf(Fabricator);
  });

  it("should return a Fabricator instance with string seed", () => {
    const result = fabricator("test-seed");
    expect(result).toBeInstanceOf(Fabricator);
  });

  it("should return a Fabricator instance with number seed", () => {
    const result = fabricator(42);
    expect(result).toBeInstanceOf(Fabricator);
  });

  it("should return different instances on multiple calls", () => {
    const result1 = fabricator("seed");
    const result2 = fabricator("seed");
    expect(result1).not.toBe(result2);
  });

  it("should produce deterministic output with same seed", () => {
    const fab1 = fabricator("test-seed");
    const fab2 = fabricator("test-seed");

    const name1 = fab1.faker.person.firstName();
    const name2 = fab2.faker.person.firstName();

    expect(name1).toBe(name2);
  });

  it("should produce different output with different seeds", () => {
    const fab1 = fabricator("seed1");
    const fab2 = fabricator("seed2");

    const name1 = fab1.faker.person.firstName();
    const name2 = fab2.faker.person.firstName();

    expect(name1).not.toBe(name2);
  });

  it("should allow access to faker instance", () => {
    const fab = fabricator(123);
    const faker = fab.faker;

    const email = faker.internet.email();
    expect(typeof email).toBe("string");
    expect(email).toContain("@");
  });
});

describe("random", () => {
  it("should return a function", () => {
    const rng = random();
    expect(typeof rng).toBe("function");
  });

  it("should generate numbers between 0 and 1 by default", () => {
    const rng = random();
    const results = Array.from({ length: 10 }, () => rng());

    results.forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    });
  });

  it("should produce deterministic results with same string seed", () => {
    const rng1 = random("test-seed");
    const rng2 = random("test-seed");

    const results1 = Array.from({ length: 5 }, () => rng1());
    const results2 = Array.from({ length: 5 }, () => rng2());

    expect(results1).toEqual(results2);
  });

  it("should produce deterministic results with same number seed", () => {
    const rng1 = random(42);
    const rng2 = random(42);

    const results1 = Array.from({ length: 5 }, () => rng1());
    const results2 = Array.from({ length: 5 }, () => rng2());

    expect(results1).toEqual(results2);
  });

  it("should produce different results with different seeds", () => {
    const rng1 = random("seed1");
    const rng2 = random("seed2");

    const results1 = Array.from({ length: 5 }, () => rng1());
    const results2 = Array.from({ length: 5 }, () => rng2());

    expect(results1).not.toEqual(results2);
  });

  it("should generate integers with integer flag", () => {
    const rng = random(123);
    const results = Array.from({ length: 10 }, () =>
      rng({ min: 1, max: 100, integer: true }),
    );

    results.forEach((value) => {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(100);
    });
  });

  it("should respect min and max bounds", () => {
    const rng = random();
    const results = Array.from({ length: 10 }, () => rng({ min: 10, max: 20 }));

    results.forEach((value) => {
      expect(value).toBeGreaterThanOrEqual(10);
      expect(value).toBeLessThanOrEqual(20);
    });
  });

  it("should work without seed for random output", () => {
    const rng1 = random();
    const rng2 = random();

    const results1 = Array.from({ length: 5 }, () => rng1());
    const results2 = Array.from({ length: 5 }, () => rng2());

    // Very unlikely to be all the same
    const allSame = results1.every((val, idx) => val === results2[idx]);
    expect(allSame).toBe(false);
  });
});
