import { describe, expect, it } from "vitest";

// Subject
import objectToKeyValueArray from "../objectToKeyValueArray.pipeline.js";

//
//
// Run tests
//

describe("ObjectToKeyValueArray Pipeline", () => {
  it("Is a function", () => {
    expect(objectToKeyValueArray).toBeFunction();
    const response = objectToKeyValueArray();
    expect(response).toBeUndefined();
  });
  it("Combines keys into key-value pairs", () => {
    const response = objectToKeyValueArray({ a: 1, b: 2 });
    expect(response).toEqual(["a:1", "b:2"]);
  });
  it("Does not quote strings", () => {
    const response = objectToKeyValueArray({ a: "1", b: "2" });
    expect(response).toEqual(["a:1", "b:2"]);
  });
  it("Handles empty object", () => {
    const response = objectToKeyValueArray({});
    expect(response).toEqual([]);
  });
  it("Handles key set to undefined", () => {
    const response = objectToKeyValueArray({ a: undefined });
    expect(response).toEqual(["a:undefined"]);
  });
  it("Casts object values to JSON", () => {
    const response = objectToKeyValueArray({ a: { project: "mayhem" } });
    expect(response).toEqual(['a:{"project":"mayhem"}']);
  });
  it("Returns non-object argument unaltered", () => {
    const item = [1, 2, 3];
    const response = objectToKeyValueArray(item);
    expect(response).toEqual(item);
  });
  it("Handles null argument", () => {
    const response = objectToKeyValueArray(null);
    expect(response).toBeNull();
  });
});
