/**
 * Tests for the unified query() function
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigurationError } from "@jaypie/errors";
import { clearRegistry, registerModel } from "@jaypie/fabric";

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

    // Initialize client with test config
    initClient({
      tableName: "test-table",
      endpoint: "http://127.0.0.1:8000",
    });

    // Default mock response
    mockSend.mockResolvedValue({
      Items: [],
      LastEvaluatedKey: undefined,
    });
  });

  describe("index auto-detection", () => {
    it("selects indexScope when only scope and model provided", async () => {
      await query({ model: "record", scope: "@" });

      expect(mockSend).toHaveBeenCalledOnce();
      const command = mockSend.mock.calls[0][0];
      expect(command.input.IndexName).toBe("indexScope");
      expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "@#record",
      );
    });

    it("selects indexAlias when alias is in filter", async () => {
      await query({
        model: "record",
        scope: "@",
        filter: { alias: "my-record" },
      });

      expect(mockSend).toHaveBeenCalledOnce();
      const command = mockSend.mock.calls[0][0];
      expect(command.input.IndexName).toBe("indexAlias");
      expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "@#record#my-record",
      );
    });

    it("selects indexCategory when category is in filter", async () => {
      await query({
        model: "record",
        scope: "@",
        filter: { category: "memory" },
      });

      expect(mockSend).toHaveBeenCalledOnce();
      const command = mockSend.mock.calls[0][0];
      expect(command.input.IndexName).toBe("indexCategory");
      expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "@#record#memory",
      );
    });

    it("selects indexType when type is in filter", async () => {
      await query({
        model: "record",
        scope: "@",
        filter: { type: "note" },
      });

      expect(mockSend).toHaveBeenCalledOnce();
      const command = mockSend.mock.calls[0][0];
      expect(command.input.IndexName).toBe("indexType");
      expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "@#record#note",
      );
    });

    it("selects indexXid when xid is in filter", async () => {
      await query({
        model: "record",
        scope: "@",
        filter: { xid: "ext-123" },
      });

      expect(mockSend).toHaveBeenCalledOnce();
      const command = mockSend.mock.calls[0][0];
      expect(command.input.IndexName).toBe("indexXid");
      expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "@#record#ext-123",
      );
    });

    it("throws ConfigurationError when no index matches", async () => {
      // Register a model with no default indexes
      registerModel({
        model: "custom",
        indexes: [{ name: "indexCustom", pk: ["customField", "model"] }],
      });

      await expect(
        query({
          model: "custom",
          // Missing customField - no index can match
        }),
      ).rejects.toThrow(ConfigurationError);
    });
  });

  describe("custom registered indexes", () => {
    it("uses custom index when registered for model", async () => {
      registerModel({
        model: "message",
        indexes: [
          { name: "indexChat", pk: ["chatId", "model"], sk: ["createdAt"] },
          { name: "indexScope", pk: ["scope", "model"], sk: ["sequence"] },
        ],
      });

      await query({
        model: "message",
        filter: { chatId: "chat-123" },
      });

      expect(mockSend).toHaveBeenCalledOnce();
      const command = mockSend.mock.calls[0][0];
      expect(command.input.IndexName).toBe("indexChat");
      expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "chat-123#message",
      );
    });

    it("falls back to DEFAULT_INDEXES for unregistered models", async () => {
      await query({ model: "unregistered", scope: "@" });

      expect(mockSend).toHaveBeenCalledOnce();
      const command = mockSend.mock.calls[0][0];
      expect(command.input.IndexName).toBe("indexScope");
    });
  });

  describe("query options", () => {
    it("applies archived suffix", async () => {
      await query({ model: "record", scope: "@", archived: true });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "@#record#archived",
      );
    });

    it("applies deleted suffix", async () => {
      await query({ model: "record", scope: "@", deleted: true });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "@#record#deleted",
      );
    });

    it("applies combined archived+deleted suffix", async () => {
      await query({
        model: "record",
        scope: "@",
        archived: true,
        deleted: true,
      });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "@#record#archived#deleted",
      );
    });

    it("respects limit option", async () => {
      await query({ model: "record", scope: "@", limit: 10 });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Limit).toBe(10);
    });

    it("respects ascending option", async () => {
      await query({ model: "record", scope: "@", ascending: true });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.ScanIndexForward).toBe(true);
    });

    it("defaults to descending order", async () => {
      await query({ model: "record", scope: "@" });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.ScanIndexForward).toBe(false);
    });

    it("passes startKey for pagination", async () => {
      const startKey = { model: "record", id: "abc" };
      await query({ model: "record", scope: "@", startKey });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.ExclusiveStartKey).toEqual(startKey);
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
      const lastKey = { model: "record", id: "last" };
      mockSend.mockResolvedValue({
        Items: [],
        LastEvaluatedKey: lastKey,
      });

      const result = await query({ model: "record", scope: "@" });

      expect(result.lastEvaluatedKey).toEqual(lastKey);
    });
  });
});
