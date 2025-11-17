import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { fabricator, Fabricator, random } from "./index.js";

describe("fabricator", () => {
  let originalProjectSeed: string | undefined;

  beforeEach(() => {
    originalProjectSeed = process.env.PROJECT_SEED;
  });

  afterEach(() => {
    if (originalProjectSeed !== undefined) {
      process.env.PROJECT_SEED = originalProjectSeed;
    } else {
      delete process.env.PROJECT_SEED;
    }
  });
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

  it("should accept options object with name", () => {
    const fab = fabricator({ name: "Custom Name" });
    expect(fab.name).toBe("Custom Name");
  });

  it("should accept options object with seed", () => {
    const fab1 = fabricator({ seed: "options-seed" });
    const fab2 = fabricator({ seed: "options-seed" });

    expect(fab1.faker.person.firstName()).toBe(fab2.faker.person.firstName());
  });

  it("should accept seed and options", () => {
    const fab = fabricator("my-seed", { name: "Named" });
    expect(fab.name).toBe("Named");

    // Verify the seed is being used by comparing instances with same signature
    const fab2 = fabricator("my-seed", { name: "Named" });
    expect(fab.faker.person.firstName()).toBe(fab2.faker.person.firstName());
  });

  it("should generate capitalized name when no name provided", () => {
    const fab = fabricator("test-seed");
    expect(typeof fab.name).toBe("string");

    const words = fab.name.split(" ");
    expect(words.length).toBe(2);

    words.forEach((word) => {
      expect(word[0]).toBe(word[0].toUpperCase());
    });
  });

  it("should allow access to name property", () => {
    const fab = fabricator({ name: "Test Fabricator" });
    expect(fab.name).toBe("Test Fabricator");
  });

  it("should have id property", () => {
    const fab = fabricator("test-seed");
    expect(typeof fab.id).toBe("string");
    expect(fab.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("should use UUID seed as lowercase id", () => {
    const uuid = "550E8400-E29B-41D4-A716-446655440000";
    const fab = fabricator(uuid);
    expect(fab.id).toBe(uuid.toLowerCase());
  });

  it("should generate deterministic id from seed", () => {
    const fab1 = fabricator("my-seed");
    const fab2 = fabricator("my-seed");
    expect(fab1.id).toBe(fab2.id);
  });

  it("should use PROJECT_SEED when no seed provided", () => {
    process.env.PROJECT_SEED = "env-test-seed";

    const fab1 = fabricator();
    const fab2 = fabricator();

    expect(fab1.id).toBe(fab2.id);
  });

  it("should prefer explicit seed over PROJECT_SEED", () => {
    process.env.PROJECT_SEED = "env-seed";

    const fabEnv = fabricator();
    const fabExplicit = fabricator("explicit-seed");

    expect(fabEnv.id).not.toBe(fabExplicit.id);
  });

  it("should have next() method", () => {
    const fab = fabricator("test-seed");
    const nextFab = fab.next();
    expect(nextFab).toBeInstanceOf(Fabricator);
    expect(nextFab.id).not.toBe(fab.id);
  });

  it("should chain next() calls", () => {
    const fab1 = fabricator("test-seed");
    const fab2 = fab1.next();
    const fab3 = fab2.next();

    // Each should be different
    expect(fab1.id).not.toBe(fab2.id);
    expect(fab2.id).not.toBe(fab3.id);

    // But deterministic
    const fab1Fresh = fabricator("test-seed");
    const fab2Fresh = fab1Fresh.next();
    expect(fab1.id).toBe(fab1Fresh.id);
    expect(fab2.id).toBe(fab2Fresh.id);
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
