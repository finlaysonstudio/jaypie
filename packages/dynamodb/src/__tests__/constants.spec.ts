import { describe, expect, it } from "vitest";

import {
  APEX,
  INDEX_ALIAS,
  INDEX_CLASS,
  INDEX_OU,
  INDEX_TYPE,
  INDEX_XID,
  SEPARATOR,
} from "../constants.js";

describe("Constants", () => {
  describe("APEX", () => {
    it("is a string", () => {
      expect(APEX).toBeString();
    });

    it("is '@'", () => {
      expect(APEX).toBe("@");
    });
  });

  describe("SEPARATOR", () => {
    it("is a string", () => {
      expect(SEPARATOR).toBeString();
    });

    it("is '#'", () => {
      expect(SEPARATOR).toBe("#");
    });
  });

  describe("GSI index names", () => {
    it("INDEX_ALIAS is 'indexAlias'", () => {
      expect(INDEX_ALIAS).toBe("indexAlias");
    });

    it("INDEX_CLASS is 'indexClass'", () => {
      expect(INDEX_CLASS).toBe("indexClass");
    });

    it("INDEX_OU is 'indexOu'", () => {
      expect(INDEX_OU).toBe("indexOu");
    });

    it("INDEX_TYPE is 'indexType'", () => {
      expect(INDEX_TYPE).toBe("indexType");
    });

    it("INDEX_XID is 'indexXid'", () => {
      expect(INDEX_XID).toBe("indexXid");
    });
  });
});
