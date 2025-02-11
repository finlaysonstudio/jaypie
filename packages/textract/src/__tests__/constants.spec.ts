import { describe, expect, it } from "vitest";

// Subject
import { TYPE, WORD } from "../constants.js";

//
//
// Run tests
//

describe("Constants", () => {
  it("Exports constants we expect", () => {
    expect(TYPE).toBeObject();
    expect(WORD).toBeObject();
  });
});
