import { describe, expect, it } from "vitest";
import { BadRequestError, errorFromStatusCode, isJaypieError } from "..";

describe("errors/index", () => {
  describe("Base Cases", () => {
    it("exports errorFromStatusCode function", () => {
      expect(typeof errorFromStatusCode).toBe("function");
    });

    it("exports isJaypieError function", () => {
      expect(typeof isJaypieError).toBe("function");
    });

    it("exports BadRequestError", () => {
      expect(BadRequestError).toBeDefined();
      expect(typeof BadRequestError).toBe("function");
    });
  });

  describe("Happy Paths", () => {
    it("creates a BadRequestError", () => {
      const error = new BadRequestError("test");
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("test");
      expect(error.status).toBe(400);
      expect(error.title).toBe("Bad Request");
      try {
        throw error;
      } catch (e) {
        expect(e).toBe(error);
      }
      expect.assertions(5);
    });
  });
});
