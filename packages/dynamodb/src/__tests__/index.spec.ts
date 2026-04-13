import { describe, expect, it } from "vitest";

import * as dynamodb from "../index.js";

describe("@jaypie/dynamodb exports", () => {
  describe("Constants", () => {
    it("exports APEX", () => {
      expect(dynamodb.APEX).toBe("@");
    });

    it("exports SEPARATOR", () => {
      expect(dynamodb.SEPARATOR).toBe("#");
    });

    it("exports ARCHIVED_SUFFIX", () => {
      expect(dynamodb.ARCHIVED_SUFFIX).toBe("#archived");
    });

    it("exports DELETED_SUFFIX", () => {
      expect(dynamodb.DELETED_SUFFIX).toBe("#deleted");
    });
  });

  describe("Key Builder Functions", () => {
    it("exports buildCompositeKey", () => {
      expect(dynamodb.buildCompositeKey).toBeFunction();
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

    it("exports createEntity", () => {
      expect(dynamodb.createEntity).toBeFunction();
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

    it("exports queryByCategory", () => {
      expect(dynamodb.queryByCategory).toBeFunction();
    });

    it("exports queryByType", () => {
      expect(dynamodb.queryByType).toBeFunction();
    });

    it("exports queryByXid", () => {
      expect(dynamodb.queryByXid).toBeFunction();
    });
  });
});
