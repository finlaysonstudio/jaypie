import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as clientModule from "../client.js";
import {
  queryByAlias,
  queryByCategory,
  queryByScope,
  queryByType,
  queryByXid,
} from "../queries.js";

// Mock the client module
const mockSend = vi.fn();

vi.spyOn(clientModule, "getDocClient").mockReturnValue({
  send: mockSend,
} as unknown as ReturnType<typeof clientModule.getDocClient>);
vi.spyOn(clientModule, "getTableName").mockReturnValue("test-table");

describe("Query Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({ Items: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("queryByScope", () => {
    it("is a function", () => {
      expect(queryByScope).toBeFunction();
    });

    it("returns QueryResult with items array", async () => {
      const result = await queryByScope({ model: "record", scope: "@" });
      expect(result).toHaveProperty("items");
      expect(result.items).toBeArray();
    });

    it("calls docClient.send with QueryCommand", async () => {
      await queryByScope({ model: "record", scope: "@" });
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("uses indexScope GSI", async () => {
      await queryByScope({ model: "record", scope: "@" });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.IndexName).toBe("indexScope");
    });

    it("builds correct key value", async () => {
      await queryByScope({ model: "record", scope: "@" });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "@#record",
      );
    });

    it("defaults to descending order (most recent first)", async () => {
      await queryByScope({ model: "record", scope: "@" });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ScanIndexForward).toBe(false);
    });

    it("supports ascending order option", async () => {
      await queryByScope({ ascending: true, model: "record", scope: "@" });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ScanIndexForward).toBe(true);
    });

    it("does not use FilterExpression (exclusion via index suffix)", async () => {
      await queryByScope({ model: "record", scope: "@" });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.FilterExpression).toBeUndefined();
    });

    it("supports limit option", async () => {
      await queryByScope({ limit: 10, model: "record", scope: "@" });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.Limit).toBe(10);
    });

    it("supports pagination with startKey", async () => {
      const startKey = { id: "some-id", model: "record" };
      await queryByScope({ model: "record", scope: "@", startKey });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ExclusiveStartKey).toEqual(startKey);
    });

    it("returns lastEvaluatedKey for pagination", async () => {
      const lastKey = { id: "last-id", model: "record" };
      mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: lastKey });
      const result = await queryByScope({ model: "record", scope: "@" });
      expect(result.lastEvaluatedKey).toEqual(lastKey);
    });

    it("works with hierarchical scope", async () => {
      await queryByScope({ model: "message", scope: "chat#abc-123" });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "chat#abc-123#message",
      );
    });
  });

  describe("queryByAlias", () => {
    it("is a function", () => {
      expect(queryByAlias).toBeFunction();
    });

    it("returns null when no items found", async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });
      const result = await queryByAlias({
        alias: "my-alias",
        model: "record",
        scope: "@",
      });
      expect(result).toBeNull();
    });

    it("returns the first item when found", async () => {
      const mockItem = { id: "123", model: "record", name: "Test" };
      mockSend.mockResolvedValueOnce({ Items: [mockItem] });
      const result = await queryByAlias({
        alias: "my-alias",
        model: "record",
        scope: "@",
      });
      expect(result).toEqual(mockItem);
    });

    it("uses indexAlias GSI", async () => {
      await queryByAlias({ alias: "my-alias", model: "record", scope: "@" });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.IndexName).toBe("indexAlias");
    });

    it("builds correct key value", async () => {
      await queryByAlias({ alias: "my-alias", model: "record", scope: "@" });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "@#record#my-alias",
      );
    });

    it("limits to 1 result", async () => {
      await queryByAlias({ alias: "my-alias", model: "record", scope: "@" });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.Limit).toBe(1);
    });
  });

  describe("queryByCategory", () => {
    it("is a function", () => {
      expect(queryByCategory).toBeFunction();
    });

    it("returns QueryResult with items array", async () => {
      const result = await queryByCategory({
        category: "memory",
        model: "record",
        scope: "@",
      });
      expect(result).toHaveProperty("items");
      expect(result.items).toBeArray();
    });

    it("uses indexCategory GSI", async () => {
      await queryByCategory({
        category: "memory",
        model: "record",
        scope: "@",
      });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.IndexName).toBe("indexCategory");
    });

    it("builds correct key value", async () => {
      await queryByCategory({
        category: "memory",
        model: "record",
        scope: "@",
      });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "@#record#memory",
      );
    });

    it("supports query options", async () => {
      await queryByCategory({
        ascending: true,
        category: "memory",
        limit: 5,
        model: "record",
        scope: "@",
      });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ScanIndexForward).toBe(true);
      expect(command.input.Limit).toBe(5);
    });
  });

  describe("queryByType", () => {
    it("is a function", () => {
      expect(queryByType).toBeFunction();
    });

    it("returns QueryResult with items array", async () => {
      const result = await queryByType({
        model: "record",
        scope: "@",
        type: "note",
      });
      expect(result).toHaveProperty("items");
      expect(result.items).toBeArray();
    });

    it("uses indexType GSI", async () => {
      await queryByType({ model: "record", scope: "@", type: "note" });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.IndexName).toBe("indexType");
    });

    it("builds correct key value", async () => {
      await queryByType({ model: "record", scope: "@", type: "note" });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "@#record#note",
      );
    });

    it("supports query options", async () => {
      await queryByType({
        ascending: true,
        limit: 5,
        model: "record",
        scope: "@",
        type: "note",
      });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ScanIndexForward).toBe(true);
      expect(command.input.Limit).toBe(5);
    });
  });

  describe("queryByXid", () => {
    it("is a function", () => {
      expect(queryByXid).toBeFunction();
    });

    it("returns null when no items found", async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });
      const result = await queryByXid({
        model: "record",
        scope: "@",
        xid: "ext-123",
      });
      expect(result).toBeNull();
    });

    it("returns the first item when found", async () => {
      const mockItem = { id: "123", model: "record", xid: "ext-123" };
      mockSend.mockResolvedValueOnce({ Items: [mockItem] });
      const result = await queryByXid({
        model: "record",
        scope: "@",
        xid: "ext-123",
      });
      expect(result).toEqual(mockItem);
    });

    it("uses indexXid GSI", async () => {
      await queryByXid({ model: "record", scope: "@", xid: "ext-123" });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.IndexName).toBe("indexXid");
    });

    it("builds correct key value", async () => {
      await queryByXid({ model: "record", scope: "@", xid: "ext-123" });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "@#record#ext-123",
      );
    });

    it("limits to 1 result", async () => {
      await queryByXid({ model: "record", scope: "@", xid: "ext-123" });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.Limit).toBe(1);
    });
  });

  describe("Soft State Query Options", () => {
    describe("deleted flag", () => {
      it("queryByScope appends #deleted suffix when deleted: true", async () => {
        await queryByScope({ deleted: true, model: "record", scope: "@" });
        const command = mockSend.mock.calls[0][0];
        expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
          "@#record#deleted",
        );
      });

      it("queryByCategory appends #deleted suffix when deleted: true", async () => {
        await queryByCategory({
          category: "memory",
          deleted: true,
          model: "record",
          scope: "@",
        });
        const command = mockSend.mock.calls[0][0];
        expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
          "@#record#memory#deleted",
        );
      });

      it("queryByType appends #deleted suffix when deleted: true", async () => {
        await queryByType({
          deleted: true,
          model: "record",
          scope: "@",
          type: "note",
        });
        const command = mockSend.mock.calls[0][0];
        expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
          "@#record#note#deleted",
        );
      });

      it("queryByAlias appends #deleted suffix when deleted: true", async () => {
        await queryByAlias({
          alias: "my-alias",
          deleted: true,
          model: "record",
          scope: "@",
        });
        const command = mockSend.mock.calls[0][0];
        expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
          "@#record#my-alias#deleted",
        );
      });

      it("queryByXid appends #deleted suffix when deleted: true", async () => {
        await queryByXid({
          deleted: true,
          model: "record",
          scope: "@",
          xid: "ext-123",
        });
        const command = mockSend.mock.calls[0][0];
        expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
          "@#record#ext-123#deleted",
        );
      });
    });

    describe("archived flag", () => {
      it("queryByScope appends #archived suffix when archived: true", async () => {
        await queryByScope({ archived: true, model: "record", scope: "@" });
        const command = mockSend.mock.calls[0][0];
        expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
          "@#record#archived",
        );
      });

      it("queryByCategory appends #archived suffix when archived: true", async () => {
        await queryByCategory({
          archived: true,
          category: "memory",
          model: "record",
          scope: "@",
        });
        const command = mockSend.mock.calls[0][0];
        expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
          "@#record#memory#archived",
        );
      });

      it("queryByType appends #archived suffix when archived: true", async () => {
        await queryByType({
          archived: true,
          model: "record",
          scope: "@",
          type: "note",
        });
        const command = mockSend.mock.calls[0][0];
        expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
          "@#record#note#archived",
        );
      });

      it("queryByAlias appends #archived suffix when archived: true", async () => {
        await queryByAlias({
          alias: "my-alias",
          archived: true,
          model: "record",
          scope: "@",
        });
        const command = mockSend.mock.calls[0][0];
        expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
          "@#record#my-alias#archived",
        );
      });

      it("queryByXid appends #archived suffix when archived: true", async () => {
        await queryByXid({
          archived: true,
          model: "record",
          scope: "@",
          xid: "ext-123",
        });
        const command = mockSend.mock.calls[0][0];
        expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
          "@#record#ext-123#archived",
        );
      });
    });

    describe("combined archived and deleted", () => {
      it("queryByScope appends #archived#deleted suffix when both are true", async () => {
        await queryByScope({
          archived: true,
          deleted: true,
          model: "record",
          scope: "@",
        });
        const command = mockSend.mock.calls[0][0];
        expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
          "@#record#archived#deleted",
        );
      });

      it("queryByCategory appends #archived#deleted suffix when both are true", async () => {
        await queryByCategory({
          archived: true,
          category: "memory",
          deleted: true,
          model: "record",
          scope: "@",
        });
        const command = mockSend.mock.calls[0][0];
        expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
          "@#record#memory#archived#deleted",
        );
      });

      it("queryByType appends #archived#deleted suffix when both are true", async () => {
        await queryByType({
          archived: true,
          deleted: true,
          model: "record",
          scope: "@",
          type: "note",
        });
        const command = mockSend.mock.calls[0][0];
        expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
          "@#record#note#archived#deleted",
        );
      });

      it("queryByAlias appends #archived#deleted suffix when both are true", async () => {
        await queryByAlias({
          alias: "my-alias",
          archived: true,
          deleted: true,
          model: "record",
          scope: "@",
        });
        const command = mockSend.mock.calls[0][0];
        expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
          "@#record#my-alias#archived#deleted",
        );
      });

      it("queryByXid appends #archived#deleted suffix when both are true", async () => {
        await queryByXid({
          archived: true,
          deleted: true,
          model: "record",
          scope: "@",
          xid: "ext-123",
        });
        const command = mockSend.mock.calls[0][0];
        expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
          "@#record#ext-123#archived#deleted",
        );
      });
    });
  });
});
