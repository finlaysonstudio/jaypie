import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfigurationError } from "@jaypie/errors";
import { HTTP, jaypieHandler } from "@jaypie/kit";
import { log } from "@jaypie/logger";
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

vi.mock("@jaypie/kit", async () => {
  const actual = await vi.importActual("@jaypie/kit");
  const module = {
    ...actual,
    jaypieHandler: vi.fn(
      (
        handler: (...args: unknown[]) => unknown,
        options: Record<string, unknown>,
      ) => {
        return (
          actual as { jaypieHandler: typeof jaypieHandler }
        ).jaypieHandler(handler, options);
      },
    ),
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
      expect(() => lambdaHandler(undefined as unknown as () => void)).toThrow();
      expect(() => lambdaHandler(42 as unknown as () => void)).toThrow();
      expect(() => lambdaHandler("string" as unknown as () => void)).toThrow();
      expect(() => lambdaHandler({} as unknown as () => void)).toThrow();
      expect(() => lambdaHandler([] as unknown as () => void)).toThrow();
      expect(() => lambdaHandler(null as unknown as () => void)).toThrow();
    });
    it("Returns a jaypie error if function throws", async () => {
      // Arrange
      const mockFunction = vi.fn();
      mockFunction.mockRejectedValue(new Error("This error should be caught"));
      const handler = lambdaHandler(mockFunction);
      // Act
      const result = await handler({}, {});
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
      const result = (await handler({}, {})) as {
        errors: { status: number }[];
      };
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
      const result = (await handler({}, {})) as {
        errors: { status: number }[];
      };
      // Assert
      expect(result).toBeJaypieError();
      expect(result.errors[0].status).toBe(HTTP.CODE.UNAVAILABLE);
    });
  });
  describe("Parameter Order", () => {
    it("Accepts handler as first parameter and options as second parameter", async () => {
      const mockFunction = vi.fn();
      const options = { name: "test" };
      const handler = lambdaHandler(mockFunction, options);
      await handler({}, {});
      expect(mockFunction).toHaveBeenCalledTimes(1);
    });

    it("Swaps parameters if handler is an object and options is a function", async () => {
      const mockFunction = vi.fn();
      const options = { name: "test" };
      const handler = lambdaHandler(options, mockFunction);
      await handler({}, {});
      expect(mockFunction).toHaveBeenCalledTimes(1);
      expect(jaypieHandler).toHaveBeenCalledWith(
        mockFunction,
        expect.objectContaining(options),
      );
    });

    it("Throws if not passed a function after parameter swap", () => {
      const options = { name: "test" };
      expect(() => lambdaHandler(options, {} as unknown as () => void)).toThrow(
        ConfigurationError,
      );
    });
  });
  describe("Observability", () => {
    it("Does not log above trace", async () => {
      // Arrange
      const mockFunction = vi.fn();
      const handler = lambdaHandler(mockFunction);
      // Act
      await handler({}, {});
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
      const args: [number, number, number] = [1, 2, 3];
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
      await handler({}, {});
      // Assert
      expect(mockFunction).toHaveBeenCalledTimes(1);
    });
    it("Returns what the function returns", async () => {
      // Arrange
      const mockFunction = vi.fn(() => 42);
      const handler = lambdaHandler(mockFunction);
      // Act
      const result = await handler({}, {});
      // Assert
      expect(result).toBe(42);
    });
    it("Returns what async functions resolve", async () => {
      // Arrange
      const mockFunction = vi.fn(async () => 42);
      const handler = lambdaHandler(mockFunction);
      // Act
      const result = await handler({}, {});
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
        await handler({}, {});
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
      it("Throws errors when throw option is true", async () => {
        // Arrange
        const mockFunction = vi.fn(() => {
          throw new Error();
        });
        const handler = lambdaHandler(mockFunction, { throw: true });
        // Act & Assert
        await expect(handler({}, {})).rejects.toThrow();
        expect(log.debug).toHaveBeenCalled();
      });
    });
  });
});
