import { describe, expect, it } from "vitest";
import { BadRequestError, jaypieErrorFromStatus, uuid } from "../src";

describe("webkit", () => {
  describe("Base Cases", () => {
    it("exports uuid function", () => {
      expect(typeof uuid).toBe("function");
    });

    it("exports errors from @jaypie/errors", () => {
      expect(BadRequestError).toBeDefined();
      const error = new BadRequestError("test");
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("test");
      expect(error.title).toBe("Bad Request");
      expect(error.isJaypieError).toBe(true);
      expect(error).toBeJaypieError();
    });

    it("exports jaypieErrorFromStatus function", () => {
      expect(jaypieErrorFromStatus).toBeFunction();
    });
  });

  describe("Happy Paths", () => {
    it("generates valid v4 UUIDs", () => {
      expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });
});
