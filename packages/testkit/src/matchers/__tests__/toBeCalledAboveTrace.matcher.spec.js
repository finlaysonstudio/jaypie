import { afterEach, describe, expect, it, vi } from "vitest";

import { log } from "../../jaypie.mock.js";

// Subject
import toBeCalledAboveTrace from "../toBeCalledAboveTrace.matcher.js";

// Extend expect with custom matchers
expect.extend({ toBeCalledAboveTrace });

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

describe("Called Above Trace Matcher", () => {
  it("Is a function", () => {
    expect(toBeCalledAboveTrace).toBeFunction();
  });
  describe("Error Conditions", () => {
    it("Throws if nothing passed", () => {
      expect(() => toBeCalledAboveTrace()).toThrowError();
      try {
        expect().toBeCalledAboveTrace();
      } catch (error) {
        expect(error).toBeObject();
        expect(error.message).toBeString();
      }
      expect.assertions(4);
    });
  });
  describe("Happy Path", () => {
    it("Matches instances of log mock", () => {
      log.fatal("This is fatal");
      const result = toBeCalledAboveTrace(log);
      expect(result.message).toBeFunction();
      expect(result.message()).toBeString();
      expect(result.pass).toBeTrue();
      expect(log).toBeCalledAboveTrace();
    });
    it("Matches instances of log mock", () => {
      log.trace("This is a trace");
      const result = toBeCalledAboveTrace(log);
      expect(result.message).toBeFunction();
      expect(result.message()).toBeString();
      expect(result.pass).toBeFalse();
      expect(log).not.toBeCalledAboveTrace();
    });
  });
});
