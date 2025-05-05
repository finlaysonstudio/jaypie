import { describe, it, expect } from "vitest";
import mockDefault, * as mockExports from "../../src/mock";

describe("Mock Index", () => {
  it("should export all named exports correctly", () => {
    // Check some of the core exports
    expect(typeof mockExports.validate).toBe("function");
    expect(typeof mockExports.getConfig).toBe("function");
    expect(mockExports.logger).toBeDefined();

    // Check aws exports
    expect(typeof mockExports.getMessages).toBe("function");
    expect(typeof mockExports.getSecret).toBe("function");

    // Check express exports
    expect(typeof mockExports.mockRequest).toBe("function");
    expect(typeof mockExports.mockResponse).toBe("function");

    // Check llm exports
    expect(typeof mockExports.getCompletion).toBe("function");
    expect(typeof mockExports.operate).toBe("function");

    // Check utils exports
    expect(typeof mockExports.createMockFunction).toBe("function");
    expect(typeof mockExports.createDeepMock).toBe("function");

    // Check setup exports
    expect(typeof mockExports.setupMockEnvironment).toBe("function");
    expect(typeof mockExports.teardownMockEnvironment).toBe("function");
  });

  it("should have default export with all mocks", () => {
    // Check if default export contains the same functions as named exports
    for (const key of Object.keys(mockExports)) {
      if (key !== "default") {
        expect(mockDefault).toHaveProperty(key);
        expect(mockDefault[key]).toBe(mockExports[key]);
      }
    }
  });
});
