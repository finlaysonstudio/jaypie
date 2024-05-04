---
to: <%= hygen %>/<%= generator %>/<%= action %>/test.ejs.t
---
---
to: <%- '<' %>%= path %<%- '>' %>/__tests__/<%- '<' %>%= name %<%- '>' %><%- '<' %>%= dotSubtype %<%- '>' %>.spec.js
---
import { afterEach, describe, expect, it, vi } from "vitest";

// Subject
import <%- '<' %>%= name %<%- '>' %> from "../<%- '<' %>%= name %<%- '>' %><%- '<' %>%= dotSubtype %<%- '>' %>.js";

//
//
// Mock modules
//

// vi.mock("../file.js");
// vi.mock("module");

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

<%- '<' %>%_
  let Subtype = "";
  // If subtype is defined, capitalize the first letter
  if(subtype) Subtype = " " + subtype.charAt(0).toUpperCase() + subtype.slice(1);
_%<%- '>' %>
describe("<%- '<' %>%= Name %<%- '>' %><%- '<' %>%= Subtype %<%- '>' %>", () => {
  it("Works", async () => {
    const response = await <%- '<' %>%= name %<%- '>' %>();
    console.log("response :>> ", response);
    expect(response).not.toBeUndefined();
  });
});
