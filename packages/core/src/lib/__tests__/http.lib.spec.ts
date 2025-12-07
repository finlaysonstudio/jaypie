import { describe, expect, it } from "vitest";

// Subject
import HTTP from "../http.lib.js";

//
//
// Run tests
//

describe("HTTP Constant", () => {
  it("Is an object", () => {
    expect(HTTP).toBeObject();
  });
  it("Has things we expect", () => {
    expect(HTTP).toContainKeys([
      "ALLOW",
      "CODE",
      "CONTENT",
      "HEADER",
      "METHOD",
    ]);
  });
});
