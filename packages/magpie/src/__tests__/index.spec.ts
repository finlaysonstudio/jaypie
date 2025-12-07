import { describe, expect, it } from "vitest";
import { dotenv } from "..";

describe("magpie/index", () => {
  describe("Base Cases", () => {
    it("exports dotenv", () => {
      expect(dotenv).toBeDefined();
    });

    it("dotenv has config function", () => {
      expect(typeof dotenv.config).toBe("function");
    });

    it("dotenv has parse function", () => {
      expect(typeof dotenv.parse).toBe("function");
    });
  });

  describe("Happy Paths", () => {
    it("dotenv.parse parses env string", () => {
      const result = dotenv.parse("FOO=bar\nBAZ=qux");
      expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
    });
  });
});
