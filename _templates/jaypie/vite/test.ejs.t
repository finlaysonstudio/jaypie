---
to: <%= path %>/__tests__/<%= name %><%= dotSubtype %>.spec.js
---
// eslint-disable-next-line no-unused-vars
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import <%= name %> from "../<%= name %><%= dotSubtype %>.js";

//
//
// Mock constants
//

//
//
// Mock modules
//

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
});
afterEach(() => {
  process.env = DEFAULT_ENV;
});

//
//
// Run tests
//

<%_
  let Subtype = "";
  // If subtype is defined, capitalize the first letter
  if(subtype) Subtype = " " + subtype.charAt(0).toUpperCase() + subtype.slice(1);
_%>
describe("<%= Name %><%= Subtype %>", () => {
  it("Works", () => {
    const response = <%= name %>();
    console.log("response :>> ", response);
    expect(response).not.toBeUndefined();
  });
});
