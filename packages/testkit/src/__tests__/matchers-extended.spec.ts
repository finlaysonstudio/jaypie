import { describe, expect, it } from "vitest";

describe("Extended matchers", () => {
  it("should expose the absorbed extended matchers", () => {
    // Verify the matchers formerly provided by jest-extended are included
    expect([1, 2, 3]).toBeArray();
    expect(true).toBeBoolean();
    expect(42).toBeNumber();
    expect({ foo: "bar" }).toBeObject();
    expect("hello").toBeString();
    expect(true).toBeTrue();
    expect(false).toBeFalse();
    expect(() => {}).toBeFunction();
    expect("hello").toStartWith("h");
    expect("hello").toEndWith("o");

    // Test it also works with .not
    expect("hello").not.toBeEmpty();
    expect([]).toBeEmpty();
  });

  it("should work alongside Jaypie custom matchers", () => {
    class TestClass {}
    const instance = new TestClass();

    // Custom Jaypie matcher
    expect(TestClass).toBeClass();

    // Absorbed extended matcher
    expect(instance).toBeObject();
  });

  describe("Parity with jest-extended semantics", () => {
    it("toBeArray / toBeArrayOfSize", () => {
      expect([1, 2]).toBeArrayOfSize(2);
      expect([]).toBeArrayOfSize(0);
      expect("not-array").not.toBeArray();
      expect([1, 2]).not.toBeArrayOfSize(3);
    });

    it("toBeObject excludes arrays, null, and built-ins", () => {
      expect({}).toBeObject();
      expect([]).not.toBeObject();
      expect(null).not.toBeObject();
      expect(new Map()).not.toBeObject();
      expect(new Set()).not.toBeObject();
      expect(new Date()).not.toBeObject();
    });

    it("toBeEmpty covers objects, strings, and iterables", () => {
      expect({}).toBeEmpty();
      expect("").toBeEmpty();
      expect([]).toBeEmpty();
      expect(new Map()).toBeEmpty();
      expect(new Set()).toBeEmpty();
      expect({ a: 1 }).not.toBeEmpty();
      expect("a").not.toBeEmpty();
      expect([1]).not.toBeEmpty();
    });

    it("type predicates are strict", () => {
      expect(0).toBeNumber();
      expect("0").not.toBeNumber();
      expect(true).not.toBeNumber();
      expect("").toBeString();
      expect(1).not.toBeString();
      expect(false).toBeBoolean();
      expect(0).not.toBeBoolean();
      expect(true).not.toBeFalse();
      expect(false).not.toBeTrue();
    });

    it("toContainKeys / toContainAllKeys", () => {
      const subject = { alpha: 1, beta: 2 };
      expect(subject).toContainKeys(["alpha"]);
      expect(subject).toContainKeys(["alpha", "beta"]);
      expect(subject).not.toContainKeys(["gamma"]);
      expect(subject).toContainAllKeys(["alpha", "beta"]);
      expect(subject).not.toContainAllKeys(["alpha"]);
      expect(subject).not.toContainAllKeys(["alpha", "beta", "gamma"]);
    });

    it("toInclude / toStartWith / toEndWith", () => {
      expect("hello world").toInclude("o w");
      expect("hello world").not.toInclude("xyz");
      expect([1, 2, 3]).toInclude(2);
      expect("filename.txt").toStartWith("file");
      expect("filename.txt").toEndWith(".txt");
      expect("filename.txt").not.toStartWith("name");
    });
  });
});
