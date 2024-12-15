import { describe, expect, it } from "vitest";
import { VERSION } from "../src";

describe("webkit", () => {
  describe("Base Cases", () => {
    it("exports VERSION", () => {
      expect(VERSION).toBe("0.1.0");
    });
  });
});
