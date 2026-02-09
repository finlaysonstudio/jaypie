import { describe, expect, it } from "vitest";

import { isValidApiKeyFormat } from "../checksum.js";
import { generateKeyFromSeed, hashKey } from "../generate.js";

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
    expect(isValidApiKeyFormat(key)).toBe(true);
  });

  it("generates a key with correct prefix", () => {
    const key = generateKeyFromSeed("test-seed");
    expect(key).toMatch(/^sk_jpi_/);
  });

  it("generates a key with correct length", () => {
    const key = generateKeyFromSeed("test-seed");
    expect(key).toHaveLength(43);
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

describe("hashKey", () => {
  it("is a function", () => {
    expect(typeof hashKey).toBe("function");
  });

  it("returns a hex string", () => {
    const hash = hashKey("sk_jpi_test");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    const hash1 = hashKey("sk_jpi_test");
    const hash2 = hashKey("sk_jpi_test");
    expect(hash1).toBe(hash2);
  });

  it("returns different hashes for different keys", () => {
    const hash1 = hashKey("key-a");
    const hash2 = hashKey("key-b");
    expect(hash1).not.toBe(hash2);
  });
});
