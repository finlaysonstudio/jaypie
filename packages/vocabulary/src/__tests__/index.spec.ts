import { describe, expect, it } from "vitest";

import { VOCABULARY_VERSION } from "..";

describe("vocabulary/index", () => {
  describe("Base Cases", () => {
    it("exports VOCABULARY_VERSION", () => {
      expect(VOCABULARY_VERSION).toBeDefined();
    });
  });

  describe("Happy Paths", () => {
    it("VOCABULARY_VERSION is a string", () => {
      expect(typeof VOCABULARY_VERSION).toBe("string");
    });

    it("VOCABULARY_VERSION matches package version", () => {
      expect(VOCABULARY_VERSION).toBe("0.0.1");
    });
  });
});
