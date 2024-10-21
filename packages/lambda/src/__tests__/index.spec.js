import { describe, expect, it } from "vitest";

// Subject
import { lambdaHandler } from "../index.js";

//
//
// Run tests
//

describe("Index", () => {
  it("Exports Function", () => {
    expect(lambdaHandler).not.toBeUndefined();
    expect(lambdaHandler).toBeFunction();
  });
});
