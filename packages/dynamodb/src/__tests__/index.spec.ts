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

    it("exports INDEX_SCOPE", () => {
      expect(dynamodb.INDEX_SCOPE).toBeDefined();
      expect(dynamodb.INDEX_SCOPE).toBe("indexScope");
    });

    it("exports INDEX_TYPE", () => {
      expect(dynamodb.INDEX_TYPE).toBeDefined();
      expect(dynamodb.INDEX_TYPE).toBe("indexType");
    });

    it("exports INDEX_XID", () => {
      expect(dynamodb.INDEX_XID).toBeDefined();
      expect(dynamodb.INDEX_XID).toBe("indexXid");
    });

    it("exports ARCHIVED_SUFFIX", () => {
      expect(dynamodb.ARCHIVED_SUFFIX).toBeDefined();
      expect(dynamodb.ARCHIVED_SUFFIX).toBe("#archived");
    });

    it("exports DELETED_SUFFIX", () => {
      expect(dynamodb.DELETED_SUFFIX).toBeDefined();
      expect(dynamodb.DELETED_SUFFIX).toBe("#deleted");
    });
  });

  describe("Key Builder Functions", () => {
    it("exports buildIndexAlias", () => {
      expect(dynamodb.buildIndexAlias).toBeFunction();
    });

    it("exports buildIndexClass", () => {
      expect(dynamodb.buildIndexClass).toBeFunction();
    });

    it("exports buildIndexScope", () => {
      expect(dynamodb.buildIndexScope).toBeFunction();
    });

    it("exports buildIndexType", () => {
      expect(dynamodb.buildIndexType).toBeFunction();
    });

    it("exports buildIndexXid", () => {
      expect(dynamodb.buildIndexXid).toBeFunction();
    });

    it("exports calculateScope", () => {
      expect(dynamodb.calculateScope).toBeFunction();
    });

    it("exports indexEntity", () => {
      expect(dynamodb.indexEntity).toBeFunction();
    });
  });

  describe("Entity Operations", () => {
    it("exports getEntity", () => {
      expect(dynamodb.getEntity).toBeFunction();
    });

    it("exports putEntity", () => {
      expect(dynamodb.putEntity).toBeFunction();
    });

    it("exports updateEntity", () => {
      expect(dynamodb.updateEntity).toBeFunction();
    });

    it("exports deleteEntity", () => {
      expect(dynamodb.deleteEntity).toBeFunction();
    });

    it("exports archiveEntity", () => {
      expect(dynamodb.archiveEntity).toBeFunction();
    });

    it("exports destroyEntity", () => {
      expect(dynamodb.destroyEntity).toBeFunction();
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
    it("exports queryByScope", () => {
      expect(dynamodb.queryByScope).toBeFunction();
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
