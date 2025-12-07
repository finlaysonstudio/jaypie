import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

// Subject
import echoHandler from "../echo.handler.js";

//
//
// Constants
//

const SCHEMA = {
  ECHO_RESPONSE: {
    type: "object",
    properties: {
      invoke: { type: "string" },
      req: {
        type: "object",
        properties: {
          baseUrl: { type: "string" },
          headers: { type: "object" },
          method: { type: "string" },
          params: { type: "object" },
          query: { type: "object" },
          url: { type: "string" },
        },
        required: ["baseUrl"],
      },
    },
  },
};

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

describe("Express Backend", () => {
  describe("Echo router", () => {
    it("Is a function", () => {
      expect(echoHandler).toBeFunction();
    });
    it("Returns a function", () => {
      const handler = echoHandler();
      expect(handler).toBeFunction();
    });
    it("Works", async () => {
      // Setup express to use our route
      const app = express();
      const route = echoHandler();
      app.use(route);
      // Make a request
      const res = await request(app).get("/");
      expect(res.statusCode).toEqual(200);
      expect(res.body).toBeObject();
      // baseUrl is an empty string because of the mock setup
      // We don't care about this value in test
      // In production it is probably "/echo"
      expect(res.body.req.baseUrl).toEqual("");
    });
    describe("Validate various responses", () => {
      it("GET /", async () => {
        // Setup express to use our route
        const app = express();
        const route = echoHandler();
        app.use(route);
        // Make a request
        const res = await request(app).get("/");
        // Validate the response
        expect(res.statusCode).toEqual(200);
        expect(res.body).toMatchSchema(SCHEMA.ECHO_RESPONSE);
        // Check the values
        expect(res.body.req.url).toEqual("/");
        expect(res.body.req.method).toEqual("GET");
        expect(res.body.req.query).toEqual({});
      });
      it("GET /path?with=query&more", async () => {
        // Setup express to use our route
        const app = express();
        const route = echoHandler();
        app.use(route);
        // Make a request
        const res = await request(app).get("/path?with=query&more");
        // Validate the response
        expect(res.statusCode).toEqual(200);
        expect(res.body).toMatchSchema(SCHEMA.ECHO_RESPONSE);
        // Check the values
        // Is the baseUrl an empty string because of our mock setup?
        expect(res.body.req.baseUrl).toEqual("");
        expect(res.body.req.url).toEqual("/path?with=query&more");
        expect(res.body.req.method).toEqual("GET");
        expect(res.body.req.query).toEqual({
          with: "query",
          more: "",
        });
      });
      it("POST /", async () => {
        // Setup express to use our route
        const app = express();
        // eslint-disable-next-line import-x/no-named-as-default-member
        app.use(express.text());
        const route = echoHandler();
        app.use(route);
        // Make a request
        const res = await request(app).post("/").send("TEST.BODY.STRING");
        // Validate the response
        expect(res.statusCode).toEqual(200);
        expect(res.body).toMatchSchema(SCHEMA.ECHO_RESPONSE);
        // Check the values
        expect(res.body.req.url).toEqual("/");
        expect(res.body.req.method).toEqual("POST");
      });
      it("POST / (empty)", async () => {
        // Setup express to use our route
        const app = express();
        // eslint-disable-next-line import-x/no-named-as-default-member
        app.use(express.json());
        const route = echoHandler();
        app.use(route);
        // Make a request
        const res = await request(app).post("/");
        // Validate the response
        expect(res.statusCode).toEqual(200);
        expect(res.body).toMatchSchema(SCHEMA.ECHO_RESPONSE);
        // Check the values
        expect(res.body.req.url).toEqual("/");
        expect(res.body.req.method).toEqual("POST");
        expect(res.body.req.body).toEqual({}); // it converts empty body to an empty object
      });
    });
  });
});
