import { describe, it, expect, vi, beforeEach } from "vitest";
import { lambdaHandler } from "../lambda.js";
import { BadRequestError, UnavailableError, jaypieHandler } from "../core.js";

describe("lambdaHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Mock for jaypieHandler to track calls
  vi.mock("../core.js", async (importOriginal) => {
    const actual = await importOriginal();
    return {
      ...actual,
      jaypieHandler: vi.fn(actual.jaypieHandler),
    };
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
    it("throws BadRequestError when handler is not a function", () => {
      expect(() => lambdaHandler({} as any)).toThrow(BadRequestError);
      expect(() => lambdaHandler({} as any)).toThrow(
        "handler must be a function",
      );
    });

    it("throws UnavailableError when unavailable option is true", async () => {
      const handler = vi.fn();
      const wrapped = lambdaHandler(handler, { unavailable: true });

      try {
        await wrapped({}, {});
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(UnavailableError);
        expect((error as Error).message).toBe("Service unavailable");
      }
    });

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
      const options = { name: "testHandler" };
      const wrapped = lambdaHandler(options, handler);
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

    it("provides empty objects as defaults for event and context", async () => {
      const handler = vi.fn().mockReturnValue("result");
      const wrapped = lambdaHandler(handler);
      const result = await wrapped();
      expect(handler).toHaveBeenCalledWith({}, {});
      expect(result).toBe("result");
    });
  });
});
