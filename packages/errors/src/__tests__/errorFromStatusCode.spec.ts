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
      expect(jaypieErrorFromStatus(500).title).toBe(
        "Internal Application Error",
      );
      expect(jaypieErrorFromStatus(503).title).toBe("Service Unavailable");
    });
  });
});
