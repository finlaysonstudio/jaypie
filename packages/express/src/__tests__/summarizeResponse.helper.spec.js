import { describe, expect, it } from "vitest";

// Subject
import summarizeResponse from "../summarizeResponse.helper.js";

//
//
// Run tests
//

describe("Summarize Response Helper", () => {
  it("Is a function ^^", () => {
    expect(typeof summarizeResponse).toBe("function");
  });
  it("Returns an object with the expected properties", () => {
    const res = {
      getHeaders: () => "MOCK_HEADERS",
      statusCode: "MOCK_STATUS_CODE",
      statusMessage: "MOCK_STATUS_MESSAGE",
    };
    const result = summarizeResponse(res);
    expect(result).toEqual({
      headers: "MOCK_HEADERS",
      statusCode: "MOCK_STATUS_CODE",
      statusMessage: "MOCK_STATUS_MESSAGE",
    });
  });
  it("Includes extras", () => {
    const res = {
      getHeaders: () => "MOCK_HEADERS",
      statusCode: "MOCK_STATUS_CODE",
      statusMessage: "MOCK_STATUS_MESSAGE",
    };
    const extras = {
      extra1: "MOCK_EXTRA_1",
      extra2: "MOCK_EXTRA_2",
    };
    const result = summarizeResponse(res, extras);
    expect(result).toEqual({
      headers: "MOCK_HEADERS",
      statusCode: "MOCK_STATUS_CODE",
      statusMessage: "MOCK_STATUS_MESSAGE",
      extra1: "MOCK_EXTRA_1",
      extra2: "MOCK_EXTRA_2",
    });
  });
});
