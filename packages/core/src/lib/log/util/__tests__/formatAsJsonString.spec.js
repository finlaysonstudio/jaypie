import { describe, expect, it } from "vitest";

import formatAsJsonString from "../formatAsJsonString.js";

//
//
// Test constants
//

const TEST = {
  SUBJECT: {
    ARRAY: ["one", "two", "three"],
    BOOLEAN: true,
    EMPTY_STRING: "",
    ERROR: new Error("Sorpresa!"),
    OBJECT: { message: "hello" },
    PARSABLE_STRING: `{"message": "hello"}`,
    UNDEFINED: undefined,
    UNPARSABLE_STRING: "hello, world",
  },
  RESULT: {
    ARRAY: "[\"one\",\"two\",\"three\"]",
    BOOLEAN: "true",
    OBJECT: "{\"message\":\"hello\"}",
    PRETTY_ARRAY: "[\n  \"one\",\n  \"two\",\n  \"three\"\n]",
    PRETTY_OBJECT: "{\n  \"message\": \"hello\"\n}",
    TWO_DOUBLE_QUOTES: `""`,
    UNDEFINED: "undefined",
  },
};

//
//
// Run tests
//

describe("formatAsJsonString util", () => {
  it("Formats a parsable string", () => {
    const result = formatAsJsonString(TEST.SUBJECT.PARSABLE_STRING);
    expect(result).toEqual(TEST.RESULT.OBJECT);
  });
  it("Formats an object", () => {
    const result = formatAsJsonString(TEST.SUBJECT.OBJECT);
    expect(result).toEqual(TEST.RESULT.OBJECT);
  });
  it("Formats an array", () => {
    const result = formatAsJsonString(TEST.SUBJECT.ARRAY);
    expect(result).toEqual(TEST.RESULT.ARRAY);
  });
  it("Leaves un-parsable strings alone", () => {
    const result = formatAsJsonString(TEST.SUBJECT.UNPARSABLE_STRING);
    expect(result).toEqual(TEST.SUBJECT.UNPARSABLE_STRING);
  });
  it("Treats empty strings as a special case", () => {
    const result = formatAsJsonString(TEST.SUBJECT.EMPTY_STRING);
    expect(result).toEqual(TEST.RESULT.TWO_DOUBLE_QUOTES);
  });
  it("Casts undefined to string", () => {
    const result = formatAsJsonString(TEST.SUBJECT.UNDEFINED);
    expect(result).toEqual(TEST.RESULT.UNDEFINED);
  });
  it("Casts anything else to string", () => {
    const result = formatAsJsonString(TEST.SUBJECT.BOOLEAN);
    expect(result).toEqual(TEST.RESULT.BOOLEAN);
  });
  it("Calls toString on instance objects", () => {
    const result = formatAsJsonString(TEST.SUBJECT.ERROR);
    expect(result).toBeString();
    expect(result).toContain("Error: Sorpresa!");
  });
  it("Doesn't die on circular JSON", () => {
    expect(() => {
      const parent = {};
      const child = { parent };
      parent.child = child;
      const result = formatAsJsonString(parent);
      expect(result).toBeString();
    }).not.toThrow();
  });
  it("Handles circular JSON elegantly", () => {
    const parent = {
      one: 1,
      two: 2,
      nested: TEST.SUBJECT.PARSABLE_STRING,
    };
    const child = { parent };
    parent.child = child;
    const result = formatAsJsonString(parent);
    expect(result).toBeString();
    const resultObject = JSON.parse(result);
    expect(resultObject.one).toBe(String(parent.one));
    expect(resultObject.two).toBe(String(parent.two));
    expect(resultObject.nested).toBe(`{"message": "hello"}`);
    expect(resultObject.child).toBe("[object Object]");
  });
});
