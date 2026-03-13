import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  generateJaypieKey,
  hashJaypieKey,
  validateJaypieKey,
} from "../lib/functions/jaypieKey.function.js";

//
//
// Constants
//

const BASE62 =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

//
//
// Tests
//

describe("generateJaypieKey", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof generateJaypieKey).toBe("function");
    });

    it("works with zero params", () => {
      const key = generateJaypieKey();
      expect(typeof key).toBe("string");
    });
  });

  describe("Happy Paths", () => {
    it("generates a key with default format", () => {
      const key = generateJaypieKey();
      // sk_ + 32 body + _ + 4 checksum = 40 chars
      expect(key.length).toBe(40);
      expect(key.startsWith("sk_")).toBe(true);
    });

    it("generates a key with issuer", () => {
      const key = generateJaypieKey({ issuer: "jpi" });
      // sk_jpi_ + 32 body + _ + 4 checksum = 44 chars
      expect(key.length).toBe(44);
      expect(key.startsWith("sk_jpi_")).toBe(true);
    });

    it("generates unique keys each call", () => {
      const key1 = generateJaypieKey();
      const key2 = generateJaypieKey();
      expect(key1).not.toBe(key2);
    });

    it("generates keys with only base62 characters in body", () => {
      const key = generateJaypieKey();
      const body = key.slice(3, 3 + 32); // "sk_" prefix, 32 body
      const base62Set = new Set(BASE62);
      for (const char of body) {
        expect(base62Set.has(char)).toBe(true);
      }
    });
  });

  describe("Custom Params", () => {
    it("uses custom prefix", () => {
      const key = generateJaypieKey({ prefix: "pk" });
      expect(key.startsWith("pk_")).toBe(true);
    });

    it("uses custom separator", () => {
      const key = generateJaypieKey({ separator: "-" });
      expect(key.startsWith("sk-")).toBe(true);
    });

    it("uses custom length", () => {
      const key = generateJaypieKey({ length: 16 });
      // sk_ + 16 body + _ + 4 checksum = 24 chars
      expect(key.length).toBe(24);
    });

    it("uses custom checksum length", () => {
      const key = generateJaypieKey({ checksum: 6 });
      // sk_ + 32 body + _ + 6 checksum = 42 chars
      expect(key.length).toBe(42);
    });

    it("uses custom pool", () => {
      const hexPool = "0123456789abcdef";
      const key = generateJaypieKey({ pool: hexPool });
      const body = key.slice(3, 3 + 32);
      const poolSet = new Set(hexPool);
      for (const char of body) {
        expect(poolSet.has(char)).toBe(true);
      }
    });

    it("combines prefix and issuer with separator", () => {
      const key = generateJaypieKey({
        issuer: "test",
        prefix: "api",
        separator: "-",
      });
      expect(key.startsWith("api-test-")).toBe(true);
    });
  });
});

describe("validateJaypieKey", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof validateJaypieKey).toBe("function");
    });
  });

  describe("Happy Paths", () => {
    it("validates a generated key", () => {
      const key = generateJaypieKey();
      expect(validateJaypieKey(key)).toBe(true);
    });

    it("validates a generated key with issuer", () => {
      const key = generateJaypieKey({ issuer: "jpi" });
      expect(validateJaypieKey(key, { issuer: "jpi" })).toBe(true);
    });

    it("validates with custom params", () => {
      const options = {
        checksum: 6,
        issuer: "test",
        length: 16,
        prefix: "pk",
        separator: "-",
      };
      const key = generateJaypieKey(options);
      expect(validateJaypieKey(key, options)).toBe(true);
    });

    it("validates many keys", () => {
      for (let i = 0; i < 100; i++) {
        const key = generateJaypieKey();
        expect(validateJaypieKey(key)).toBe(true);
      }
    });
  });

  describe("Error Paths", () => {
    it("returns false for non-string", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(validateJaypieKey(123 as any)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(validateJaypieKey("")).toBe(false);
    });

    it("returns false for wrong prefix", () => {
      const key = generateJaypieKey();
      const tampered = "pk" + key.slice(2);
      expect(validateJaypieKey(tampered)).toBe(false);
    });

    it("returns false for wrong length", () => {
      const key = generateJaypieKey();
      expect(validateJaypieKey(key + "x")).toBe(false);
      expect(validateJaypieKey(key.slice(0, -1))).toBe(false);
    });

    it("returns false for tampered body", () => {
      const key = generateJaypieKey();
      // Replace a character in the body to break checksum
      const chars = key.split("");
      chars[5] = chars[5] === "A" ? "B" : "A";
      expect(validateJaypieKey(chars.join(""))).toBe(false);
    });

    it("returns false for invalid characters", () => {
      // Build a key-shaped string with invalid chars
      const invalid = "sk_" + "!".repeat(32) + "_!!!!";
      expect(validateJaypieKey(invalid)).toBe(false);
    });

    it("returns false when issuer mismatch", () => {
      const key = generateJaypieKey({ issuer: "jpi" });
      expect(validateJaypieKey(key)).toBe(false); // no issuer
      expect(validateJaypieKey(key, { issuer: "other" })).toBe(false);
    });

    it("returns false when key has no issuer but validation expects one", () => {
      const key = generateJaypieKey();
      expect(validateJaypieKey(key, { issuer: "jpi" })).toBe(false);
    });
  });

  describe("Backward Compatibility", () => {
    it("validates keys matching garden format (sk_jpi_ + 32 body + _ + 4 checksum)", () => {
      // Generate a key using the garden-compatible parameters
      const key = generateJaypieKey({ issuer: "jpi" });
      expect(key.length).toBe(44);
      expect(key.startsWith("sk_jpi_")).toBe(true);
      expect(validateJaypieKey(key, { issuer: "jpi" })).toBe(true);
    });
  });
});

describe("hashJaypieKey", () => {
  const originalEnv = process.env.PROJECT_SALT;

  beforeEach(() => {
    delete process.env.PROJECT_SALT;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.PROJECT_SALT = originalEnv;
    } else {
      delete process.env.PROJECT_SALT;
    }
    vi.restoreAllMocks();
  });

  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof hashJaypieKey).toBe("function");
    });
  });

  describe("Happy Paths", () => {
    it("returns a 64-char hex string", () => {
      const key = generateJaypieKey();
      const hash = hashJaypieKey(key);
      expect(hash.length).toBe(64);
      expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
    });

    it("is deterministic", () => {
      const key = generateJaypieKey();
      const hash1 = hashJaypieKey(key);
      const hash2 = hashJaypieKey(key);
      expect(hash1).toBe(hash2);
    });

    it("produces different hashes for different keys", () => {
      const key1 = generateJaypieKey();
      const key2 = generateJaypieKey();
      expect(hashJaypieKey(key1)).not.toBe(hashJaypieKey(key2));
    });
  });

  describe("Salt Behavior", () => {
    it("uses plain SHA-256 when no salt", () => {
      const key = "test-key";
      const hash = hashJaypieKey(key);
      const expected = createHash("sha256").update(key).digest("hex");
      expect(hash).toBe(expected);
    });

    it("uses HMAC-SHA256 with explicit salt", () => {
      const key = "test-key";
      const salt = "my-salt";
      const hash = hashJaypieKey(key, { salt });
      const expected = createHmac("sha256", salt).update(key).digest("hex");
      expect(hash).toBe(expected);
    });

    it("uses PROJECT_SALT env when no explicit salt", () => {
      process.env.PROJECT_SALT = "env-salt";
      const key = "test-key";
      const hash = hashJaypieKey(key);
      const expected = createHmac("sha256", "env-salt")
        .update(key)
        .digest("hex");
      expect(hash).toBe(expected);
    });

    it("explicit salt overrides PROJECT_SALT", () => {
      process.env.PROJECT_SALT = "env-salt";
      const key = "test-key";
      const hash = hashJaypieKey(key, { salt: "explicit-salt" });
      const expected = createHmac("sha256", "explicit-salt")
        .update(key)
        .digest("hex");
      expect(hash).toBe(expected);
    });

    it("uses plain SHA-256 when salt is empty string (no warn)", () => {
      const key = "test-key";
      const hash = hashJaypieKey(key, { salt: "" });
      const expected = createHash("sha256").update(key).digest("hex");
      expect(hash).toBe(expected);
    });

    it("produces different hashes with vs without salt", () => {
      const key = "test-key";
      const hashNoSalt = hashJaypieKey(key);
      const hashWithSalt = hashJaypieKey(key, { salt: "my-salt" });
      expect(hashNoSalt).not.toBe(hashWithSalt);
    });
  });
});
