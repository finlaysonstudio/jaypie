import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { InternalError } from "../../errors.lib.js";
import { matchers } from "jest-json-schema";
import formatError from "../formatError.function.js";

//
//
// Configuration
//

expect.extend(matchers);

const jsonApiErrorSchema = {
  type: "object",
  properties: {
    errors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          status: { type: "number" },
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["status", "title"],
      },
    },
  },
  required: ["errors"],
};

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

describe("FormatError function", () => {
  it("Works", () => {
    const response = formatError(new InternalError());
    expect(response).toBeObject();
    expect(response.status).toBeNumber();
    expect(response.data).toMatchSchema(jsonApiErrorSchema);
  });
});
