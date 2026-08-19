import { describe, expect, it } from "vitest";

// Subject
import matchers from "../matchers.module";

//
//
// Constants
//

class Alpha extends Error {}
class Beta extends Error {}

//
//
// Run tests
//

describe("Built-in toThrowError", () => {
  describe("Base Cases", () => {
    it("is not overridden by the Jaypie matchers", () => {
      expect(Object.keys(matchers)).not.toContain("toThrowError");
    });
  });
  describe("Observability", () => {
    it("fails synchronously when nothing throws", () => {
      expect(() => expect(() => 1).toThrowError(/nope/)).toThrow();
    });
    it("fails when the thrown error is the wrong class", () => {
      expect(() =>
        expect(() => {
          throw new Alpha("a");
        }).toThrowError(Beta),
      ).toThrow();
    });
    it("passes when the thrown error matches", () => {
      expect(() => {
        throw new Alpha("a");
      }).toThrowError(Alpha);
    });
  });
  describe("Features", () => {
    it("rejects with the expected class through rejects", async () => {
      await expect(Promise.reject(new Alpha("a"))).rejects.toThrowError(Alpha);
    });
  });
});
