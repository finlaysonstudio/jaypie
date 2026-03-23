import { describe, expect, it, vi } from "vitest";
import { expressHandler } from "jaypie";

import apikeyValidateRoute from "../apikeyValidate.route.js";

//
//
// Tests
//

describe("apikeyValidate.route", () => {
  it("is defined", () => {
    expect(apikeyValidateRoute).toBeDefined();
  });

  it("calls expressHandler", () => {
    expect(expressHandler).toHaveBeenCalled();
  });

  it("configures secrets", () => {
    expect(expressHandler).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        secrets: ["PROJECT_SALT"],
      }),
    );
  });

  it("configures setup", () => {
    expect(expressHandler).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        setup: expect.any(Function),
      }),
    );
  });

  it("is a function (route handler)", () => {
    expect(typeof apikeyValidateRoute).toBe("function");
  });
});
