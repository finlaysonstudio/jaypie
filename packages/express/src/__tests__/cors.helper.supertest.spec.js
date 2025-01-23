import { HTTP } from "@jaypie/core";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import corsHelper from "../cors.helper.js";

//
//
// Mock modules
//

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.BASE_URL;
  delete process.env.PROJECT_BASE_URL;
});

//
//
// Run tests
//

describe("Supertest", () => {
  it("works", async () => {
    const route = express();
    route.get("/", (req, res) => {
      res.json({ message: "Hello" });
    });
    const response = await request(route)
      .get("/")
      .expect("Content-Type", /json/)
      .expect(HTTP.CODE.OK)
      .expect({ message: "Hello" });
    expect(response.statusCode).toEqual(HTTP.CODE.OK);
    expect(response.body.message).toEqual("Hello");
  });
});

describe("corsHelper with supertest", () => {
  it("works", async () => {
    const route = express();
    route.get("/", corsHelper(), (req, res) => {
      res.json({ message: "Hello" });
    });
    const response = await request(route)
      .get("/")
      .expect("Content-Type", /json/)
      .expect(HTTP.CODE.OK)
      .expect({ message: "Hello" });
    expect(response.statusCode).toEqual(HTTP.CODE.OK);
    expect(response.body.message).toEqual("Hello");
  });
  it("works with a wildcard origin", async () => {
    const route = express();
    route.get("/", corsHelper({ origin: "*" }), (req, res) => {
      res.json({ message: "Hello" });
    });
    const response = await request(route)
      .get("/")
      .set("Origin", "https://any-domain.com")
      .expect("Content-Type", /json/)
      .expect(HTTP.CODE.OK)
      .expect({ message: "Hello" });
    expect(response.statusCode).toEqual(HTTP.CODE.OK);
    expect(response.body.message).toEqual("Hello");
  });
  it("works with a matching origin", async () => {
    const route = express();
    route.get(
      "/",
      corsHelper({ origin: "https://api.example.com" }),
      (req, res) => {
        res.json({ message: "Hello" });
      },
    );
    const response = await request(route)
      .get("/")
      .set("Origin", "https://api.example.com")
      .expect("Content-Type", /json/)
      .expect(200)
      .expect({ message: "Hello" });
    expect(response.statusCode).toEqual(HTTP.CODE.OK);
    expect(response.body.message).toEqual("Hello");
  });
  it("works with an origin matching BASE_URL", async () => {
    process.env.BASE_URL = "https://api.example.com";
    const route = express();
    route.get("/", corsHelper(), (req, res) => {
      res.json({ message: "Hello" });
    });
    const response = await request(route)
      .get("/")
      .set("Origin", "https://api.example.com")
      .expect("Content-Type", /json/)
      .expect(HTTP.CODE.OK)
      .expect({ message: "Hello" });
    expect(response.statusCode).toEqual(HTTP.CODE.OK);
    expect(response.body.message).toEqual("Hello");
  });
  it("allows localhost if env is sandbox", async () => {
    process.env.PROJECT_ENV = "sandbox";
    const route = express();
    route.get("/", corsHelper(), (req, res) => {
      res.json({ message: "Hello" });
    });
    const response = await request(route)
      .get("/")
      .set("Origin", "http://localhost")
      .expect("Content-Type", /json/)
      .expect(HTTP.CODE.OK)
      .expect({ message: "Hello" });
    expect(response.statusCode).toEqual(HTTP.CODE.OK);
    expect(response.body.message).toEqual("Hello");
  });
  it("allows localhost if sandbox mode is true", async () => {
    process.env.PROJECT_ENV = "unknown";
    process.env.PROJECT_SANDBOX_MODE = true;
    const route = express();
    route.get("/", corsHelper(), (req, res) => {
      res.json({ message: "Hello" });
    });
    const response = await request(route)
      .get("/")
      .set("Origin", "http://localhost")
      .expect("Content-Type", /json/)
      .expect(HTTP.CODE.OK)
      .expect({ message: "Hello" });
    expect(response.statusCode).toEqual(HTTP.CODE.OK);
    expect(response.body.message).toEqual("Hello");
  });
  it("denies requests with a non-matching origin", async () => {
    const route = express();
    route.get(
      "/",
      corsHelper({ origin: "https://api.example.com" }),
      (req, res) => {
        res.json({ message: "Hello" });
      },
    );
    const response = await request(route)
      .get("/")
      .set("Origin", "https://any-domain.com")
      .expect(HTTP.CODE.UNAUTHORIZED);
    expect(response.statusCode).toEqual(HTTP.CODE.UNAUTHORIZED);
  });
  it("allows any requested headers", async () => {
    const route = express();
    route.options("/", corsHelper(), (req, res) => {
      res.json({ message: "Hello" });
    });
    const response = await request(route)
      .options("/")
      .set("Access-Control-Request-Headers", "X-Project-Token");
    expect(response.headers["access-control-allow-headers"]).toEqual(
      "X-Project-Token",
    );
  });
});
