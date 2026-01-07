import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as clientModule from "../client.js";
import {
  queryByAlias,
  queryByClass,
  queryByOu,
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

  describe("queryByOu", () => {
    it("is a function", () => {
      expect(queryByOu).toBeFunction();
    });

    it("returns QueryResult with items array", async () => {
      const result = await queryByOu("@", "record");
      expect(result).toHaveProperty("items");
      expect(result.items).toBeArray();
    });

    it("calls docClient.send with QueryCommand", async () => {
      await queryByOu("@", "record");
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("uses indexOu GSI", async () => {
      await queryByOu("@", "record");
      const command = mockSend.mock.calls[0][0];
      expect(command.input.IndexName).toBe("indexOu");
    });

    it("builds correct key value", async () => {
      await queryByOu("@", "record");
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "@#record",
      );
    });

    it("defaults to descending order (most recent first)", async () => {
      await queryByOu("@", "record");
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ScanIndexForward).toBe(false);
    });

    it("supports ascending order option", async () => {
      await queryByOu("@", "record", { ascending: true });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ScanIndexForward).toBe(true);
    });

    it("filters out deleted items by default", async () => {
      await queryByOu("@", "record");
      const command = mockSend.mock.calls[0][0];
      expect(command.input.FilterExpression).toBe(
        "attribute_not_exists(deletedAt)",
      );
    });

    it("includes deleted items when specified", async () => {
      await queryByOu("@", "record", { includeDeleted: true });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.FilterExpression).toBeUndefined();
    });

    it("supports limit option", async () => {
      await queryByOu("@", "record", { limit: 10 });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.Limit).toBe(10);
    });

    it("supports pagination with startKey", async () => {
      const startKey = { model: "record", id: "some-id" };
      await queryByOu("@", "record", { startKey });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ExclusiveStartKey).toEqual(startKey);
    });

    it("returns lastEvaluatedKey for pagination", async () => {
      const lastKey = { model: "record", id: "last-id" };
      mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: lastKey });
      const result = await queryByOu("@", "record");
      expect(result.lastEvaluatedKey).toEqual(lastKey);
    });

    it("works with hierarchical ou", async () => {
      await queryByOu("chat#abc-123", "message");
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
      const result = await queryByAlias("@", "record", "my-alias");
      expect(result).toBeNull();
    });

    it("returns the first item when found", async () => {
      const mockItem = { id: "123", model: "record", name: "Test" };
      mockSend.mockResolvedValueOnce({ Items: [mockItem] });
      const result = await queryByAlias("@", "record", "my-alias");
      expect(result).toEqual(mockItem);
    });

    it("uses indexAlias GSI", async () => {
      await queryByAlias("@", "record", "my-alias");
      const command = mockSend.mock.calls[0][0];
      expect(command.input.IndexName).toBe("indexAlias");
    });

    it("builds correct key value", async () => {
      await queryByAlias("@", "record", "my-alias");
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "@#record#my-alias",
      );
    });

    it("limits to 1 result", async () => {
      await queryByAlias("@", "record", "my-alias");
      const command = mockSend.mock.calls[0][0];
      expect(command.input.Limit).toBe(1);
    });
  });

  describe("queryByClass", () => {
    it("is a function", () => {
      expect(queryByClass).toBeFunction();
    });

    it("returns QueryResult with items array", async () => {
      const result = await queryByClass("@", "record", "memory");
      expect(result).toHaveProperty("items");
      expect(result.items).toBeArray();
    });

    it("uses indexClass GSI", async () => {
      await queryByClass("@", "record", "memory");
      const command = mockSend.mock.calls[0][0];
      expect(command.input.IndexName).toBe("indexClass");
    });

    it("builds correct key value", async () => {
      await queryByClass("@", "record", "memory");
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "@#record#memory",
      );
    });

    it("supports query options", async () => {
      await queryByClass("@", "record", "memory", {
        ascending: true,
        limit: 5,
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
      const result = await queryByType("@", "record", "note");
      expect(result).toHaveProperty("items");
      expect(result.items).toBeArray();
    });

    it("uses indexType GSI", async () => {
      await queryByType("@", "record", "note");
      const command = mockSend.mock.calls[0][0];
      expect(command.input.IndexName).toBe("indexType");
    });

    it("builds correct key value", async () => {
      await queryByType("@", "record", "note");
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "@#record#note",
      );
    });

    it("supports query options", async () => {
      await queryByType("@", "record", "note", { includeDeleted: true });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.FilterExpression).toBeUndefined();
    });
  });

  describe("queryByXid", () => {
    it("is a function", () => {
      expect(queryByXid).toBeFunction();
    });

    it("returns null when no items found", async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });
      const result = await queryByXid("@", "record", "ext-123");
      expect(result).toBeNull();
    });

    it("returns the first item when found", async () => {
      const mockItem = { id: "123", model: "record", xid: "ext-123" };
      mockSend.mockResolvedValueOnce({ Items: [mockItem] });
      const result = await queryByXid("@", "record", "ext-123");
      expect(result).toEqual(mockItem);
    });

    it("uses indexXid GSI", async () => {
      await queryByXid("@", "record", "ext-123");
      const command = mockSend.mock.calls[0][0];
      expect(command.input.IndexName).toBe("indexXid");
    });

    it("builds correct key value", async () => {
      await queryByXid("@", "record", "ext-123");
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "@#record#ext-123",
      );
    });

    it("limits to 1 result", async () => {
      await queryByXid("@", "record", "ext-123");
      const command = mockSend.mock.calls[0][0];
      expect(command.input.Limit).toBe(1);
    });
  });
});
