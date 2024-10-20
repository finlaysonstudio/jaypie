import { afterEach, describe, expect, it, vi } from "vitest";

// Subject
import toBeCalledWithInitialParams from "../toBeCalledWithInitialParams.matcher.js";

expect.extend({ toBeCalledWithInitialParams });

//
//
// Run tests
//

describe("ToBeCalledWithInitialParams Matcher", () => {
  it("Is a function", () => {
    expect(toBeCalledWithInitialParams).toBeFunction();
  });
  describe("Error Conditions", () => {
    it("Rejects if nothing passed", () => {
      const result = toBeCalledWithInitialParams();
      expect(result.message).toBeFunction();
      expect(result.message()).toBeString();
      expect(result.pass).toBeFalse();
    });
    it("Rejects if non-object passed", () => {
      const result = toBeCalledWithInitialParams(12);
      expect(result.message).toBeFunction();
      expect(result.message()).toBeString();
      expect(result.pass).toBeFalse();
    });
  });
  describe("Success Conditions", () => {
    it("Matches if the call is identical", () => {
      const mock = vi.fn();
      mock("a", "b", "c");
      const result = toBeCalledWithInitialParams(mock, "a", "b", "c");
      expect(result.message).toBeFunction();
      expect(result.message()).toBeString();
      expect(result.pass).toBeTrue();
    });
    it("Matches if the call is correct with more params", () => {
      const mock = vi.fn();
      mock("a", "b", "c");
      const result = toBeCalledWithInitialParams(mock, "a", "b");
      expect(result.message).toBeFunction();
      expect(result.message()).toBeString();
      expect(result.pass).toBeTrue();
    });
    it("Does not match if the call is incorrect", () => {
      const mock = vi.fn();
      mock("a", "b", "c");
      const result = toBeCalledWithInitialParams(mock, "a", "b", "d");
      expect(result.message).toBeFunction();
      expect(result.message()).toBeString();
      expect(result.pass).toBeFalse();
    });
    it("Does not match if the call is close but misses first param", () => {
      const mock = vi.fn();
      mock("a", "b", "c");
      const result = toBeCalledWithInitialParams(mock, "b", "c");
      expect(result.message).toBeFunction();
      expect(result.message()).toBeString();
      expect(result.pass).toBeFalse();
    });
  });
});

describe("toBeCalledWithInitialParams matcher", () => {
  afterEach(vi.clearAllMocks);
  const mockFunction = vi.fn((one, two, three) => {
    if (three) return three;
    if (two) return two;
    return one;
  });
  describe("Native toHaveBeenCalledWith matcher", () => {
    it("Matches one param", () => {
      mockFunction(1);
      expect(mockFunction).toHaveBeenCalledWith(1);
    });
    it("Matches two param", () => {
      mockFunction(1, 2);
      expect(mockFunction).toHaveBeenCalledWith(1, 2);
    });
    it("Does not match single param when two passed", () => {
      mockFunction(1, 2);
      expect(mockFunction).not.toHaveBeenCalledWith(1);
    });
  });
  describe("toBeCalledWithInitialParams matcher", () => {
    it("Matches one param", () => {
      mockFunction(1);
      expect(mockFunction).toBeCalledWithInitialParams(1);
    });
    it("Matches two param", () => {
      mockFunction(1, 2);
      expect(mockFunction).toBeCalledWithInitialParams(1, 2);
    });
    it("Matches single param when two passed", () => {
      mockFunction(1, 2);
      expect(mockFunction).toBeCalledWithInitialParams(1);
    });
    it("Does not match two param when one passed", () => {
      mockFunction(1);
      expect(mockFunction).not.toBeCalledWithInitialParams(1, 2);
    });
    it("Finds a needle in a haystack", () => {
      mockFunction();
      mockFunction(12);
      mockFunction(1, 2);
      mockFunction(13);
      mockFunction(12, 13);
      expect(mockFunction).toBeCalledWithInitialParams(1, 2);
    });
    it("Does not match false positives", () => {
      mockFunction();
      mockFunction(1);
      mockFunction(2);
      mockFunction(2, 1);
      expect(mockFunction).not.toBeCalledWithInitialParams(1, 2);
    });
    it("Matches zero params!?", () => {
      mockFunction();
      expect(mockFunction).toBeCalledWithInitialParams();
    });
    it("Zero params matches anything!?", () => {
      mockFunction(1, 2, 3);
      expect(mockFunction).toBeCalledWithInitialParams();
    });
    it("Matches arrays", () => {
      mockFunction([1, 2, 3]);
      expect(mockFunction).toBeCalledWithInitialParams([1, 2, 3]);
    });
    it("Matches objects", () => {
      mockFunction({ one: 1 });
      expect(mockFunction).toBeCalledWithInitialParams({ one: 1 });
    });
  });
});
