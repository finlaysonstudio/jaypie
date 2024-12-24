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
});
