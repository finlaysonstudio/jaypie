---
to: <%= workspace %>/<%= path %>/__tests__/<%= name %><%= dotSubtype %>.spec.js
---
<%_ 
  let Subtype = "";
  // If subtype is defined, capitalize the first letter
  if(subtype) Subtype = " " + subtype.charAt(0).toUpperCase() + subtype.slice(1);
_%>
import { afterEach, describe, expect, it, vi } from "vitest";

import { model } from "mongoose";

// Subject
import <%= name %> from "../<%= name %><%= dotSubtype %>.js";

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

describe("<%= Name %><%= Subtype %>", () => {
  describe("Baseline", () => {
    it("Works", () => {
      expect(<%= name %>).not.toBeUndefined();
      expect(<%= name %>).toBeObject();
    });
    it("Can be turned into a model", () => {
      const Model = model("<%= name %>", <%= name %>);
      expect(Model).not.toBeUndefined();
      expect(() => new Model()).not.toThrow(); // It is a class
    });
    it("Can be instantiated from a model", () => {
      const Model = model("<%= name %>", <%= name %>);
      const document = new Model();
      expect(document).not.toBeUndefined();
      expect(document).toBeObject();
    });
  });
});
