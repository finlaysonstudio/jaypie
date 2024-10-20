// eslint-disable-next-line no-unused-vars
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import { jsonApiErrorSchema, jsonApiSchema } from "../jsonApiSchema.module.js";

//
//
// Run tests
//

describe("Json Api Schema Module", () => {
  it("Exports objects", () => {
    expect(jsonApiSchema).toBeObject();
    expect(jsonApiErrorSchema).toBeObject();
  });
});
