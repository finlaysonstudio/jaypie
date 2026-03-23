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

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

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
      const key = generateJaypieKey({ issuer: "jaypie" });
      // sk_jaypie_ + 32 body + _ + 4 checksum = 47 chars
      expect(key.length).toBe(47);
      expect(key.startsWith("sk_jaypie_")).toBe(true);
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

  describe("Seed-Based Generation", () => {
    it("generates a deterministic key from a seed", () => {
      const key1 = generateJaypieKey({ seed: "my-secret-seed" });
      const key2 = generateJaypieKey({ seed: "my-secret-seed" });
      expect(key1).toBe(key2);
    });

    it("generates different keys for different seeds", () => {
      const key1 = generateJaypieKey({ seed: "seed-one" });
      const key2 = generateJaypieKey({ seed: "seed-two" });
      expect(key1).not.toBe(key2);
    });

    it("generates different keys for same seed with different issuers", () => {
      const key1 = generateJaypieKey({ seed: "same-seed", issuer: "alpha" });
      const key2 = generateJaypieKey({ seed: "same-seed", issuer: "beta" });
      expect(key1).not.toBe(key2);
    });

    it("uses 'jaypie' as default HMAC context when no issuer", () => {
      const key1 = generateJaypieKey({ seed: "test-seed" });
      const key2 = generateJaypieKey({ seed: "test-seed", issuer: "jaypie" });
      // No issuer defaults to "jaypie" for HMAC, but key2 includes issuer in prefix
      // The bodies should be the same since same seed + same HMAC context
      const body1 = key1.slice("sk_".length, "sk_".length + 32);
      const body2 = key2.slice("sk_jaypie_".length, "sk_jaypie_".length + 32);
      expect(body1).toBe(body2);
    });

    it("produces a valid key that passes validation", () => {
      const key = generateJaypieKey({ seed: "validate-me", issuer: "jaypie" });
      expect(validateJaypieKey(key, { issuer: "jaypie" })).toBe(true);
    });

    it("works with all other options", () => {
      const key = generateJaypieKey({
        seed: "full-options",
        checksum: 6,
        issuer: "test",
        prefix: "pk",
        separator: "-",
      });
      expect(key.startsWith("pk-test-")).toBe(true);
      expect(
        validateJaypieKey(key, {
          checksum: 6,
          issuer: "test",
          prefix: "pk",
        }),
      ).toBe(true);
    });
  });

  describe("Optional Prefix", () => {
    it("generates without prefix when prefix is empty", () => {
      const key = generateJaypieKey({ prefix: "" });
      // 32 body + _ + 4 checksum = 37 chars
      expect(key.length).toBe(37);
      // Should not start with a separator
      const base62Set = new Set(BASE62);
      expect(base62Set.has(key[0])).toBe(true);
    });

    it("generates with only issuer when prefix is empty", () => {
      const key = generateJaypieKey({ prefix: "", issuer: "jaypie" });
      // jaypie_ + 32 body + _ + 4 checksum = 44 chars
      expect(key.length).toBe(44);
      expect(key.startsWith("jaypie_")).toBe(true);
    });
  });

  describe("Optional Checksum", () => {
    it("generates without checksum when checksum is 0", () => {
      const key = generateJaypieKey({ checksum: 0 });
      // sk_ + 32 body = 35 chars
      expect(key.length).toBe(35);
      expect(key.startsWith("sk_")).toBe(true);
    });

    it("generates bare body when prefix and checksum are empty/0", () => {
      const key = generateJaypieKey({ prefix: "", checksum: 0 });
      // 32 body only
      expect(key.length).toBe(32);
      const base62Set = new Set(BASE62);
      for (const char of key) {
        expect(base62Set.has(char)).toBe(true);
      }
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
      const key = generateJaypieKey({ issuer: "jaypie" });
      expect(validateJaypieKey(key, { issuer: "jaypie" })).toBe(true);
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

  describe("Optional Prefix", () => {
    it("validates a key without prefix", () => {
      const key = generateJaypieKey({ prefix: "" });
      expect(validateJaypieKey(key, { prefix: "" })).toBe(true);
    });

    it("validates a key without prefix using default options", () => {
      // Prefix is not required — a key generated without prefix should
      // validate even when the validator has default prefix="sk"
      const key = generateJaypieKey({ prefix: "" });
      expect(validateJaypieKey(key)).toBe(true);
    });

    it("validates a key with only issuer (no sk prefix)", () => {
      const key = generateJaypieKey({ prefix: "", issuer: "jaypie" });
      expect(validateJaypieKey(key, { issuer: "jaypie" })).toBe(true);
    });

    it("validates a key with full prefix when validating without prefix", () => {
      // When explicitly passing prefix: "", the validator doesn't look for "sk_"
      // Use default options to validate keys that may or may not have a prefix
      const key = generateJaypieKey(); // has "sk_"
      expect(validateJaypieKey(key)).toBe(true); // default options find "sk_"
      expect(validateJaypieKey(key, { prefix: "" })).toBe(false); // explicit "" won't find "sk_"
    });
  });

  describe("Optional Checksum", () => {
    it("validates a key without checksum", () => {
      const key = generateJaypieKey({ checksum: 0 });
      expect(validateJaypieKey(key, { checksum: 0 })).toBe(true);
    });

    it("validates a key without checksum using default options", () => {
      // Checksum is not required — a key generated without checksum should
      // validate even when the validator has default checksum=4
      const key = generateJaypieKey({ checksum: 0 });
      expect(validateJaypieKey(key)).toBe(true);
    });

    it("validates a bare body (no prefix, no checksum)", () => {
      const key = generateJaypieKey({ prefix: "", checksum: 0 });
      expect(validateJaypieKey(key)).toBe(true);
    });
  });

  describe("Checksum Separator Flexibility", () => {
    it("validates checksum with separator", () => {
      const key = generateJaypieKey(); // sk_<body>_<checksum>
      expect(validateJaypieKey(key)).toBe(true);
    });

    it("validates checksum without separator", () => {
      // Manually construct a key with checksum appended directly to body
      const key = generateJaypieKey();
      // Remove the separator before the checksum
      const parts = key.split("_");
      const checksum = parts.pop()!;
      const withoutSep = parts.join("_") + checksum;
      expect(validateJaypieKey(withoutSep)).toBe(true);
    });
  });

  describe("Separator Flexibility", () => {
    it("validates keys with dash separator", () => {
      const key = generateJaypieKey({ separator: "-" });
      expect(validateJaypieKey(key)).toBe(true);
    });

    it("validates dash-separated key with default options", () => {
      const key = generateJaypieKey({ separator: "-" });
      // Validator should accept both _ and - regardless of separator option
      expect(validateJaypieKey(key)).toBe(true);
    });

    it("validates dash-separated key with issuer", () => {
      const key = generateJaypieKey({ issuer: "jaypie", separator: "-" });
      expect(validateJaypieKey(key, { issuer: "jaypie" })).toBe(true);
    });
  });

  describe("Error Paths", () => {
    it("returns false for non-string", () => {
      expect(validateJaypieKey(123 as any)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(validateJaypieKey("")).toBe(false);
    });

    it("returns false for tampered body", () => {
      const key = generateJaypieKey();
      // Replace a character in the body to break checksum
      const chars = key.split("");
      chars[5] = chars[5] === "A" ? "B" : "A";
      expect(validateJaypieKey(chars.join(""))).toBe(false);
    });

    it("returns false for invalid characters", () => {
      const invalid = "sk_" + "!".repeat(32) + "_!!!!";
      expect(validateJaypieKey(invalid)).toBe(false);
    });

    it("returns false when issuer mismatch", () => {
      const key = generateJaypieKey({ issuer: "jaypie" });
      expect(validateJaypieKey(key)).toBe(false); // no issuer
      expect(validateJaypieKey(key, { issuer: "other" })).toBe(false);
    });

    it("returns false when key has no issuer but validation expects one", () => {
      const key = generateJaypieKey();
      expect(validateJaypieKey(key, { issuer: "jaypie" })).toBe(false);
    });
  });

  describe("All Format Combinations", () => {
    it("validates sk_issuer_body_checksum", () => {
      const key = generateJaypieKey({ issuer: "jaypie" });
      expect(validateJaypieKey(key, { issuer: "jaypie" })).toBe(true);
    });

    it("validates sk_issuer_bodychecksum (no separator before checksum)", () => {
      const key = generateJaypieKey({ issuer: "jaypie" });
      // Remove last separator (before checksum)
      const parts = key.split("_");
      const checksum = parts.pop()!;
      const withoutSep = parts.join("_") + checksum;
      expect(validateJaypieKey(withoutSep, { issuer: "jaypie" })).toBe(true);
    });

    it("validates sk_body_checksum", () => {
      const key = generateJaypieKey();
      expect(validateJaypieKey(key)).toBe(true);
    });

    it("validates issuer_bodychecksum (no sk)", () => {
      const key = generateJaypieKey({ prefix: "", issuer: "jaypie" });
      // Remove separator before checksum
      const idx = key.lastIndexOf("_");
      const withoutSep = key.slice(0, idx) + key.slice(idx + 1);
      expect(validateJaypieKey(withoutSep, { issuer: "jaypie" })).toBe(true);
    });

    it("validates body_checksum (no prefix)", () => {
      const key = generateJaypieKey({ prefix: "" });
      expect(validateJaypieKey(key)).toBe(true);
    });

    it("validates body only (no prefix, no checksum)", () => {
      const key = generateJaypieKey({ prefix: "", checksum: 0 });
      expect(validateJaypieKey(key)).toBe(true);
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
