import { describe, expect, it } from "vitest";

import {
  APEX,
  ARCHIVED_SUFFIX,
  DELETED_SUFFIX,
  INDEX_ALIAS,
  INDEX_CLASS,
  INDEX_SCOPE,
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

    it("INDEX_SCOPE is 'indexScope'", () => {
      expect(INDEX_SCOPE).toBe("indexScope");
    });

    it("INDEX_TYPE is 'indexType'", () => {
      expect(INDEX_TYPE).toBe("indexType");
    });

    it("INDEX_XID is 'indexXid'", () => {
      expect(INDEX_XID).toBe("indexXid");
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
