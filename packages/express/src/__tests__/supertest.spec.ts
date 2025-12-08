import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from "vitest";

import { HTTP } from "@jaypie/kit";
import { log } from "@jaypie/logger";
import { restoreLog, spyLog } from "@jaypie/testkit";
import express from "express";
import request from "supertest";

import getCurrentInvokeUuid from "../getCurrentInvokeUuid.adapter.js";

// Subject
import expressHandler from "../expressHandler.js";

//
//
// Mock modules
//

vi.mock("../getCurrentInvokeUuid.adapter.js");

beforeEach(() => {
  (
    getCurrentInvokeUuid as MockedFunction<typeof getCurrentInvokeUuid>
  ).mockReturnValue("MOCK_UUID");
  spyLog(log);
});

afterEach(() => {
  restoreLog(log);
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Express handler", () => {
  describe("Project handler function", () => {
    describe("Observability", () => {
      it("Does not log about trace", async () => {
        const mockFunction = vi.fn(() => ({
          goose: "honk",
        }));
        const handler = expressHandler(mockFunction, {
          name: "handler",
        });
        // Set up our mock express app
        const app = express();
        app.use(handler);
        await request(app).get("/");
        expect(log.fatal).not.toBeCalled();
        expect(log.error).not.toBeCalled();
        expect(log.warn).not.toBeCalled();
        expect(log.info).not.toBeCalled();
        expect(log.debug).not.toBeCalled();
      });
    });
    describe("In an express context", () => {
      it("Works and logs GET requests with no body", async () => {
        // Set up our mock function
        const mockFunction = vi.fn(() => ({
          goose: "honk",
        }));
        const handler = expressHandler(mockFunction, {
          name: "handler",
        });
        // Set up our mock express app
        const app = express();
        app.use(handler);
        // Make a request
        const res = await request(app).get("/");
        expect(res.body).toEqual({ goose: "honk" });
        // Check the log was called twice: once for the request, once for the response
        expect(log.var).toBeCalledTimes(2);
        // Both calls should be an object with a single key: "req" or "res"
        expect(
          (log.info.var as ReturnType<typeof vi.fn>).mock.calls[0][0],
        ).toHaveProperty("req");
        expect(
          (log.info.var as ReturnType<typeof vi.fn>).mock.calls[1][0],
        ).toHaveProperty("res");
        expect(
          (log.info.var as ReturnType<typeof vi.fn>).mock.calls[1][0].res.body,
        ).toEqual({
          goose: "honk",
        });
        // The count of keys in each call should be 1
        expect(
          Object.keys(
            (log.info.var as ReturnType<typeof vi.fn>).mock.calls[0][0],
          ).length,
        ).toEqual(1);
        expect(
          Object.keys(
            (log.info.var as ReturnType<typeof vi.fn>).mock.calls[1][0],
          ).length,
        ).toEqual(1);
      });
      it("POST requests with a body", async () => {
        // Set up our mock function
        const mockFunction = vi.fn(() => ({
          goose: "honk",
        }));
        const handler = expressHandler(mockFunction, {
          name: "handler",
        });
        // Set up our mock express app
        const app = express();
        // eslint-disable-next-line import-x/no-named-as-default-member
        app.use(express.json());
        app.use(handler);
        // Make a request
        const res = await request(app).post("/").send({ cat: "meow" });
        expect(res.headers["content-type"]).toContain("application/json");
        expect(res.body).toEqual({ goose: "honk" });
        // Check the log was called twice: once for the request, once for the response
        expect(log.var).toBeCalledTimes(2);
        // Both calls should be an object with a single key: "req" or "res"
        expect(
          (log.info.var as ReturnType<typeof vi.fn>).mock.calls[0][0],
        ).toHaveProperty("req");
        expect(
          (log.info.var as ReturnType<typeof vi.fn>).mock.calls[0][0].req.body,
        ).toEqual({ cat: "meow" });
        expect(
          (log.info.var as ReturnType<typeof vi.fn>).mock.calls[1][0],
        ).toHaveProperty("res");
        expect(
          (log.info.var as ReturnType<typeof vi.fn>).mock.calls[1][0].res.body,
        ).toEqual({
          goose: "honk",
        });
        // The count of keys in each call should be 1
        expect(
          Object.keys(
            (log.info.var as ReturnType<typeof vi.fn>).mock.calls[0][0],
          ).length,
        ).toEqual(1);
        expect(
          Object.keys(
            (log.info.var as ReturnType<typeof vi.fn>).mock.calls[1][0],
          ).length,
        ).toEqual(1);
      });
      it("Returning HTML", async () => {
        // Set up our mock function
        const mockFunction = vi.fn(() => "<h1>Hello, world!</h1>");
        const handler = expressHandler(mockFunction, {
          name: "handler",
        });
        // Set up our mock express app
        const app = express();
        app.use(handler);
        // Make a request
        const res = await request(app).get("/");
        expect(res.headers["content-type"]).toContain("text/html");
        expect(res.text).toEqual("<h1>Hello, world!</h1>");
        // Check the log was called twice: once for the request, once for the response
        expect(log.var).toBeCalledTimes(2);
        // Both calls should be an object with a single key: "req" or "res"
        expect(
          (log.info.var as ReturnType<typeof vi.fn>).mock.calls[0][0],
        ).toHaveProperty("req");
        expect(
          (log.info.var as ReturnType<typeof vi.fn>).mock.calls[1][0],
        ).toHaveProperty("res");
        expect(
          (log.info.var as ReturnType<typeof vi.fn>).mock.calls[1][0].res.body,
        ).toEqual("<h1>Hello, world!</h1>");
        // The count of keys in each call should be 1
        expect(
          Object.keys(
            (log.info.var as ReturnType<typeof vi.fn>).mock.calls[0][0],
          ).length,
        ).toEqual(1);
        expect(
          Object.keys(
            (log.info.var as ReturnType<typeof vi.fn>).mock.calls[1][0],
          ).length,
        ).toEqual(1);
      });
      it("Returning String", async () => {
        // Set up our mock function
        const mockFunction = vi.fn(() => "Hello, world!");
        const handler = expressHandler(mockFunction, {
          name: "handler",
        });
        // Set up our mock express app
        const app = express();
        app.use(handler);
        // Make a request
        const res = await request(app).get("/");
        expect(res.headers["content-type"]).toContain("text/html");
        expect(res.text).toEqual("Hello, world!");
        // Check the log was called twice: once for the request, once for the response
        expect(log.var).toBeCalledTimes(2);
        // Both calls should be an object with a single key: "req" or "res"
        expect(
          (log.info.var as ReturnType<typeof vi.fn>).mock.calls[0][0],
        ).toHaveProperty("req");
        expect(
          (log.info.var as ReturnType<typeof vi.fn>).mock.calls[1][0],
        ).toHaveProperty("res");
        expect(
          (log.info.var as ReturnType<typeof vi.fn>).mock.calls[1][0].res.body,
        ).toEqual("Hello, world!");
        // The count of keys in each call should be 1
        expect(
          Object.keys(
            (log.info.var as ReturnType<typeof vi.fn>).mock.calls[0][0],
          ).length,
        ).toEqual(1);
        expect(
          Object.keys(
            (log.info.var as ReturnType<typeof vi.fn>).mock.calls[1][0],
          ).length,
        ).toEqual(1);
      });
      it("Returning no content", async () => {
        const mockFunction = vi.fn(() => null);
        const handler = expressHandler(mockFunction, {
          name: "handler",
        });
        const app = express();
        app.use(handler);
        // Make a request
        const res = await request(app).get("/");
        expect(res.status).toEqual(HTTP.CODE.NO_CONTENT);
        expect(res.headers["content-type"]).toBeUndefined();
      });
      it("Returning created", async () => {
        const mockFunction = vi.fn(() => true);
        const handler = expressHandler(mockFunction, {
          name: "handler",
        });
        const app = express();
        app.use(handler);
        // Make a request
        const res = await request(app).get("/");
        expect(res.status).toEqual(HTTP.CODE.CREATED);
        expect(res.headers["content-type"]).toBeUndefined();
      });
    });
  });
});
