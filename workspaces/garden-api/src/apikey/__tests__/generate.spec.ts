import { describe, expect, it } from "vitest";
import { validateJaypieKey } from "jaypie";

import { generateKeyFromSeed } from "../generate.js";

//
//
// Tests
//

describe("generateKeyFromSeed", () => {
  it("is a function", () => {
    expect(typeof generateKeyFromSeed).toBe("function");
  });

  it("generates a key with valid format", () => {
    const key = generateKeyFromSeed("test-seed");
    expect(validateJaypieKey(key, { issuer: "jaypie" })).toBe(true);
  });

  it("generates a key with correct prefix", () => {
    const key = generateKeyFromSeed("test-seed");
    expect(key).toMatch(/^sk_jaypie_/);
  });

  it("generates a key with correct length", () => {
    const key = generateKeyFromSeed("test-seed");
    expect(key).toHaveLength(46);
  });

  it("is deterministic for the same seed", () => {
    const key1 = generateKeyFromSeed("my-seed");
    const key2 = generateKeyFromSeed("my-seed");
    expect(key1).toBe(key2);
  });

  it("generates different keys for different seeds", () => {
    const key1 = generateKeyFromSeed("seed-a");
    const key2 = generateKeyFromSeed("seed-b");
    expect(key1).not.toBe(key2);
  });
});
