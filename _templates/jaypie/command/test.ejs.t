---
to: <%= path %>/__tests__/<%= name %><%= dotSubtype %>.spec.js
---
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readFile } from "fs/promises";

// Subject
import <%= name %> from "../<%= name %><%= dotSubtype %>.js";

//
//
// Mock constants
//

const MOCK = {
  DOCUMENT: {},
};

//
//
// Mock modules
//

vi.mock("fs/promises");

beforeEach(() => {
  readFile.mockResolvedValue(JSON.stringify(MOCK.DOCUMENT));
});

afterEach(() => {
  vi.clearAllMocks();
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
  it("Works", async () => {
    const response = await <%= name %>({
      file: "file.json",
    });
    expect(response).not.toBeUndefined();
    expect(response).toBeObject();
  });
  describe("Error Conditions", () => {
    it("Throws an error when file is not provided", async () => {
      try {
        await <%= name %>({});
      } catch (error) {
        expect(error).toBeJaypieError();
      }
      expect.assertions(1);
    });
  });
});
