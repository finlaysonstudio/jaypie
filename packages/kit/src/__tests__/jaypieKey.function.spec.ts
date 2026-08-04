import { createHash, createHmac } from "node:crypto";
import { UnauthorizedError } from "@jaypie/errors";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  v5 as uuidv5,
  validate as validateUuid,
  version as uuidVersion,
} from "uuid";

import {
  generateJaypieKey,
  hashJaypieKey,
  jaypieApiKeyId,
  validateJaypieKey,
} from "../lib/functions/jaypieKey.function.js";

//
//
// Constants
//

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// Minted by the pre-five-character-checksum algorithm. These are the keys the
// change must never invalidate
const LEGACY_KEY = {
  RANDOM: "sk_5G64GGdYP667E79odzffiDaFBzjf2fX6_ALFL",
  SEEDED: "sk_jaypie_64yXBCCYcEKz9rEk039KwFMPy6wx2whJ_orLJ",
  SEEDED_NO_ISSUER: "sk_64yXBCCYcEKz9rEk039KwFMPy6wx2whJ_orLJ",
} as const;
const LEGACY_SEED = "legacy-seed";

//
//
// Mock environment
//

// Key shape follows PROJECT_ENV, which CI sets. Every test states the
// environment it expects rather than inheriting the runner's
const ORIGINAL_PROJECT_ENV = process.env.PROJECT_ENV;

beforeEach(() => {
  delete process.env.PROJECT_ENV;
});

afterEach(() => {
  if (ORIGINAL_PROJECT_ENV === undefined) {
    delete process.env.PROJECT_ENV;
  } else {
    process.env.PROJECT_ENV = ORIGINAL_PROJECT_ENV;
  }
});

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
      // sk_ + 32 body + _ + 5 checksum = 41 chars
      expect(key.length).toBe(41);
      expect(key.startsWith("sk_")).toBe(true);
    });

    it("generates a key with issuer", () => {
      const key = generateJaypieKey({ issuer: "jaypie" });
      // sk_jaypie_ + 32 body + _ + 5 checksum = 48 chars
      expect(key.length).toBe(48);
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
      // sk_ + 16 body + _ + 5 checksum = 25 chars
      expect(key.length).toBe(25);
    });

    it("ignores a requested checksum length", () => {
      const key = generateJaypieKey({ checksum: 6 });
      // Checksum length is not configurable — sk_ + 32 body + _ + 5 checksum
      expect(key.length).toBe(41);
    });

    it("spreads checksums across the five-character space", () => {
      const checksums = new Set<string>();
      for (let i = 0; i < 2000; i++) {
        checksums.add(generateJaypieKey().split("_").pop()!);
      }
      // Five base62 characters is 62^5 values. A checksum whose characters all
      // derive from one residue collapses to 62 no matter how many are minted,
      // which is a ~1.6% chance any given tamper validates
      expect(checksums.size).toBeGreaterThan(1000);
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
      // 32 body + _ + 5 checksum = 38 chars
      expect(key.length).toBe(38);
      // Should not start with a separator
      const base62Set = new Set(BASE62);
      expect(base62Set.has(key[0])).toBe(true);
    });

    it("generates with only issuer when prefix is empty", () => {
      const key = generateJaypieKey({ prefix: "", issuer: "jaypie" });
      // jaypie_ + 32 body + _ + 5 checksum = 45 chars
      expect(key.length).toBe(45);
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
      // Seeded so the assertion is deterministic. A checksum rejects a tamper
      // with high probability, not certainty, and a random key turns this into
      // a dice roll that fails a fraction of CI runs
      const key = generateJaypieKey({ seed: "tamper-seed" });
      // Replace a character in the body to break checksum
      const chars = key.split("");
      chars[5] = chars[5] === "A" ? "B" : "A";
      expect(validateJaypieKey(chars.join(""))).toBe(false);
    });

    it("rejects a single-character tamper at every body position", () => {
      const key = generateJaypieKey({ seed: "tamper-sweep-seed" });
      const [prefix, body, checksum] = key.split("_");

      for (let i = 0; i < body.length; i++) {
        const swapped = body[i] === "A" ? "B" : "A";
        const tampered = body.slice(0, i) + swapped + body.slice(i + 1);
        expect(validateJaypieKey([prefix, tampered, checksum].join("_"))).toBe(
          false,
        );
      }
    });

    it("rejects a transposed pair at every adjacent body position", () => {
      const key = generateJaypieKey({ seed: "transpose-seed" });
      const [prefix, body, checksum] = key.split("_");

      for (let i = 0; i < body.length - 1; i++) {
        if (body[i] === body[i + 1]) continue;
        const tampered =
          body.slice(0, i) + body[i + 1] + body[i] + body.slice(i + 2);
        expect(validateJaypieKey([prefix, tampered, checksum].join("_"))).toBe(
          false,
        );
      }
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

describe("Environment Segment", () => {
  const originalEnv = process.env.PROJECT_ENV;

  beforeEach(() => {
    delete process.env.PROJECT_ENV;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.PROJECT_ENV = originalEnv;
    } else {
      delete process.env.PROJECT_ENV;
    }
  });

  describe("Happy Paths", () => {
    it("places the environment between the issuer and the body", () => {
      process.env.PROJECT_ENV = "sandbox";
      const key = generateJaypieKey({ issuer: "jaypie" });
      expect(key.startsWith("sk_jaypie_sandbox_")).toBe(true);
      // sk_jaypie_sandbox_ + 32 body + _ + 5 checksum = 56 chars
      expect(key.length).toBe(56);
    });

    it("defaults the environment to PROJECT_ENV", () => {
      process.env.PROJECT_ENV = "local";
      expect(generateJaypieKey().startsWith("sk_local_")).toBe(true);
    });

    it("uses an explicit environment over PROJECT_ENV", () => {
      process.env.PROJECT_ENV = "local";
      const key = generateJaypieKey({ environment: "sandbox" });
      expect(key.startsWith("sk_sandbox_")).toBe(true);
    });

    it("validates a key carrying an environment", () => {
      process.env.PROJECT_ENV = "sandbox";
      const key = generateJaypieKey({ issuer: "jaypie" });
      expect(validateJaypieKey(key, { issuer: "jaypie" })).toBe(true);
    });

    it("validates a key carrying an environment without an issuer", () => {
      process.env.PROJECT_ENV = "sandbox";
      const key = generateJaypieKey();
      expect(validateJaypieKey(key)).toBe(true);
    });

    it("does not require an environment outside production", () => {
      process.env.PROJECT_ENV = "sandbox";
      const key = generateJaypieKey({ environment: false, issuer: "jaypie" });
      expect(validateJaypieKey(key, { issuer: "jaypie" })).toBe(true);
    });

    it("accepts a key from another non-production environment", () => {
      process.env.PROJECT_ENV = "sandbox";
      const key = generateJaypieKey({ environment: "local", issuer: "jaypie" });
      expect(validateJaypieKey(key, { issuer: "jaypie" })).toBe(true);
    });

    it("strips separators from the environment", () => {
      process.env.PROJECT_ENV = "pr-123";
      const key = generateJaypieKey({ issuer: "jaypie" });
      expect(key.startsWith("sk_jaypie_pr123_")).toBe(true);
      expect(validateJaypieKey(key, { issuer: "jaypie" })).toBe(true);
    });
  });

  describe("Features", () => {
    it("omits the environment in production", () => {
      process.env.PROJECT_ENV = "production";
      const key = generateJaypieKey({ issuer: "jaypie" });
      // sk_jaypie_ + 32 body + _ + 5 checksum = 48 chars
      expect(key.length).toBe(48);
      expect(validateJaypieKey(key, { issuer: "jaypie" })).toBe(true);
    });

    it("omits the environment when false", () => {
      process.env.PROJECT_ENV = "sandbox";
      expect(generateJaypieKey({ environment: false }).length).toBe(41);
    });

    it("omits the environment when null", () => {
      process.env.PROJECT_ENV = "sandbox";
      expect(generateJaypieKey({ environment: null }).length).toBe(41);
    });

    it("omits the environment when PROJECT_ENV is unset", () => {
      expect(generateJaypieKey().length).toBe(41);
    });
  });

  describe("Error Conditions", () => {
    it("throws when a non-production key is validated in production", () => {
      const key = generateJaypieKey({
        environment: "sandbox",
        issuer: "jaypie",
      });
      process.env.PROJECT_ENV = "production";
      expect(() => validateJaypieKey(key, { issuer: "jaypie" })).toThrowError(
        "The provided key matches a non-production environment",
      );
    });

    it("throws UnauthorizedError, not a generic error", () => {
      const key = generateJaypieKey({
        environment: "sandbox",
        issuer: "jaypie",
      });
      process.env.PROJECT_ENV = "production";
      let caught;
      try {
        validateJaypieKey(key, { issuer: "jaypie" });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(UnauthorizedError);
    });

    it("does not throw for a malformed key in production", () => {
      process.env.PROJECT_ENV = "production";
      expect(
        validateJaypieKey("sk_jaypie_sandbox_nope", { issuer: "jaypie" }),
      ).toBe(false);
    });

    it("does not throw when the environment is validated without an issuer", () => {
      const key = generateJaypieKey({ environment: "sandbox" });
      process.env.PROJECT_ENV = "production";
      expect(validateJaypieKey(key)).toBe(false);
    });
  });
});

describe("Legacy Compatibility", () => {
  describe("Happy Paths", () => {
    it("validates a legacy random key", () => {
      expect(validateJaypieKey(LEGACY_KEY.RANDOM)).toBe(true);
    });

    it("validates a legacy key with an issuer", () => {
      expect(validateJaypieKey(LEGACY_KEY.SEEDED, { issuer: "jaypie" })).toBe(
        true,
      );
    });

    it("validates a legacy seeded key without an issuer", () => {
      expect(validateJaypieKey(LEGACY_KEY.SEEDED_NO_ISSUER)).toBe(true);
    });

    it("validates a legacy key in production", () => {
      const originalEnv = process.env.PROJECT_ENV;
      process.env.PROJECT_ENV = "production";
      try {
        expect(validateJaypieKey(LEGACY_KEY.SEEDED, { issuer: "jaypie" })).toBe(
          true,
        );
      } finally {
        if (originalEnv === undefined) {
          delete process.env.PROJECT_ENV;
        } else {
          process.env.PROJECT_ENV = originalEnv;
        }
      }
    });
  });

  describe("Features", () => {
    it("reproduces a legacy seeded key with version 1", () => {
      const key = generateJaypieKey({
        issuer: "jaypie",
        seed: LEGACY_SEED,
        version: 1,
      });
      expect(key).toBe(LEGACY_KEY.SEEDED);
    });

    it("reproduces a legacy seeded key without an issuer with version 1", () => {
      const key = generateJaypieKey({ seed: LEGACY_SEED, version: 1 });
      expect(key).toBe(LEGACY_KEY.SEEDED_NO_ISSUER);
    });

    it("emits a four-character checksum with version 1", () => {
      expect(generateJaypieKey({ version: 1 }).length).toBe(40);
    });

    it("omits the environment with version 1", () => {
      const originalEnv = process.env.PROJECT_ENV;
      process.env.PROJECT_ENV = "sandbox";
      try {
        expect(generateJaypieKey({ version: 1 }).length).toBe(40);
      } finally {
        if (originalEnv === undefined) {
          delete process.env.PROJECT_ENV;
        } else {
          process.env.PROJECT_ENV = originalEnv;
        }
      }
    });

    it("derives a different key from the same seed at version 2", () => {
      const legacy = generateJaypieKey({ seed: LEGACY_SEED, version: 1 });
      const current = generateJaypieKey({ seed: LEGACY_SEED });
      expect(current).not.toBe(legacy);
      expect(validateJaypieKey(current)).toBe(true);
    });
  });
});

describe("Checksum", () => {
  // Swap the first adjacent pair of distinct characters
  function transpose(body: string): string {
    for (let i = 0; i < body.length - 1; i++) {
      if (body[i] !== body[i + 1]) {
        return body.slice(0, i) + body[i + 1] + body[i] + body.slice(i + 2);
      }
    }
    throw new Error("body has no distinct adjacent pair");
  }

  describe("Features", () => {
    it("emits five characters", () => {
      const key = generateJaypieKey({ prefix: "" });
      expect(key.slice(-6)).toMatch(/^_[0-9A-Za-z]{5}$/);
    });

    it("catches a transposed pair in the body", () => {
      const [body, checksum] = generateJaypieKey({ prefix: "" }).split("_");
      const swapped = transpose(body);
      expect(swapped).not.toBe(body);
      expect(validateJaypieKey(`${body}_${checksum}`)).toBe(true);
      expect(validateJaypieKey(`${swapped}_${checksum}`)).toBe(false);
    });

    it("documents that the legacy checksum missed a transposed pair", () => {
      const [body, checksum] = generateJaypieKey({
        prefix: "",
        version: 1,
      }).split("_");
      const swapped = transpose(body);
      expect(checksum.length).toBe(4);
      expect(validateJaypieKey(`${swapped}_${checksum}`)).toBe(true);
    });
  });
});

describe("Seeded Derivation", () => {
  describe("Features", () => {
    it("derives a body longer than one digest", () => {
      const key = generateJaypieKey({
        length: 64,
        prefix: "",
        seed: "long-body",
      });
      const body = key.slice(0, 64);
      expect(body.length).toBe(64);
      expect(body.includes("undefined")).toBe(false);
      const base62Set = new Set(BASE62);
      for (const char of body) {
        expect(base62Set.has(char)).toBe(true);
      }
    });

    it("stays deterministic at the longer length", () => {
      const options = { length: 64, prefix: "", seed: "long-body" };
      expect(generateJaypieKey(options)).toBe(generateJaypieKey(options));
    });

    it("validates the longer key", () => {
      const key = generateJaypieKey({
        length: 64,
        prefix: "",
        seed: "long-body",
      });
      expect(validateJaypieKey(key, { length: 64, prefix: "" })).toBe(true);
    });
  });
});

describe("Body Distribution", () => {
  describe("Features", () => {
    it("does not favor the characters modulo bias would favor", () => {
      // 256 % 62 leaves the first eight pool characters doubly reachable under
      // a plain modulo. Rejection sampling removes the skew
      const counts = new Map<string, number>();
      for (let i = 0; i < 200; i++) {
        for (const char of generateJaypieKey({ checksum: false, prefix: "" })) {
          counts.set(char, (counts.get(char) ?? 0) + 1);
        }
      }
      const biased = BASE62.slice(0, 8);
      let biasedTotal = 0;
      let total = 0;
      for (const [char, count] of counts) {
        total += count;
        if (biased.includes(char)) biasedTotal += count;
      }
      const share = biasedTotal / total;
      const expected = biased.length / BASE62.length;
      // A modulo-biased body puts roughly 12.5% of characters in this set
      expect(share).toBeGreaterThan(expected * 0.75);
      expect(share).toBeLessThan(expected * 1.25);
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

describe("jaypieApiKeyId", () => {
  const NAMESPACE = "b85e1a7a-5c7e-4e7b-9b8e-7c3a9d2f4e5b";
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
      expect(typeof jaypieApiKeyId).toBe("function");
    });
  });

  describe("Happy Paths", () => {
    it("returns a valid v5 UUID", () => {
      const key = generateJaypieKey();
      const id = jaypieApiKeyId(key, { namespace: NAMESPACE });
      expect(validateUuid(id)).toBe(true);
      expect(uuidVersion(id)).toBe(5);
    });

    it("is deterministic for the same key and namespace", () => {
      const key = generateJaypieKey();
      const id1 = jaypieApiKeyId(key, { namespace: NAMESPACE });
      const id2 = jaypieApiKeyId(key, { namespace: NAMESPACE });
      expect(id1).toBe(id2);
    });

    it("produces different ids for different keys", () => {
      const key1 = generateJaypieKey();
      const key2 = generateJaypieKey();
      const id1 = jaypieApiKeyId(key1, { namespace: NAMESPACE });
      const id2 = jaypieApiKeyId(key2, { namespace: NAMESPACE });
      expect(id1).not.toBe(id2);
    });

    it("produces different ids for different namespaces", () => {
      const key = generateJaypieKey();
      const other = "f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b";
      const id1 = jaypieApiKeyId(key, { namespace: NAMESPACE });
      const id2 = jaypieApiKeyId(key, { namespace: other });
      expect(id1).not.toBe(id2);
    });

    it("derives id from uuidv5 of the hashed key", () => {
      const key = "test-key";
      const salt = "test-salt";
      const expected = uuidv5(hashJaypieKey(key, { salt }), NAMESPACE);
      expect(jaypieApiKeyId(key, { namespace: NAMESPACE, salt })).toBe(
        expected,
      );
    });
  });

  describe("Salt Behavior", () => {
    it("uses explicit salt when provided", () => {
      const key = "test-key";
      const unsalted = jaypieApiKeyId(key, { namespace: NAMESPACE });
      const salted = jaypieApiKeyId(key, {
        namespace: NAMESPACE,
        salt: "my-salt",
      });
      expect(unsalted).not.toBe(salted);
    });

    it("uses PROJECT_SALT when no explicit salt", () => {
      process.env.PROJECT_SALT = "env-salt";
      const key = "test-key";
      const id = jaypieApiKeyId(key, { namespace: NAMESPACE });
      const expected = uuidv5(
        hashJaypieKey(key, { salt: "env-salt" }),
        NAMESPACE,
      );
      expect(id).toBe(expected);
    });

    it("explicit salt overrides PROJECT_SALT", () => {
      process.env.PROJECT_SALT = "env-salt";
      const key = "test-key";
      const id = jaypieApiKeyId(key, {
        namespace: NAMESPACE,
        salt: "explicit-salt",
      });
      const expected = uuidv5(
        hashJaypieKey(key, { salt: "explicit-salt" }),
        NAMESPACE,
      );
      expect(id).toBe(expected);
    });
  });
});
