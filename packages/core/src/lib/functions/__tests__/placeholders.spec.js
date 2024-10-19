import { describe, expect, it } from "vitest";

import placeholders from "../placeholders.js";

//
//
// Run tests
//

describe("Placeholders", () => {
  it("Works", () => {
    const response = placeholders("Hello, {{name}}!", { name: "World" });
    expect(response).toBeString();
    expect(response).toBe("Hello, World!");
  });
  it("Works with two variables", () => {
    const response = placeholders("{{greeting}}, {{name}}!", {
      greeting: "Hi",
      name: "there",
    });
    expect(response).toBeString();
    expect(response).toBe("Hi, there!");
  });
  it("Does not replace unmapped variables", () => {
    const response = placeholders("{{greeting}}, {{name}}!", {
      greeting: "Hello",
    });
    expect(response).toBeString();
    expect(response).toBe("Hello, {{name}}!");
  });
});
