import express from "express";
import { HTTP, NotFoundError } from "@jaypie/core";
import request from "supertest";
import { describe, expect, it } from "vitest";

import matchers from "../matchers.module";

// Subject
import mocks from "../jaypie.mock";

const { expressHandler } = mocks;
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
      const app = express();
      app.get(
        "/",
        // We need to cast this to any to avoid the TypeScript error
        // since the mock returns a function that doesn't match Express's handler type
        expressHandler(() => ({ message: "Hello" })) as any,
      );
      const response = await request(app)
        .get("/")
        .expect("Content-Type", /json/)
        .expect(200)
        .expect({ message: "Hello" });
      expect(response.statusCode).toEqual(HTTP.CODE.OK);
      expect(response.body.message).toEqual("Hello");
    });
    it("Works when we have a simple json response handler (await response style)", async () => {
      const app = express();
      app.get("/", expressHandler(() => ({ message: "Hello" })) as any);
      const response = await request(app).get("/");
      expect(response.statusCode).toEqual(HTTP.CODE.OK);
      expect(response.body.message).toEqual("Hello");
    });
    it("Works when the router throws", async () => {
      const app = express();
      app.get(
        "/",
        expressHandler(() => {
          throw new NotFoundError();
        }) as any,
      );
      const response = await request(app).get("/");
      expect(response.statusCode).toEqual(HTTP.CODE.NOT_FOUND);
    });
  });
});
