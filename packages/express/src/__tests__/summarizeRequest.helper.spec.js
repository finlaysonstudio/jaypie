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
      headers: "MOCK_HEADERS",
      method: "MOCK_METHOD",
      query: "MOCK_QUERY",
      url: "MOCK_URL",
    };
    const result = summarizeRequest(req);
    expect(result).toEqual({
      baseUrl: "MOCK_BASE_URL",
      body: "MOCK_BODY",
      headers: "MOCK_HEADERS",
      method: "MOCK_METHOD",
      query: "MOCK_QUERY",
      url: "MOCK_URL",
    });
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
      headers: "MOCK_HEADERS",
      method: "MOCK_METHOD",
      query: "MOCK_QUERY",
      url: "MOCK_URL",
    };
    const result = summarizeRequest(req);
    expect(result).toEqual({
      baseUrl: "MOCK_BASE_URL",
      body: "MOCK_BODY",
      headers: "MOCK_HEADERS",
      method: "MOCK_METHOD",
      query: "MOCK_QUERY",
      url: "MOCK_URL",
    });
    // Make sure the buffer is unmodified
    expect(buffer).toEqual(Buffer.from("MOCK_BODY"));
  });
});
