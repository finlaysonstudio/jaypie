import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HTTP, jaypieHandler, log } from "@jaypie/core";
import { restoreLog, spyLog } from "@jaypie/testkit";

// Subject
import lambdaHandler from "../lambdaHandler.js";

//
//
// Mock constants
//

//
//
// Mock modules
//

vi.mock("@jaypie/core", async () => {
  const actual = await vi.importActual("@jaypie/core");
  const module = {
    ...actual,
    jaypieHandler: vi.fn((handler, options) => {
      return actual.jaypieHandler(handler, options);
    }),
  };
  return module;
});

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
  spyLog(log);
});
afterEach(() => {
  process.env = DEFAULT_ENV;
  vi.clearAllMocks();
  restoreLog(log);
});

//
//
// Run tests
//

describe("Lambda Handler Module", () => {
  describe("Base Cases", () => {
    it("Works", () => {
      expect(lambdaHandler).toBeDefined();
      expect(lambdaHandler).toBeFunction();
    });
  });
  describe("Error Conditions", () => {
    it("Throws if not passed a function", () => {
      // Arrange
      // Act
      // Assert
      expect(() => lambdaHandler()).toThrow();
      expect(() => lambdaHandler(42)).toThrow();
      expect(() => lambdaHandler("string")).toThrow();
      expect(() => lambdaHandler({})).toThrow();
      expect(() => lambdaHandler([])).toThrow();
      expect(() => lambdaHandler(null)).toThrow();
      expect(() => lambdaHandler(undefined)).toThrow();
    });
    it("Returns a jaypie error if function throws", async () => {
      // Arrange
      const mockFunction = vi.fn();
      mockFunction.mockRejectedValue(new Error("This error should be caught"));
      const handler = lambdaHandler(mockFunction);
      // Act
      const result = await handler();
      // Assert
      expect(result).toBeJaypieError();
    });
    it("Returns an error if a lifecycle function throws", async () => {
      // Arrange
      const mockFunction = vi.fn();
      const handler = lambdaHandler(mockFunction, {
        validate: [
          async () => {
            throw new Error("Sorpresa!");
          },
        ],
      });
      // Act
      const result = await handler();
      // Assert
      expect(result).toBeJaypieError();
      expect(result.errors[0].status).toBe(HTTP.CODE.INTERNAL_ERROR);
    });
    it("Returns unavailable if PROJECT_UNAVAILABLE is set", async () => {
      // Arrange
      const mockFunction = vi.fn();
      const handler = lambdaHandler(mockFunction, {
        unavailable: true,
      });
      // Act
      const result = await handler();
      // Assert
      expect(result).toBeJaypieError();
      expect(result.errors[0].status).toBe(HTTP.CODE.UNAVAILABLE);
    });
  });
  describe("Observability", () => {
    it("Does not log above trace", async () => {
      // Arrange
      const mockFunction = vi.fn();
      const handler = lambdaHandler(mockFunction);
      // Act
      await handler();
      // Assert
      expect(log.debug).not.toHaveBeenCalled();
      expect(log.info).not.toHaveBeenCalled();
      expect(log.warn).not.toHaveBeenCalled();
      expect(log.error).not.toHaveBeenCalled();
      expect(log.fatal).not.toHaveBeenCalled();
    });
    it("Includes the invoke in the log", async () => {
      // Arrange
      const mockFunction = vi.fn();
      const handler = lambdaHandler(mockFunction);
      // Act
      await handler({}, { awsRequestId: "MOCK_AWS_REQUEST_ID" });
      // Assert
      expect(log.tag).toHaveBeenCalled();
      expect(log.tag).toHaveBeenCalledWith({
        invoke: "MOCK_AWS_REQUEST_ID",
      });
    });
  });
  describe("Happy Paths", () => {
    it("Calls a function I pass it", async () => {
      // Arrange
      const mockFunction = vi.fn();
      const handler = lambdaHandler(mockFunction);
      const args = [1, 2, 3];
      // Act
      await handler(...args);
      // Assert
      expect(mockFunction).toHaveBeenCalledTimes(1);
      expect(mockFunction).toHaveBeenCalledWith(...args);
    });
    it("Awaits a function I pass it", async () => {
      // Arrange
      const mockFunction = vi.fn(async () => {});
      const handler = lambdaHandler(mockFunction);
      // Act
      await handler();
      // Assert
      expect(mockFunction).toHaveBeenCalledTimes(1);
    });
    it("Returns what the function returns", async () => {
      // Arrange
      const mockFunction = vi.fn(() => 42);
      const handler = lambdaHandler(mockFunction);
      // Act
      const result = await handler();
      // Assert
      expect(result).toBe(42);
    });
    it("Returns what async functions resolve", async () => {
      // Arrange
      const mockFunction = vi.fn(async () => 42);
      const handler = lambdaHandler(mockFunction);
      // Act
      const result = await handler();
      // Assert
      expect(result).toBe(42);
    });
    describe("Features", () => {
      it("Provides a logger with handler and layer", async () => {
        // Arrange
        const mockFunction = vi.fn(() => {
          log.warn("Alert level zero");
        });
        const handler = lambdaHandler(mockFunction);
        // Assure
        expect(log.warn).not.toHaveBeenCalled();
        // Act
        await handler();
        // Assert
        expect(log.warn).toHaveBeenCalledTimes(1);
        // TODO: assert log tags include handler and layer with valid values
      });
      it("Does not allocate recourses until function is called", async () => {
        // Arrange
        const mockFunction = vi.fn();
        // Act
        lambdaHandler(mockFunction);
        lambdaHandler(mockFunction);
        // Assert
        expect(jaypieHandler).not.toHaveBeenCalled();
      });
    });
  });
});
