import { describe, it, expect } from "vitest";
import * as testkit from "..";
import * as mockExports from "../mock";

describe("Package Exports", () => {
  it("should export main testkit functions", () => {
    // Check that the main package exports are available
    expect(testkit).toBeDefined();
    expect(typeof testkit.createTestContext).toBe("function");
  });

  it("should export mock functions via subpath", () => {
    // Check that mock subpath exports work correctly
    expect(mockExports).toBeDefined();

    // Check a few key mock exports are available
    expect(typeof mockExports.createMockFunction).toBe("function");
    expect(typeof mockExports.mockRequest).toBe("function");
    expect(typeof mockExports.getCompletion).toBe("function");
  });
});
