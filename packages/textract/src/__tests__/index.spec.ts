import { describe, expect, it } from "vitest";

// Subject
import { Page } from "../index.js";

//
//
// Run tests
//

describe("Index", () => {
  it("Exports what we expect", () => {
    expect(Page).toBeClass();
  });
});
