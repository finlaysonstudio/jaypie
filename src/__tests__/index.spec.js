// eslint-disable-next-line no-unused-vars
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Subject
import { JAYPIE, PROJECT, uuid } from "../index.js";

//
//
// Mock constants
//

//
//
// Mock modules
//

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
});
afterEach(() => {
  process.env = DEFAULT_ENV;
});

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
      expect(uuid).toBeFunction();
    });
  });
});
