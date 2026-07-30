import { describe, expect, it } from "vitest";
import { JaypieError } from "../baseErrors";
import { jaypieErrorFromStatus } from "../jaypieErrorFromStatus";

describe("errorFromStatusCode", () => {
  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(typeof jaypieErrorFromStatus).toBe("function");
    });

    it("Works", () => {
      expect(jaypieErrorFromStatus(500)).toBeDefined();
    });
  });

  describe("Happy Paths", () => {
    it("returns an HttpError with the correct status code", () => {
      const error = jaypieErrorFromStatus(404);
      expect(error).toBeInstanceOf(JaypieError);
      expect(error.status).toBe(404);
    });

    it("uses the provided message", () => {
      const message = "Custom error message";
      const error = jaypieErrorFromStatus(400, message);
      expect(error.message).toBe(message);
    });
  });

  describe("Features", () => {
    it("defaults to 500 for unknown status codes", () => {
      const error = jaypieErrorFromStatus(999);
      expect(error.status).toBe(500);
    });

    it("provides default messages for known status codes", () => {
      expect(jaypieErrorFromStatus(400).title).toBe("Bad Request");
      expect(jaypieErrorFromStatus(401).title).toBe("Service Unauthorized");
      expect(jaypieErrorFromStatus(403).title).toBe("Forbidden");
      expect(jaypieErrorFromStatus(404).title).toBe("Not Found");
      expect(jaypieErrorFromStatus(405).title).toBe("Method Not Allowed");
      expect(jaypieErrorFromStatus(409).title).toBe("Conflict");
      expect(jaypieErrorFromStatus(429).title).toBe("Too Many Requests");
      expect(jaypieErrorFromStatus(500).title).toBe(
        "Internal Application Error",
      );
      expect(jaypieErrorFromStatus(503).title).toBe("Service Unavailable");
    });

    it("preserves the status of every error class it maps", () => {
      for (const status of [
        400, 401, 403, 404, 405, 409, 410, 418, 429, 500, 502, 503, 504,
      ]) {
        expect(jaypieErrorFromStatus(status).status).toBe(status);
      }
    });

    it("falls to BadRequestError for an unmapped 4xx", () => {
      // An unmapped 4xx described as an InternalError would blame the
      // application for a caller error
      for (const status of [402, 406, 412, 415, 422, 451, 499]) {
        const error = jaypieErrorFromStatus(status);
        expect(error.status).toBe(400);
        expect(error.title).toBe("Bad Request");
        expect(error.detail).toBe("The request was not properly formatted");
      }
    });

    it("falls to InternalError outside 4xx", () => {
      for (const status of [200, 302, 501, 505, 999]) {
        expect(jaypieErrorFromStatus(status).status).toBe(500);
      }
    });
  });
});
