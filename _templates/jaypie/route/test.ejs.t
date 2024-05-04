---
to: <%= path %>/__tests__/<%= name %><%= dotSubtype %>.spec.js
---
<%_ 
  let SpaceSubtype = "";
  // If subtype is defined, capitalize the first letter
  if(subtype) SpaceSubtype = " " + subtype.charAt(0).toUpperCase() + subtype.slice(1);
_%>
import { log } from "@knowdev/express";
import HTTP from "@knowdev/http";

import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { spyLog, restoreLog } from "../../lib/mock-log/index.js";

// Subject
import router from "../<%= name %><%= dotSubtype %>.js";

const route = express();
route.use(router);

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
    it("Has properties of an express router", () => {
      expect(router).toHaveProperty("all");
      expect(router).toHaveProperty("get");
      expect(router).toHaveProperty("params");
      expect(router).toHaveProperty("post");
      expect(router).toHaveProperty("stack");
      expect(router).toHaveProperty("use");
    });
  });
  describe("Error Conditions", () => {
    it("Response to bad method with a 405 not allowed", async () => {
      const res = await request(route).post("/");
      expect(res.statusCode).toEqual(HTTP.CODE.METHOD_NOT_ALLOWED);
    });
    it("Response to bad URL with a 404 not found", async () => {
      const res = await request(route).post("/_");
      expect(res.statusCode).toEqual(HTTP.CODE.NOT_FOUND);
    });
  });
  describe("Observability", () => {
    it("Does not log above trace", async () => {
      await request(route).get("/");
      expect(log.debug).not.toHaveBeenCalled();
      expect(log.error).not.toHaveBeenCalled();
      expect(log.info).not.toHaveBeenCalled();
      // expect(log.trace).toHaveBeenCalled();
      expect(log.warn).not.toHaveBeenCalled();
    });
  });
  describe("Happy Paths", () => {
    it("Responds to slash with a 200", async () => {
      const res = await request(route).get("/");
      expect(res.statusCode).toEqual(HTTP.CODE.OK);
    });
    it("Responds to slash with a JSON API response", async () => {
      const res = await request(route).get("/");
      expect(res.body).toBeObject();
    });
  });
});
