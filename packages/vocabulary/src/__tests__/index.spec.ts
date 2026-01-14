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
  createBaseEntityInput,
  DateType,
  hasBaseEntityShape,
  isAutoField,
  isBaseEntity,
  isDateType,
  isStatus,
  isTimestampField,
  isValidDate,
  llm,
  pickBaseEntityFields,
  serviceHandler,
  STATUS_VALUES,
  StatusType,
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

    it("exports status type and utilities", () => {
      expect(STATUS_VALUES).toBeDefined();
      expect(StatusType).toBeDefined();
      expect(isStatus).toBeDefined();
      expect(Array.isArray(STATUS_VALUES)).toBe(true);
      expect(Array.isArray(StatusType)).toBe(true);
      expect(typeof isStatus).toBe("function");
    });

    it("exports llm namespace (only adapter without optional deps)", () => {
      expect(llm).toBeDefined();
      expect(llm.createLlmTool).toBeDefined();
      expect(llm.inputToJsonSchema).toBeDefined();
      expect(typeof llm.createLlmTool).toBe("function");
      expect(typeof llm.inputToJsonSchema).toBe("function");
    });

    // Note: commander, lambda, and mcp adapters have optional dependencies
    // and must be imported directly from their sub-paths:
    //   import { registerServiceCommand } from "@jaypie/vocabulary/commander";
    //   import { lambdaServiceHandler } from "@jaypie/vocabulary/lambda";
    //   import { registerMcpTool } from "@jaypie/vocabulary/mcp";
  });

  describe("Happy Paths", () => {
    it("VOCABULARY_VERSION is a string", () => {
      expect(typeof VOCABULARY_VERSION).toBe("string");
    });

    it("VOCABULARY_VERSION matches package version", () => {
      expect(VOCABULARY_VERSION).toBe("0.2.0");
    });
  });
});
