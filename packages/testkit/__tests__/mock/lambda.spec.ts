import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHandler, mockLambdaContext } from "../../src/mock/lambda";

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
