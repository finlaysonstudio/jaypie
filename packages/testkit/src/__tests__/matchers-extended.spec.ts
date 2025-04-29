import { describe, expect, it } from "vitest";

describe("jest-extended matchers", () => {
  it("should expose jest-extended matchers", () => {
    // Test a few jest-extended matchers to verify they're properly included
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
    
    // jest-extended matcher
    expect(instance).toBeObject();
  });
});