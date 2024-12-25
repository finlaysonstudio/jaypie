import { describe, expect, it } from "vitest";

// Subject
import { jsonApiErrorSchema, jsonApiSchema } from "../jsonApiSchema.module";

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
