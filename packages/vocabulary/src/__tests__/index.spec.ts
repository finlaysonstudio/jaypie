import { describe, expect, it } from "vitest";

import {
  BASE_ENTITY_AUTO_FIELDS,
  BASE_ENTITY_FIELDS,
  BASE_ENTITY_REQUIRED_FIELDS,
  BASE_ENTITY_TIMESTAMP_FIELDS,
  coerce,
  coerceFromArray,
  coerceFromDate,
  coerceFromObject,
  coerceToArray,
  coerceToBoolean,
  coerceToDate,
  coerceToNumber,
  coerceToObject,
  coerceToString,
  commander,
  createBaseEntityInput,
  DateType,
  hasBaseEntityShape,
  isAutoField,
  isBaseEntity,
  isDateType,
  isTimestampField,
  isValidDate,
  lambda,
  pickBaseEntityFields,
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

    it("exports date coerce functions", () => {
      expect(coerceToDate).toBeDefined();
      expect(coerceFromDate).toBeDefined();
      expect(isValidDate).toBeDefined();
      expect(isDateType).toBeDefined();
      expect(DateType).toBe(Date);
    });

    it("exports BaseEntity types and utilities", () => {
      expect(BASE_ENTITY_FIELDS).toBeDefined();
      expect(BASE_ENTITY_REQUIRED_FIELDS).toBeDefined();
      expect(BASE_ENTITY_AUTO_FIELDS).toBeDefined();
      expect(BASE_ENTITY_TIMESTAMP_FIELDS).toBeDefined();
      expect(isBaseEntity).toBeDefined();
      expect(hasBaseEntityShape).toBeDefined();
      expect(createBaseEntityInput).toBeDefined();
      expect(pickBaseEntityFields).toBeDefined();
      expect(isTimestampField).toBeDefined();
      expect(isAutoField).toBeDefined();
    });

    it("exports commander namespace", () => {
      expect(commander).toBeDefined();
      expect(commander.createCommanderOptions).toBeDefined();
      expect(commander.parseCommanderOptions).toBeDefined();
      expect(typeof commander.createCommanderOptions).toBe("function");
      expect(typeof commander.parseCommanderOptions).toBe("function");
    });

    it("exports lambda namespace", () => {
      expect(lambda).toBeDefined();
      expect(lambda.lambdaServiceHandler).toBeDefined();
      expect(typeof lambda.lambdaServiceHandler).toBe("function");
    });
  });

  describe("Happy Paths", () => {
    it("VOCABULARY_VERSION is a string", () => {
      expect(typeof VOCABULARY_VERSION).toBe("string");
    });

    it("VOCABULARY_VERSION matches package version", () => {
      expect(VOCABULARY_VERSION).toBe("0.1.6");
    });
  });
});
