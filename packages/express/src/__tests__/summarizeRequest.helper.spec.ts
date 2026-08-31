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
  it("Redacts authorization header with sk token", () => {
    const req = {
      baseUrl: "",
      body: null,
      headers: {
        authorization: "Bearer sk-proj-abc1234",
        "content-type": "application/json",
      },
      method: "GET",
      query: {},
      url: "/",
    } as unknown as Request;
    const result = summarizeRequest(req);
    expect(result.headers.authorization).toBe("sk_1234");
    expect(result.headers["content-type"]).toBe("application/json");
  });
  it("Redacts authorization header with non-sk token", () => {
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
    expect(result.headers.authorization).toMatch(/^md5_[a-f0-9]{4}$/);
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
    expect(result.headers.cookie).toMatch(/^md5_[a-f0-9]{4}$/);
    expect(result.headers["set-cookie"]).toMatch(/^md5_[a-f0-9]{4}$/);
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
  describe("Options", () => {
    const mockRequest = (
      headers: Record<string, string>,
      body: unknown = "MOCK_BODY",
    ) =>
      ({
        baseUrl: "",
        body,
        headers,
        method: "POST",
        query: {},
        url: "/",
      }) as unknown as Request;

    it("Redacts headers named in sensitiveHeaders", () => {
      const result = summarizeRequest(
        mockRequest({
          "x-hub-signature-256": "sha256=deadbeef",
          "x-request-id": "MOCK_REQUEST_ID",
        }),
        { sensitiveHeaders: ["x-hub-signature-256"] },
      );
      expect(result.headers["x-hub-signature-256"]).not.toBe("sha256=deadbeef");
      expect(result.headers["x-request-id"]).toBe("MOCK_REQUEST_ID");
    });

    it("Matches sensitiveHeaders without regard to case", () => {
      const result = summarizeRequest(
        mockRequest({ "x-slack-signature": "v0=abcdef" }),
        { sensitiveHeaders: ["X-Slack-Signature"] },
      );
      expect(result.headers["x-slack-signature"]).not.toBe("v0=abcdef");
    });

    it("Adds to the defaults rather than replacing them", () => {
      const result = summarizeRequest(
        mockRequest({
          authorization: "Bearer sk-proj-abc1234",
          "x-hub-signature-256": "sha256=deadbeef",
        }),
        { sensitiveHeaders: ["x-hub-signature-256"] },
      );
      expect(result.headers.authorization).toBe("sk_1234");
      expect(result.headers["x-hub-signature-256"]).not.toBe("sha256=deadbeef");
    });

    it("Omits the body when logBody is false", () => {
      const result = summarizeRequest(mockRequest({ host: "localhost" }), {
        logBody: false,
      });
      expect(result).not.toHaveProperty("body");
      expect(result.headers.host).toBe("localhost");
    });

    it("Includes the body when logBody is true", () => {
      const result = summarizeRequest(mockRequest({ host: "localhost" }), {
        logBody: true,
      });
      expect(result.body).toBe("MOCK_BODY");
    });

    it("Does not read the body when logBody is false", () => {
      const buffer = Buffer.from("MOCK_BODY");
      const result = summarizeRequest(mockRequest({}, buffer), {
        logBody: false,
      });
      expect(result).not.toHaveProperty("body");
      expect(buffer).toEqual(Buffer.from("MOCK_BODY"));
    });
  });
});
