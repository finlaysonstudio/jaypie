import { describe, it, expect, vi, beforeEach } from "vitest";
import { lambdaHandler } from "../lambda.js";
import { HTTP, jaypieHandler } from "../core.js";

describe("lambdaHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(typeof lambdaHandler).toBe("function");
    });

    it("Works", async () => {
      const handler = vi.fn().mockReturnValue("result");
      const wrapped = lambdaHandler(handler);
      const result = await wrapped({}, {});
      expect(result).toBe("result");
    });
  });

  describe("Error Conditions", () => {
    it("handles thrown errors from handler", async () => {
      const handler = vi.fn().mockImplementation(() => {
        throw new Error("Handler error");
      });
      const wrapped = lambdaHandler(handler);

      try {
        await wrapped({}, {});
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toBe("Handler error");
      }
    });
  });

  describe("Observability", () => {
    it("forwards calls to jaypieHandler", async () => {
      const handler = vi.fn().mockReturnValue("result");
      const options = { name: "testHandler" };
      const wrapped = lambdaHandler(handler, options);
      await wrapped({}, {});
      expect(jaypieHandler).toHaveBeenCalledWith(handler, options);
    });
  });

  describe("Happy Paths", () => {
    it("accepts function as the first parameter", async () => {
      const handler = vi.fn().mockReturnValue("result");
      const wrapped = lambdaHandler(handler);
      const result = await wrapped({}, {});
      expect(result).toBe("result");
      expect(handler).toHaveBeenCalledWith({}, {});
    });

    it("accepts function and options", async () => {
      const handler = vi.fn().mockReturnValue("result");
      const options = { name: "testHandler" };
      const wrapped = lambdaHandler(handler, options);
      const result = await wrapped({}, {});
      expect(result).toBe("result");
      expect(jaypieHandler).toHaveBeenCalledWith(handler, options);
    });
  });

  describe("Features", () => {
    it("accepts options as first parameter and function as second parameter", async () => {
      const handler = vi.fn().mockReturnValue("result");
      const options = { name: "testHandler" } as any;
      const wrapped = lambdaHandler(options, handler as any);
      const result = await wrapped({}, {});
      expect(result).toBe("result");
      expect(jaypieHandler).toHaveBeenCalledWith(handler, options);
    });

    it("allows passing additional arguments to the wrapped function", async () => {
      const handler = vi.fn().mockReturnValue("result");
      const wrapped = lambdaHandler(handler);
      const result = await wrapped({}, {}, "additional", 123);
      expect(handler).toHaveBeenCalledWith({}, {}, "additional", 123);
      expect(result).toBe("result");
    });
  });
});

describe("Jaypie Lambda", () => {
  it("Mocks expected function", () => {
    expect(vi.isMockFunction(lambdaHandler)).toBeTrue();
  });
  describe("Lambda Handler", () => {
    describe("Base Cases", () => {
      it("Works", async () => {
        expect(lambdaHandler).toBeDefined();
        expect(lambdaHandler).toBeFunction();
      });
      it("Will call a function I pass it", async () => {
        const mockFunction = vi.fn();
        const handler = lambdaHandler(mockFunction);
        const event = {};
        const context = {};
        const callback = vi.fn();
        await handler(event, context, callback);
        expect(mockFunction).toHaveBeenCalledTimes(1);
      });
      it("Passes event, context, and anything else to the handler", async () => {
        // Set up four mock variables
        const event = {};
        const context = {};
        const three = "THREE";
        const four = "FOUR";
        // Set up our mock function
        const mockFunction = vi.fn();
        const handler = lambdaHandler(mockFunction);
        // Call the handler with our mock variables
        await handler(event, context, three, four);
        // Expect the mock function to have been called with our mock variables
        expect(mockFunction).toHaveBeenCalledTimes(1);
        expect(mockFunction).toHaveBeenCalledWith(event, context, three, four);
      });
      it("As a mock, returns what was sent", async () => {
        // Arrange
        const mockFunction = vi.fn(() => 42);
        const handler = lambdaHandler(mockFunction);
        const event = {};
        const context = {};
        // Act
        const result = await handler(event, context);
        // Assert
        expect(result).toBe(42);
      });
    });
    describe("Error Conditions", () => {
      it("Will throw out errors", async () => {
        const mockFunction = vi.fn(() => {
          throw new Error("Sorpresa!");
        });
        const handler = lambdaHandler(mockFunction);
        const event = {};
        const context = {};
        try {
          await handler(event, context);
        } catch (error) {
          expect((error as any).isProjectError).not.toBeTrue();
        }
        expect.assertions(1);
      });
      it("Will throw async errors", async () => {
        const mockFunction = vi
          .fn()
          .mockRejectedValueOnce(new Error("Sorpresa!"));
        const handler = lambdaHandler(mockFunction);
        const event = {};
        const context = {};
        try {
          await handler(event, context);
        } catch (error) {
          expect((error as any).isProjectError).not.toBeTrue();
        }
        expect.assertions(1);
      });
    });
    describe("Features", () => {
      describe("Swap lambdaHandler Parameter Order", () => {
        it("Works with the options object first", async () => {
          // Arrange
          const mockFunction = vi.fn();
          const handler = lambdaHandler(
            { unavailable: true } as any,
            mockFunction as any,
          );
          const event = {};
          const context = {};
          // Act
          try {
            await handler(event, context);
          } catch (error) {
            expect((error as any).isProjectError).toBeTrue();
            expect((error as any).status).toBe(HTTP.CODE.UNAVAILABLE);
          }
          expect.assertions(2);
        });
      });
    });
  });
});
