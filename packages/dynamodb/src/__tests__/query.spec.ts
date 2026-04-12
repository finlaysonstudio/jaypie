/**
 * Tests for the unified query() function
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigurationError } from "@jaypie/errors";
import { clearRegistry, fabricIndex, registerModel } from "@jaypie/fabric";

import { initClient, resetClient } from "../client.js";
import { query } from "../query.js";

// =============================================================================
// Mock AWS SDK
// =============================================================================

const mockSend = vi.fn();

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({
      send: mockSend,
    })),
  },
  QueryCommand: vi.fn((params) => ({ input: params })),
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn(() => ({})),
}));

// =============================================================================
// Tests
// =============================================================================

describe("query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetClient();
    clearRegistry();

    registerModel({
      model: "record",
      indexes: [
        fabricIndex(),
        fabricIndex("alias"),
        fabricIndex("category"),
        fabricIndex("type"),
        fabricIndex("xid"),
      ],
    });

    initClient({
      tableName: "test-table",
      endpoint: "http://127.0.0.1:8000",
    });

    mockSend.mockResolvedValue({
      Items: [],
      LastEvaluatedKey: undefined,
    });
  });

  describe("index auto-detection", () => {
    it("selects indexModel when only model provided", async () => {
      await query({ model: "record" });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.IndexName).toBe("indexModel");
      expect(cmd.input.ExpressionAttributeValues[":pkValue"]).toBe("record");
    });

    it("applies scope as begins_with sk prefix", async () => {
      await query({ model: "record", scope: "@" });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.IndexName).toBe("indexModel");
      expect(cmd.input.ExpressionAttributeValues[":pkValue"]).toBe("record");
      expect(cmd.input.ExpressionAttributeValues[":skPrefix"]).toBe("@#");
    });

    it("selects indexModelAlias when alias is in filter", async () => {
      await query({
        model: "record",
        scope: "@",
        filter: { alias: "my-record" },
      });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.IndexName).toBe("indexModelAlias");
      expect(cmd.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "record#my-record",
      );
    });

    it("selects indexModelCategory when category is in filter", async () => {
      await query({
        model: "record",
        scope: "@",
        filter: { category: "memory" },
      });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.IndexName).toBe("indexModelCategory");
      expect(cmd.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "record#memory",
      );
    });

    it("selects indexModelType when type is in filter", async () => {
      await query({
        model: "record",
        scope: "@",
        filter: { type: "note" },
      });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.IndexName).toBe("indexModelType");
      expect(cmd.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "record#note",
      );
    });

    it("selects indexModelXid when xid is in filter", async () => {
      await query({
        model: "record",
        scope: "@",
        filter: { xid: "ext-123" },
      });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.IndexName).toBe("indexModelXid");
      expect(cmd.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "record#ext-123",
      );
    });

    it("throws ConfigurationError for unregistered models", async () => {
      await expect(
        query({ model: "unregistered", scope: "@" }),
      ).rejects.toThrow(ConfigurationError);
    });

    it("throws ConfigurationError when no index matches the filter", async () => {
      registerModel({
        model: "custom",
        indexes: [{ pk: ["model", "customField"], sk: ["scope", "updatedAt"] }],
      });
      await expect(
        query({
          model: "custom",
          filter: { unrelatedField: "value" } as never,
        }),
      ).rejects.toThrow(ConfigurationError);
    });
  });

  describe("custom registered indexes", () => {
    it("uses custom index registered for the model", async () => {
      registerModel({
        model: "message",
        indexes: [fabricIndex(), fabricIndex("chatId")],
      });

      await query({
        model: "message",
        filter: { chatId: "chat-123" },
      });

      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.IndexName).toBe("indexModelChatId");
      expect(cmd.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "message#chat-123",
      );
    });
  });

  describe("query options", () => {
    it("applies archived suffix to pk", async () => {
      await query({ model: "record", scope: "@", archived: true });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "record#archived",
      );
    });

    it("applies deleted suffix to pk", async () => {
      await query({ model: "record", scope: "@", deleted: true });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "record#deleted",
      );
    });

    it("applies combined archived+deleted suffix to pk", async () => {
      await query({
        model: "record",
        scope: "@",
        archived: true,
        deleted: true,
      });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "record#archived#deleted",
      );
    });

    it("respects limit option", async () => {
      await query({ model: "record", scope: "@", limit: 10 });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Limit).toBe(10);
    });

    it("respects ascending option", async () => {
      await query({ model: "record", scope: "@", ascending: true });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.ScanIndexForward).toBe(true);
    });

    it("defaults to descending order", async () => {
      await query({ model: "record", scope: "@" });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.ScanIndexForward).toBe(false);
    });

    it("passes startKey for pagination", async () => {
      const startKey = { id: "abc" };
      await query({ model: "record", scope: "@", startKey });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.ExclusiveStartKey).toEqual(startKey);
    });
  });

  describe("return value", () => {
    it("returns items from query result", async () => {
      const mockItems = [
        { model: "record", id: "1", name: "Item 1" },
        { model: "record", id: "2", name: "Item 2" },
      ];
      mockSend.mockResolvedValue({ Items: mockItems });
      const result = await query({ model: "record", scope: "@" });
      expect(result.items).toEqual(mockItems);
    });

    it("returns empty array when no items", async () => {
      mockSend.mockResolvedValue({ Items: undefined });
      const result = await query({ model: "record", scope: "@" });
      expect(result.items).toEqual([]);
    });

    it("returns lastEvaluatedKey for pagination", async () => {
      const lastKey = { id: "last" };
      mockSend.mockResolvedValue({
        Items: [],
        LastEvaluatedKey: lastKey,
      });
      const result = await query({ model: "record", scope: "@" });
      expect(result.lastEvaluatedKey).toEqual(lastKey);
    });
  });
});
