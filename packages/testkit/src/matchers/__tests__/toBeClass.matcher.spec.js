// eslint-disable-next-line no-unused-vars
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import toBeClass from "../toBeClass.matcher.js";

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

describe("To Be Class Matcher", () => {
  it("Is a function", () => {
    expect(toBeClass).toBeFunction();
  });
  describe("Error Conditions", () => {
    it("Rejects non-functions", () => {
      const result = toBeClass(12);
      expect(result.message).toBeFunction();
      expect(result.message()).toBeString();
      expect(result.pass).toBeFalse();
    });
    it("Rejects if nothing passed", () => {
      const result = toBeClass();
      expect(result.message).toBeFunction();
      expect(result.message()).toBeString();
      expect(result.pass).toBeFalse();
    });
    it("Rejects if non-class function is passed", () => {
      const result = toBeClass(() => {});
      expect(result.message).toBeFunction();
      expect(result.message()).toBeString();
      expect(result.pass).toBeFalse();
    });
  });
  describe("Success Conditions", () => {
    it("Accepts class functions", () => {
      class Test {}
      const result = toBeClass(Test);
      expect(result.message).toBeFunction();
      expect(result.message()).toBeString();
      expect(result.pass).toBeTrue();
    });
  });
});
