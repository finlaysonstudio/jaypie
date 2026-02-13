import { describe, expect, it, vi } from "vitest";
import { expressHandler } from "jaypie";

import keyTestRoute from "../keyTest.route.js";

//
//
// Tests
//

describe("keyTest.route", () => {
  it("is defined", () => {
    expect(keyTestRoute).toBeDefined();
  });

  it("calls expressHandler", () => {
    expect(expressHandler).toHaveBeenCalled();
  });

  it("configures secrets", () => {
    expect(expressHandler).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        secrets: ["PROJECT_ADMIN_SEED"],
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
    expect(typeof keyTestRoute).toBe("function");
  });
});
