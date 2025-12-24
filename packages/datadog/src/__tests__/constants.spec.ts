import { describe, expect, it } from "vitest";

// Subject
import { DATADOG } from "../constants.js";

//
//
// Run tests
//

describe("Constants", () => {
  it("Exports constants we expect", () => {
    expect(DATADOG).toBeObject();
  });
});
