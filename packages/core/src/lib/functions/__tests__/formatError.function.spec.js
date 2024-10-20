import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { InternalError } from "../../errors.lib.js";
import formatError from "../formatError.function.js";

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
    expect(response.data).toBeJaypieError();
  });
});
