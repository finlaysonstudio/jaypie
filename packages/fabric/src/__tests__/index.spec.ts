import { describe, expect, it } from "vitest";

import {
  BASE_MODEL_AUTO_FIELDS,
  BASE_MODEL_FIELDS,
  BASE_MODEL_REQUIRED_FIELDS,
  BASE_MODEL_TIMESTAMP_FIELDS,
  convert,
  convertFromArray,
  convertFromDate,
  convertFromObject,
  convertToArray,
  convertToBoolean,
  convertToDate,
  convertToNumber,
  convertToObject,
  convertToString,
  createBaseModelInput,
  createService,
  DateType,
  FABRIC_VERSION,
  hasBaseModelShape,
  isAutoField,
  isBaseModel,
  isDateType,
  isStatus,
  isTimestampField,
  isValidDate,
  llm,
  pickBaseModelFields,
  STATUS_VALUES,
  StatusType,
} from "..";

describe("fabric/index", () => {
  describe("Base Cases", () => {
    it("exports FABRIC_VERSION", () => {
      expect(FABRIC_VERSION).toBeDefined();
    });

    it("exports createService", () => {
      expect(createService).toBeDefined();
      expect(typeof createService).toBe("function");
    });

    it("exports scalar convert functions", () => {
      expect(convert).toBeDefined();
      expect(convertToBoolean).toBeDefined();
      expect(convertToNumber).toBeDefined();
      expect(convertToString).toBeDefined();
    });

    it("exports composite convert functions", () => {
      expect(convertToArray).toBeDefined();
      expect(convertFromArray).toBeDefined();
      expect(convertToObject).toBeDefined();
      expect(convertFromObject).toBeDefined();
    });

    it("exports date convert functions", () => {
      expect(convertToDate).toBeDefined();
      expect(convertFromDate).toBeDefined();
      expect(isValidDate).toBeDefined();
      expect(isDateType).toBeDefined();
      expect(DateType).toBe(Date);
    });

    it("exports BaseModel types and utilities", () => {
      expect(BASE_MODEL_FIELDS).toBeDefined();
      expect(BASE_MODEL_REQUIRED_FIELDS).toBeDefined();
      expect(BASE_MODEL_AUTO_FIELDS).toBeDefined();
      expect(BASE_MODEL_TIMESTAMP_FIELDS).toBeDefined();
      expect(isBaseModel).toBeDefined();
      expect(hasBaseModelShape).toBeDefined();
      expect(createBaseModelInput).toBeDefined();
      expect(pickBaseModelFields).toBeDefined();
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
    //   import { registerServiceCommand } from "@jaypie/fabric/commander";
    //   import { createLambdaService } from "@jaypie/fabric/lambda";
    //   import { registerMcpTool } from "@jaypie/fabric/mcp";
  });

  describe("Happy Paths", () => {
    it("FABRIC_VERSION is a string", () => {
      expect(typeof FABRIC_VERSION).toBe("string");
    });

    it("FABRIC_VERSION matches package version", () => {
      expect(FABRIC_VERSION).toBe("0.0.1");
    });
  });
});
