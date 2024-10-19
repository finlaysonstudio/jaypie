import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfigurationError } from "../../errors.lib.js";

// Subject
import isJaypieError from "../isJaypieError.function.js";

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("IsJaypieError Function", () => {
  it("Works", () => {
    const error = new ConfigurationError();
    const response = isJaypieError(error);
    expect(response).not.toBeUndefined();
    expect(response).toBeBoolean();
    expect(response).toBeTrue();
  });
});
