import { describe, expect, it } from "vitest";
import { JaypieError } from "../baseErrors";
import { errorFromStatusCode } from "../errorFromStatusCode";

describe("errorFromStatusCode", () => {
  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(typeof errorFromStatusCode).toBe("function");
    });

    it("Works", () => {
      expect(errorFromStatusCode(500)).toBeDefined();
    });
  });

  describe("Happy Paths", () => {
    it("returns an HttpError with the correct status code", () => {
      const error = errorFromStatusCode(404);
      expect(error).toBeInstanceOf(JaypieError);
      expect(error.status).toBe(404);
    });

    it("uses the provided message", () => {
      const message = "Custom error message";
      const error = errorFromStatusCode(400, message);
      expect(error.message).toBe(message);
    });
  });

  describe("Features", () => {
    it("defaults to 500 for unknown status codes", () => {
      const error = errorFromStatusCode(999);
      expect(error.status).toBe(500);
    });

    it("provides default messages for known status codes", () => {
      expect(errorFromStatusCode(400).title).toBe("Bad Request");
      expect(errorFromStatusCode(401).title).toBe("Service Unauthorized");
      expect(errorFromStatusCode(403).title).toBe("Forbidden");
      expect(errorFromStatusCode(404).title).toBe("Not Found");
      expect(errorFromStatusCode(500).title).toBe("Internal Application Error");
      expect(errorFromStatusCode(503).title).toBe("Service Unavailable");
    });
  });
});
