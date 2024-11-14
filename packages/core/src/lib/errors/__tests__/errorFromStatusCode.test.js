import { expect, describe, it } from "vitest";
import { errorFromStatusCode } from "../errorFromStatusCode.js";

describe("errorFromStatusCode", () => {
  it("should create errors with correct properties for known status codes", () => {
    const testCases = [
      { code: 400, name: "BadRequestError" },
      { code: 401, name: "UnauthorizedError" },
      { code: 403, name: "ForbiddenError" },
      { code: 404, name: "NotFoundError" },
      { code: 405, name: "MethodNotAllowedError" },
      { code: 410, name: "GoneError" },
      { code: 418, name: "TeapotError" },
      { code: 500, name: "InternalError" },
      { code: 502, name: "BadGatewayError" },
      { code: 503, name: "UnavailableError" },
      { code: 504, name: "GatewayTimeoutError" },
    ];

    testCases.forEach(({ code }) => {
      const error = errorFromStatusCode(code);
      expect(error.isProjectError).toBe(true);
      expect(typeof error.title).toBe("string");
      expect(typeof error.detail).toBe("string");
      expect(typeof error.status).toBe("number");
      expect(error.status).toBe(code);
      expect(error.name).toBe("ProjectError");
    });
  });

  it("should use custom message in detail when provided", () => {
    const customMessage = "Custom error message";
    const error = errorFromStatusCode(404, customMessage);
    expect(error.detail).toBe(customMessage);
  });

  it("should fallback to InternalError for unknown status codes", () => {
    const unknownCodes = [0, 100, 300, 999];

    unknownCodes.forEach((code) => {
      const error = errorFromStatusCode(code);
      expect(error.isProjectError).toBe(true);
      expect(error.name).toBe("ProjectError");
      expect(typeof error.title).toBe("string");
      expect(typeof error.detail).toBe("string");
      expect(typeof error.status).toBe("number");
      expect(error.status).toBe(500);
    });
  });
});
