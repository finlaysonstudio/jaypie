import { describe, expect, it } from "vitest";
import { uuid } from "../src";

describe("webkit", () => {
  describe("Base Cases", () => {
    it("exports uuid function", () => {
      expect(typeof uuid).toBe("function");
    });
  });
});
