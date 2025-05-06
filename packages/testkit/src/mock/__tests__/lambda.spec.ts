import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHandler, lambdaHandler, mockLambdaContext } from "../lambda";

describe("Lambda Mocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createHandler", () => {
    it("should return the provided handler function", () => {
      const originalHandler = async (event: any) => ({ statusCode: 200 });
      const wrappedHandler = createHandler(originalHandler);

      expect(wrappedHandler).toBe(originalHandler);
    });

    it("should track calls with handler function", () => {
      const originalHandler = async (event: any) => ({ statusCode: 200 });
      createHandler(originalHandler);

      expect(createHandler.mock.calls.length).toBe(1);
      expect(createHandler.mock.calls[0][0]).toBe(originalHandler);
    });
  });

  describe("lambdaHandler", () => {
    it("should return a function that calls the original handler", async () => {
      // Arrange
      const mockFunction = vi.fn().mockReturnValue({ success: true });
      const handler = lambdaHandler(mockFunction);
      
      // Act
      const result = await handler({ test: "event" }, { awsRequestId: "test-id" });
      
      // Assert
      expect(mockFunction).toHaveBeenCalledTimes(1);
      expect(mockFunction).toHaveBeenCalledWith({ test: "event" }, { awsRequestId: "test-id" });
      expect(result).toEqual({ success: true });
    });

    it("should handle errors from the handler", async () => {
      // Arrange
      const mockFunction = vi.fn().mockImplementation(() => {
        throw new Error("Test error");
      });
      const handler = lambdaHandler(mockFunction);
      
      // Act
      const result = await handler();
      
      // Assert
      expect(mockFunction).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ error: "UnhandledError" });
    });

    it("should rethrow errors when throw option is true", async () => {
      // Arrange
      const mockFunction = vi.fn().mockImplementation(() => {
        throw new Error("Test error");
      });
      const handler = lambdaHandler(mockFunction, { throw: true });
      
      // Act & Assert
      await expect(handler()).rejects.toThrow("Test error");
    });

    it("should handle project errors separately", async () => {
      // Arrange
      const projectError = new Error("Project error");
      projectError.isProjectError = true;
      projectError.json = () => ({ status: 400, message: "Bad request" });
      
      const mockFunction = vi.fn().mockImplementation(() => {
        throw projectError;
      });
      const handler = lambdaHandler(mockFunction);
      
      // Act
      const result = await handler();
      
      // Assert
      expect(mockFunction).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ status: 400, message: "Bad request" });
    });

    it("should swap parameters if handler is an object and options is a function", async () => {
      // Arrange
      const mockFunction = vi.fn().mockReturnValue({ success: true });
      const options = { name: "test-handler" };
      const handler = lambdaHandler(options, mockFunction);
      
      // Act
      const result = await handler();
      
      // Assert
      expect(mockFunction).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true });
    });

    it("should throw if not passed a function", () => {
      // Act & Assert
      expect(() => lambdaHandler(42 as any)).toThrow();
      expect(() => lambdaHandler("string" as any)).toThrow();
      expect(() => lambdaHandler({} as any)).toThrow();
      expect(() => lambdaHandler(null as any)).toThrow();
    });
  });

  describe("mockLambdaContext", () => {
    it("should create a context with expected properties", () => {
      const context = mockLambdaContext();

      expect(context.functionName).toBe("mock-function");
      expect(context.awsRequestId).toBe("mock-request-id");
      expect(context.logGroupName).toBe("mock-log-group");
      expect(context.logStreamName).toBe("mock-log-stream");
      expect(typeof context.getRemainingTimeInMillis).toBe("function");
      expect(typeof context.done).toBe("function");
      expect(typeof context.fail).toBe("function");
      expect(typeof context.succeed).toBe("function");
    });

    it("should have getRemainingTimeInMillis return 30000 by default", () => {
      const context = mockLambdaContext();
      expect(context.getRemainingTimeInMillis()).toBe(30000);
    });

    it("should track callback function calls", () => {
      const context = mockLambdaContext();
      const error = new Error("Test error");
      const result = { success: true };

      context.done(error, result);
      context.fail(error);
      context.succeed(result);

      expect(context.done.mock.calls.length).toBe(1);
      expect(context.done.mock.calls[0][0]).toBe(error);
      expect(context.done.mock.calls[0][1]).toBe(result);

      expect(context.fail.mock.calls.length).toBe(1);
      expect(context.fail.mock.calls[0][0]).toBe(error);

      expect(context.succeed.mock.calls.length).toBe(1);
      expect(context.succeed.mock.calls[0][0]).toBe(result);
    });
  });
});
