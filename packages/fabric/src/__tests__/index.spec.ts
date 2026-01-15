import { describe, expect, it } from "vitest";

import {
  convertFromArray,
  convertFromDate,
  convertFromObject,
  createFabricModelInput,
  DateType,
  fabric,
  fabricArray,
  fabricBoolean,
  fabricDate,
  fabricNumber,
  fabricObject,
  fabricService,
  fabricString,
  FABRIC_MODEL_AUTO_FIELDS,
  FABRIC_MODEL_FIELDS,
  FABRIC_MODEL_REQUIRED_FIELDS,
  FABRIC_MODEL_TIMESTAMP_FIELDS,
  FABRIC_VERSION,
  hasFabricModelShape,
  isAutoField,
  isDateType,
  isFabricModel,
  isStatus,
  isTimestampField,
  isValidDate,
  pickFabricModelFields,
  STATUS_VALUES,
  StatusType,
} from "..";

describe("fabric/index", () => {
  describe("Base Cases", () => {
    it("exports FABRIC_VERSION", () => {
      expect(FABRIC_VERSION).toBeDefined();
    });

    it("exports fabricService", () => {
      expect(fabricService).toBeDefined();
      expect(typeof fabricService).toBe("function");
    });

    it("exports scalar fabric functions", () => {
      expect(fabric).toBeDefined();
      expect(fabricBoolean).toBeDefined();
      expect(fabricNumber).toBeDefined();
      expect(fabricString).toBeDefined();
    });

    it("exports composite fabric functions", () => {
      expect(fabricArray).toBeDefined();
      expect(convertFromArray).toBeDefined();
      expect(fabricObject).toBeDefined();
      expect(convertFromObject).toBeDefined();
    });

    it("exports date fabric functions", () => {
      expect(fabricDate).toBeDefined();
      expect(convertFromDate).toBeDefined();
      expect(isValidDate).toBeDefined();
      expect(isDateType).toBeDefined();
      expect(DateType).toBe(Date);
    });

    it("exports FabricModel types and utilities", () => {
      expect(FABRIC_MODEL_FIELDS).toBeDefined();
      expect(FABRIC_MODEL_REQUIRED_FIELDS).toBeDefined();
      expect(FABRIC_MODEL_AUTO_FIELDS).toBeDefined();
      expect(FABRIC_MODEL_TIMESTAMP_FIELDS).toBeDefined();
      expect(isFabricModel).toBeDefined();
      expect(hasFabricModelShape).toBeDefined();
      expect(createFabricModelInput).toBeDefined();
      expect(pickFabricModelFields).toBeDefined();
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

    // Note: All adapters must be imported from their sub-paths:
    //   import { fabricCommand } from "@jaypie/fabric/commander";
    //   import { fabricLambda } from "@jaypie/fabric/lambda";
    //   import { fabricTool } from "@jaypie/fabric/llm";
    //   import { fabricMcp } from "@jaypie/fabric/mcp";
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
