import { afterEach, describe, expect, it, vi } from "vitest";

// Subject
import index from "./index.js";

//
//
// Mock modules
//

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Index", () => {
  it("Works", () => {
    expect(index).not.toBeUndefined();
    expect(Array.isArray(index)).toBe(true);
  });
});
