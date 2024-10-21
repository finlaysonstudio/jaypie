import { describe, expect, it } from "vitest";

// Subject
import { EXPRESS } from "../constants.js";

//
//
// Run tests
//

describe("Constants", () => {
  it("Exports constants we expect", () => {
    expect(EXPRESS).toBeObject();
    expect(EXPRESS.PATH).toBeObject();
  });
});
