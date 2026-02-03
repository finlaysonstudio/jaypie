import { HTTP, JAYPIE } from "@jaypie/kit";
import { log } from "@jaypie/logger";
import { jsonApiErrorSchema, restoreLog, spyLog } from "@jaypie/testkit";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import httpRoute from "../http.handler.js";

//
//
// Mock modules
//

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Http Handler", () => {
  it("Is a function", () => {
    expect(httpRoute).toBeFunction();
  });
  it("Returns a function", () => {
    const handler = httpRoute(HTTP.CODE.NO_CONTENT);
    expect(handler).toBeFunction();
  });
  it("Works", async () => {
    // Setup express to use our route
    const app = express();
    const route = httpRoute();
    app.use(route);
    // Make a request
    const res = await request(app).get("/");
    // Check the response
    expect(res.body).not.toBeUndefined();
  });
  it("Sets the powered-by header", async () => {
    // Setup express to use our route
    const app = express();
    const route = httpRoute();
    app.use(route);
    // Make a request
    const res = await request(app).get("/");
    // Check the response
    // DIAGNOSTIC: Header includes version suffix during #178 investigation
    expect(res.headers["x-powered-by"]).toMatch(
      new RegExp(`^${JAYPIE.LIB.EXPRESS}(@\\d+\\.\\d+\\.\\d+(-dev)?)?$`),
    );
  });
  it("Returns 200 by default", async () => {
    // Setup express to use our route
    const app = express();
    const route = httpRoute();
    app.use(route);
    // Make a request
    const res = await request(app).get("/");
    // Check the response
    expect(res.statusCode).toEqual(HTTP.CODE.OK);
  });
  describe("Fully supports many default statuses", () => {
    const statuses = [
      HTTP.CODE.OK,
      HTTP.CODE.NO_CONTENT,
      HTTP.CODE.BAD_REQUEST,
      HTTP.CODE.UNAUTHORIZED,
      HTTP.CODE.FORBIDDEN,
      HTTP.CODE.NOT_FOUND,
      HTTP.CODE.METHOD_NOT_ALLOWED,
      HTTP.CODE.GONE,
      HTTP.CODE.TEAPOT,
      HTTP.CODE.INTERNAL_ERROR,
      HTTP.CODE.BAD_GATEWAY,
      HTTP.CODE.UNAVAILABLE,
      HTTP.CODE.GATEWAY_TIMEOUT,
    ];
    statuses.forEach((status) => {
      it(`Returns ${status} on request`, async () => {
        // Setup express to use our route
        const app = express();
        const route = httpRoute(status);
        app.use(route);
        // Make a request
        const res = await request(app).get("/");
        // Check the response
        expect(res.statusCode).toEqual(status);
      });
      if (status >= 400) {
        it(`Returns a JSON:API-complaint ${status} error`, async () => {
          // Setup express to use our route
          const app = express();
          const route = httpRoute(status);
          app.use(route);
          // Make a request
          const res = await request(app).get("/");
          // Check the response schema
          expect(res.body).toMatchSchema(jsonApiErrorSchema);
        });
      }
    });
  });
  it("Returns whatever you tell it", async () => {
    // Setup express to use our route
    const app = express();
    const route = httpRoute(203);
    app.use(route);
    // Make a request
    const res = await request(app).get("/");
    // Check the response
    expect(res.statusCode).toEqual(203);
  });
  describe("Logging and observability", () => {
    beforeEach(() => {
      // Spy on log.warn
      spyLog(log);
    });
    afterEach(() => {
      restoreLog(log);
    });
    it("Warns when it is an error that cannot be thrown", async () => {
      // Setup express to use our route
      const app = express();
      const route = httpRoute(499);
      app.use(route);
      // Make a request
      const res = await request(app).get("/");
      // Check the response
      expect(res.statusCode).toEqual(499);
      expect(log.warn).toHaveBeenCalledTimes(1);
      // The _exact_ message doesn't matter, but we should start with @knowdev/express for now
      expect(log.warn).toHaveBeenNthCalledWith(
        1,
        "@knowdev/express: status code 499 not mapped as throwable",
      );
    });
  });
});
