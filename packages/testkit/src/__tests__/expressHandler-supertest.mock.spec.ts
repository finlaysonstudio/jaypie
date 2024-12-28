import express from "express";
import { HTTP, NotFoundError } from "@jaypie/core";
import request from "supertest";
import { describe, expect, it } from "vitest";

import matchers from "../matchers.module";

// Subject
import { expressHandler } from "../jaypie.mock";

// Add custom matchers
expect.extend(matchers);

//
//
// Run tests
//

describe("expressHandler", () => {
  it("Is a function", () => {
    expect(expressHandler).toBeFunction();
  });
  describe("supertest", () => {
    it("Works when we have a simple json response handler (supertest return style)", async () => {
      const route = express();
      route.get(
        "/",
        expressHandler(() => ({ message: "Hello" })),
      );
      const response = await request(route)
        .get("/")
        .expect("Content-Type", /json/)
        .expect(200)
        .expect({ message: "Hello" });
      expect(response.statusCode).toEqual(HTTP.CODE.OK);
      expect(response.body.message).toEqual("Hello");
    });
    it("Works when we have a simple json response handler (await response style)", async () => {
      const route = express();
      route.get(
        "/",
        expressHandler(() => ({ message: "Hello" })),
      );
      const response = await request(route).get("/");
      expect(response.statusCode).toEqual(HTTP.CODE.OK);
      expect(response.body.message).toEqual("Hello");
    });
    it("Works when the router throws", async () => {
      const route = express();
      route.get(
        "/",
        expressHandler(() => {
          throw new NotFoundError();
        }),
      );
      const response = await request(route).get("/");
      expect(response.statusCode).toEqual(HTTP.CODE.NOT_FOUND);
    });
  });
});
