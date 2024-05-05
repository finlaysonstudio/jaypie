import { describe, expect, it } from "vitest";

// Subject
import { getSecret, JAYPIE, PROJECT, submitMetric, uuid } from "../index.js";

//
//
// Run tests
//

describe("Index", () => {
  describe("@jaypie/core", () => {
    it("Exports constants", () => {
      expect(JAYPIE).not.toBeUndefined();
      expect(PROJECT).not.toBeUndefined();
      expect(PROJECT.SPONSOR).not.toBeUndefined();
      expect(PROJECT.SPONSOR.JAYPIE).toBeString();
    });
    it("Exports functions", () => {
      expect(getSecret).toBeFunction();
      expect(submitMetric).toBeFunction();
      expect(uuid).toBeFunction();
    });
  });
});
