import { describe, expect, it } from "vitest";

// Subject
import isClass from "../isClass.function.js";

//
//
// Mock constants
//

const TEST = {
  CLASS: class {},
  FUNCTION: () => {},
};

//
//
// Run tests
//

describe("IsClass Function", () => {
  it("Returns true for classes", () => {
    expect(isClass(TEST.CLASS)).toBeTrue();
  });
  it("Returns false for functions", () => {
    expect(isClass(TEST.FUNCTION)).toBeFalse();
  });
  it("Returns false for undefined", () => {
    expect(isClass(undefined)).toBeFalse();
  });
});
