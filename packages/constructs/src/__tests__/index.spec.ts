import { describe, expect, it } from "vitest";
import { JaypieEnvSecret } from "..";

describe("constructs/index", () => {
  describe("Base Cases", () => {
    it("exports JaypieEnvSecret", () => {
      expect(typeof JaypieEnvSecret).toBe("function");
    });
  });
});
