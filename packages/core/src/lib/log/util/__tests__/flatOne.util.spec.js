import { afterEach, beforeEach, describe, expect, it } from "vitest";

import flatOne from "../flatOne.util.js";

//
//
// Mock constants
//

//
//
// Mock modules
//

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
});
afterEach(() => {
  process.env = DEFAULT_ENV;
});

//
//
// Run tests
//

describe("FlatOne util", () => {
  it("Is a function", () => {
    expect(flatOne).toBeFunction();
  });
  it("Returns undefined if nothing is passed", () => {
    expect(flatOne()).toBeUndefined();
  });
  it("If the value is not an array, it returns the value", () => {
    // Arrange
    const value = "value";
    // Act
    const result = flatOne(value);
    // Assert
    expect(result).toBe(value);
    // Done
  });
  it("If the value is an array with one item, it returns that item", () => {
    // Arrange
    const value = ["value"];
    // Act
    const result = flatOne(value);
    // Assert
    expect(result).toBe(value[0]);
    // Done
  });
  it("If the value is an array with zeros item, it returns the empty array", () => {
    // Arrange
    const value = [];
    // Act
    const result = flatOne(value);
    // Assert
    expect(result).toBe(value);
    // Done
  });
  it("If the value is an array with multiple items, it returns the array", () => {
    // Arrange
    const value = ["value", "value"];
    // Act
    const result = flatOne(value);
    // Assert
    expect(result).toBe(value);
    // Done
  });
});
