import { describe, expect, it } from "vitest";

import * as dynamodb from "../index.js";

describe("@jaypie/dynamodb exports", () => {
  describe("Constants", () => {
    it("exports APEX", () => {
      expect(dynamodb.APEX).toBeDefined();
      expect(dynamodb.APEX).toBe("@");
    });

    it("exports SEPARATOR", () => {
      expect(dynamodb.SEPARATOR).toBeDefined();
      expect(dynamodb.SEPARATOR).toBe("#");
    });

    it("exports INDEX_ALIAS", () => {
      expect(dynamodb.INDEX_ALIAS).toBeDefined();
      expect(dynamodb.INDEX_ALIAS).toBe("indexAlias");
    });

    it("exports INDEX_CLASS", () => {
      expect(dynamodb.INDEX_CLASS).toBeDefined();
      expect(dynamodb.INDEX_CLASS).toBe("indexClass");
    });

    it("exports INDEX_OU", () => {
      expect(dynamodb.INDEX_OU).toBeDefined();
      expect(dynamodb.INDEX_OU).toBe("indexOu");
    });

    it("exports INDEX_TYPE", () => {
      expect(dynamodb.INDEX_TYPE).toBeDefined();
      expect(dynamodb.INDEX_TYPE).toBe("indexType");
    });

    it("exports INDEX_XID", () => {
      expect(dynamodb.INDEX_XID).toBeDefined();
      expect(dynamodb.INDEX_XID).toBe("indexXid");
    });
  });

  describe("Key Builder Functions", () => {
    it("exports buildIndexAlias", () => {
      expect(dynamodb.buildIndexAlias).toBeFunction();
    });

    it("exports buildIndexClass", () => {
      expect(dynamodb.buildIndexClass).toBeFunction();
    });

    it("exports buildIndexOu", () => {
      expect(dynamodb.buildIndexOu).toBeFunction();
    });

    it("exports buildIndexType", () => {
      expect(dynamodb.buildIndexType).toBeFunction();
    });

    it("exports buildIndexXid", () => {
      expect(dynamodb.buildIndexXid).toBeFunction();
    });

    it("exports calculateOu", () => {
      expect(dynamodb.calculateOu).toBeFunction();
    });

    it("exports populateIndexKeys", () => {
      expect(dynamodb.populateIndexKeys).toBeFunction();
    });
  });

  describe("Client Functions", () => {
    it("exports initClient", () => {
      expect(dynamodb.initClient).toBeFunction();
    });

    it("exports getDocClient", () => {
      expect(dynamodb.getDocClient).toBeFunction();
    });

    it("exports getTableName", () => {
      expect(dynamodb.getTableName).toBeFunction();
    });

    it("exports isInitialized", () => {
      expect(dynamodb.isInitialized).toBeFunction();
    });

    it("exports resetClient", () => {
      expect(dynamodb.resetClient).toBeFunction();
    });
  });

  describe("Query Functions", () => {
    it("exports queryByOu", () => {
      expect(dynamodb.queryByOu).toBeFunction();
    });

    it("exports queryByAlias", () => {
      expect(dynamodb.queryByAlias).toBeFunction();
    });

    it("exports queryByClass", () => {
      expect(dynamodb.queryByClass).toBeFunction();
    });

    it("exports queryByType", () => {
      expect(dynamodb.queryByType).toBeFunction();
    });

    it("exports queryByXid", () => {
      expect(dynamodb.queryByXid).toBeFunction();
    });
  });
});
