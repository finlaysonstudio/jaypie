import { describe, it, expect, vi } from "vitest";
import {
  MockValidationError,
  MockNotFoundError,
  validate,
  getConfig,
  logger,
} from "../../src/mock/core";

describe("Core Mocks", () => {
  describe("Error Classes", () => {
    it("should create MockValidationError with correct name", () => {
      const error = new MockValidationError("Invalid data");
      expect(error.name).toBe("ValidationError");
      expect(error.message).toBe("Invalid data");
      expect(error instanceof Error).toBe(true);
    });

    it("should create MockNotFoundError with correct name", () => {
      const error = new MockNotFoundError("Resource not found");
      expect(error.name).toBe("NotFoundError");
      expect(error.message).toBe("Resource not found");
      expect(error instanceof Error).toBe(true);
    });
  });

  describe("validate", () => {
    it("should return true by default", () => {
      const result = validate({ name: "test" }, { type: "object" });
      expect(result).toBe(true);
    });

    it("should track calls", () => {
      const data = { name: "test" };
      const schema = { type: "object" };

      validate(data, schema);

      expect(validate.mock.calls.length).toBe(1);
      expect(validate.mock.calls[0][0]).toBe(data);
      expect(validate.mock.calls[0][1]).toBe(schema);
    });
  });

  describe("getConfig", () => {
    it("should return default test environment", () => {
      const config = getConfig();
      expect(config).toEqual({ environment: "test" });
    });

    it("should track calls", () => {
      getConfig();
      expect(getConfig.mock.calls.length).toBe(1);
    });
  });

  describe("logger", () => {
    it("should have mock methods for logging", () => {
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
    });

    it("should track debug calls", () => {
      logger.debug("Debug message", { extra: "data" });

      expect(logger.debug.mock.calls.length).toBe(1);
      expect(logger.debug.mock.calls[0][0]).toBe("Debug message");
      expect(logger.debug.mock.calls[0][1]).toEqual({ extra: "data" });
    });

    it("should track info calls", () => {
      logger.info("Info message");

      expect(logger.info.mock.calls.length).toBe(1);
      expect(logger.info.mock.calls[0][0]).toBe("Info message");
    });
  });
});
