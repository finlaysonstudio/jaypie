import { describe, expect, it } from "vitest";
import { uuid } from "../src";

describe("uuid", () => {
  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(typeof uuid).toBe("function");
    });

    it("works", () => {
      expect(uuid()).toBeDefined();
    });
  });

  describe("Happy Paths", () => {
    it("returns a valid UUID v4 string", () => {
      const result = uuid();
      expect(typeof result).toBe("string");
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });
  });
});
