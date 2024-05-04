---
to: <%= path %>/__tests__/<%= name %><%= dotSubtype %>.spec.js
---
<%_ 
  let SpaceSubtype = "";
  // If subtype is defined, capitalize the first letter
  if(subtype) SpaceSubtype = " " + subtype.charAt(0).toUpperCase() + subtype.slice(1);
_%>
import { log } from "@knowdev/express";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { spyLog, restoreLog } from "../../../lib/mock-log/index.js"; // lib.mock-log
import { exerciseExpressSession } from "../../../lib/test/index.js"; // lib.test

// Subject
import router from "../<%= name %><%= dotSubtype %>.js";

//
//
// Mock constants
//

//
//
// Mock modules
//

vi.mock("@knowdev/express", async () => {
  const actual = await vi.importActual("@knowdev/express");
  const module = {
    ...actual,
    projectHandler: vi.fn((handler) => async (req, res, next) => {
      handler(req, res, next);
    }),
  };
  return module;
});

vi.mock("../../../models/index.js");

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
  spyLog(log);
});
afterEach(() => {
  process.env = DEFAULT_ENV;
  vi.clearAllMocks();
  restoreLog(log);
});

//
//
// Run tests
//

describe("<%= Name %><%= SpaceSubtype %>", () => {
  describe("Base Cases", () => {
    it("Is a function", () => {
      expect(router).toBeFunction();
    });
  });
  describe("Observability", () => {
    it("Does not log above trace", async () => {
      await exerciseExpressSession(router);
      expect(log.debug).not.toHaveBeenCalled();
      expect(log.error).not.toHaveBeenCalled();
      expect(log.info).not.toHaveBeenCalled();
      // expect(log.trace).toHaveBeenCalled();
      expect(log.warn).not.toHaveBeenCalled();
    });
  });
  describe("Happy Paths", () => {
    it("Responds to slash with a 200", async () => {
      const response = await exerciseExpressSession(router);
      // Defaults to 200 so no call is a pass
      expect(response.mock.res.status).not.toHaveBeenCalled();
    });
    it("Responds to slash with a JSON API response", async () => {
      const response = await exerciseExpressSession(router);
      expect(response.mock.res.json).toHaveBeenCalled();
      const jsonCall = response.mock.res.json.mock.calls[0][0];
      expect(jsonCall).toBeObject();
      expect(jsonCall).toHaveProperty("data");
    });
  });
});
