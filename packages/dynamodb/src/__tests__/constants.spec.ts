import { describe, expect, it } from "vitest";

import {
  APEX,
  ARCHIVED_SUFFIX,
  DELETED_SUFFIX,
  SEPARATOR,
} from "../constants.js";

describe("Constants", () => {
  describe("APEX", () => {
    it("is '@'", () => {
      expect(APEX).toBe("@");
    });
  });

  describe("SEPARATOR", () => {
    it("is '#'", () => {
      expect(SEPARATOR).toBe("#");
    });
  });

  describe("Index suffixes", () => {
    it("ARCHIVED_SUFFIX is '#archived'", () => {
      expect(ARCHIVED_SUFFIX).toBe("#archived");
    });

    it("DELETED_SUFFIX is '#deleted'", () => {
      expect(DELETED_SUFFIX).toBe("#deleted");
    });
  });
});
