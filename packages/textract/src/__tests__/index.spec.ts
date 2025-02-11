import { describe, expect, it } from "vitest";

// Subject
import { MarkdownPage } from "../index.js";

//
//
// Run tests
//

describe("Index", () => {
  it("Exports what we expect", () => {
    expect(MarkdownPage).toBeClass();
  });
});
