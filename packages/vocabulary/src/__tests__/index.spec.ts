import { describe, expect, it } from "vitest";

import {
  coerce,
  coerceFromArray,
  coerceFromObject,
  coerceToArray,
  coerceToBoolean,
  coerceToNumber,
  coerceToObject,
  coerceToString,
  serviceHandler,
  VOCABULARY_VERSION,
} from "..";

describe("vocabulary/index", () => {
  describe("Base Cases", () => {
    it("exports VOCABULARY_VERSION", () => {
      expect(VOCABULARY_VERSION).toBeDefined();
    });

    it("exports serviceHandler", () => {
      expect(serviceHandler).toBeDefined();
      expect(typeof serviceHandler).toBe("function");
    });

    it("exports scalar coerce functions", () => {
      expect(coerce).toBeDefined();
      expect(coerceToBoolean).toBeDefined();
      expect(coerceToNumber).toBeDefined();
      expect(coerceToString).toBeDefined();
    });

    it("exports composite coerce functions", () => {
      expect(coerceToArray).toBeDefined();
      expect(coerceFromArray).toBeDefined();
      expect(coerceToObject).toBeDefined();
      expect(coerceFromObject).toBeDefined();
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
