---
to: <%= path %>/__tests__/<%= name %><%= dotSubtype %>.spec.js
---
import { describe, expect, it } from "vitest";

// Subject
import { <%= first %> } from "../constants.js";

//
//
// Run tests
//

describe("Constants", () => {
  it("Exports constants we expect", () => {
    expect(<%= first %>).toBeObject();
  });
});
