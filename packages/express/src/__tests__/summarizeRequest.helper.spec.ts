import type { Request } from "express";
import { describe, expect, it } from "vitest";

// Subject
import summarizeRequest from "../summarizeRequest.helper.js";

//
//
// Run tests
//

describe("Summarize Request Helper", () => {
  it("Is a function ^^", () => {
    expect(typeof summarizeRequest).toBe("function");
  });
  it("Returns an object with the expected properties", () => {
    const req = {
      baseUrl: "MOCK_BASE_URL",
      body: "MOCK_BODY",
      headers: { "content-type": "application/json" },
      method: "MOCK_METHOD",
      query: "MOCK_QUERY",
      url: "MOCK_URL",
    } as unknown as Request;
    const result = summarizeRequest(req);
    expect(result).toEqual({
      baseUrl: "MOCK_BASE_URL",
      body: "MOCK_BODY",
      headers: { "content-type": "application/json" },
      method: "MOCK_METHOD",
      query: "MOCK_QUERY",
      url: "MOCK_URL",
    });
  });
  it("Redacts authorization header", () => {
    const req = {
      baseUrl: "",
      body: null,
      headers: {
        authorization: "Bearer eyJhbGciOi...",
        "content-type": "application/json",
      },
      method: "GET",
      query: {},
      url: "/",
    } as unknown as Request;
    const result = summarizeRequest(req);
    expect(result.headers.authorization).toBe("[REDACTED]");
    expect(result.headers["content-type"]).toBe("application/json");
  });
  it("Redacts cookie and set-cookie headers", () => {
    const req = {
      baseUrl: "",
      body: null,
      headers: {
        cookie: "session=abc123",
        "set-cookie": "session=abc123; Path=/",
        host: "example.com",
      },
      method: "GET",
      query: {},
      url: "/",
    } as unknown as Request;
    const result = summarizeRequest(req);
    expect(result.headers.cookie).toBe("[REDACTED]");
    expect(result.headers["set-cookie"]).toBe("[REDACTED]");
    expect(result.headers.host).toBe("example.com");
  });
  it("Does not mutate original headers", () => {
    const headers = { authorization: "Bearer token123" };
    const req = {
      baseUrl: "",
      body: null,
      headers,
      method: "GET",
      query: {},
      url: "/",
    } as unknown as Request;
    summarizeRequest(req);
    expect(headers.authorization).toBe("Bearer token123");
  });
  it("Works when the request body is a buffer", () => {
    const buffer = Buffer.from("MOCK_BODY");
    // Run some baseline tests on the buffer
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer).toEqual(Buffer.from("MOCK_BODY"));

    // Set up the request
    const req = {
      baseUrl: "MOCK_BASE_URL",
      body: buffer,
      headers: { host: "localhost" },
      method: "MOCK_METHOD",
      query: "MOCK_QUERY",
      url: "MOCK_URL",
    } as unknown as Request;
    const result = summarizeRequest(req);
    expect(result).toEqual({
      baseUrl: "MOCK_BASE_URL",
      body: "MOCK_BODY",
      headers: { host: "localhost" },
      method: "MOCK_METHOD",
      query: "MOCK_QUERY",
      url: "MOCK_URL",
    });
    // Make sure the buffer is unmodified
    expect(buffer).toEqual(Buffer.from("MOCK_BODY"));
  });
});
