import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as clientModule from "../client.js";
import {
  archiveEntity,
  deleteEntity,
  destroyEntity,
  getEntity,
  putEntity,
  updateEntity,
} from "../entities.js";
import type { StorableEntity } from "../types.js";

// Mock the client module
const mockSend = vi.fn();

vi.spyOn(clientModule, "getDocClient").mockReturnValue({
  send: mockSend,
} as unknown as ReturnType<typeof clientModule.getDocClient>);
vi.spyOn(clientModule, "getTableName").mockReturnValue("test-table");

describe("Entity Operations", () => {
  const now = new Date().toISOString();

  const createTestEntity = (): StorableEntity => ({
    createdAt: now,
    id: "test-id-123",
    model: "record",
    name: "Test Record",
    ou: "@",
    sequence: Date.now(),
    updatedAt: now,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getEntity", () => {
    it("is a function", () => {
      expect(getEntity).toBeFunction();
    });

    it("returns entity when found", async () => {
      const mockEntity = createTestEntity();
      mockSend.mockResolvedValueOnce({ Item: mockEntity });
      const result = await getEntity({ id: "test-id-123", model: "record" });
      expect(result).toEqual(mockEntity);
    });

    it("returns null when not found", async () => {
      mockSend.mockResolvedValueOnce({});
      const result = await getEntity({ id: "nonexistent", model: "record" });
      expect(result).toBeNull();
    });

    it("calls docClient.send with GetCommand", async () => {
      await getEntity({ id: "test-id-123", model: "record" });
      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.input.TableName).toBe("test-table");
      expect(command.input.Key).toEqual({ id: "test-id-123", model: "record" });
    });
  });

  describe("putEntity", () => {
    it("is a function", () => {
      expect(putEntity).toBeFunction();
    });

    it("returns the indexed entity", async () => {
      const entity = createTestEntity();
      const result = await putEntity({ entity });
      expect(result.indexOu).toBe("@#record");
    });

    it("calls docClient.send with PutCommand", async () => {
      const entity = createTestEntity();
      await putEntity({ entity });
      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.input.TableName).toBe("test-table");
      expect(command.input.Item.id).toBe(entity.id);
      expect(command.input.Item.model).toBe(entity.model);
    });

    it("auto-populates index keys", async () => {
      const entity = { ...createTestEntity(), alias: "my-alias" };
      const result = await putEntity({ entity });
      expect(result.indexOu).toBe("@#record");
      expect(result.indexAlias).toBe("@#record#my-alias");
    });
  });

  describe("updateEntity", () => {
    it("is a function", () => {
      expect(updateEntity).toBeFunction();
    });

    it("returns the updated entity", async () => {
      const entity = createTestEntity();
      const result = await updateEntity({ entity });
      expect(result.id).toBe(entity.id);
    });

    it("updates the updatedAt timestamp", async () => {
      const entity = createTestEntity();
      const originalUpdatedAt = entity.updatedAt;
      const result = await updateEntity({ entity });
      expect(result.updatedAt).not.toBe(originalUpdatedAt);
    });

    it("calls docClient.send with PutCommand", async () => {
      const entity = createTestEntity();
      await updateEntity({ entity });
      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.input.TableName).toBe("test-table");
    });

    it("auto-populates index keys", async () => {
      const entity = { ...createTestEntity(), type: "note" };
      const result = await updateEntity({ entity });
      expect(result.indexOu).toBe("@#record");
      expect(result.indexType).toBe("@#record#note");
    });
  });

  describe("deleteEntity", () => {
    it("is a function", () => {
      expect(deleteEntity).toBeFunction();
    });

    it("returns true on success", async () => {
      const mockEntity = createTestEntity();
      mockSend.mockResolvedValueOnce({ Item: mockEntity }); // getEntity call
      mockSend.mockResolvedValueOnce({}); // putEntity call
      const result = await deleteEntity({ id: "test-id-123", model: "record" });
      expect(result).toBe(true);
    });

    it("returns false when entity not found", async () => {
      mockSend.mockResolvedValueOnce({}); // getEntity returns nothing
      const result = await deleteEntity({ id: "nonexistent", model: "record" });
      expect(result).toBe(false);
    });

    it("fetches entity then saves with PutCommand", async () => {
      const mockEntity = createTestEntity();
      mockSend.mockResolvedValueOnce({ Item: mockEntity });
      mockSend.mockResolvedValueOnce({});
      await deleteEntity({ id: "test-id-123", model: "record" });
      expect(mockSend).toHaveBeenCalledTimes(2);
      // First call is GetCommand
      expect(mockSend.mock.calls[0][0].input.Key).toEqual({
        id: "test-id-123",
        model: "record",
      });
      // Second call is PutCommand
      expect(mockSend.mock.calls[1][0].input.Item).toBeDefined();
    });

    it("sets deletedAt timestamp", async () => {
      const mockEntity = createTestEntity();
      mockSend.mockResolvedValueOnce({ Item: mockEntity });
      mockSend.mockResolvedValueOnce({});
      await deleteEntity({ id: "test-id-123", model: "record" });
      const putCommand = mockSend.mock.calls[1][0];
      expect(putCommand.input.Item.deletedAt).toBeDefined();
    });

    it("re-indexes with #deleted suffix", async () => {
      const mockEntity = createTestEntity();
      mockSend.mockResolvedValueOnce({ Item: mockEntity });
      mockSend.mockResolvedValueOnce({});
      await deleteEntity({ id: "test-id-123", model: "record" });
      const putCommand = mockSend.mock.calls[1][0];
      expect(putCommand.input.Item.indexOu).toBe("@#record#deleted");
    });

    it("re-indexes all present index keys with #deleted suffix", async () => {
      const mockEntity = { ...createTestEntity(), alias: "my-alias" };
      mockSend.mockResolvedValueOnce({ Item: mockEntity });
      mockSend.mockResolvedValueOnce({});
      await deleteEntity({ id: "test-id-123", model: "record" });
      const putCommand = mockSend.mock.calls[1][0];
      expect(putCommand.input.Item.indexOu).toBe("@#record#deleted");
      expect(putCommand.input.Item.indexAlias).toBe(
        "@#record#my-alias#deleted",
      );
    });
  });

  describe("archiveEntity", () => {
    it("is a function", () => {
      expect(archiveEntity).toBeFunction();
    });

    it("returns true on success", async () => {
      const mockEntity = createTestEntity();
      mockSend.mockResolvedValueOnce({ Item: mockEntity });
      mockSend.mockResolvedValueOnce({});
      const result = await archiveEntity({
        id: "test-id-123",
        model: "record",
      });
      expect(result).toBe(true);
    });

    it("returns false when entity not found", async () => {
      mockSend.mockResolvedValueOnce({});
      const result = await archiveEntity({
        id: "nonexistent",
        model: "record",
      });
      expect(result).toBe(false);
    });

    it("fetches entity then saves with PutCommand", async () => {
      const mockEntity = createTestEntity();
      mockSend.mockResolvedValueOnce({ Item: mockEntity });
      mockSend.mockResolvedValueOnce({});
      await archiveEntity({ id: "test-id-123", model: "record" });
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it("sets archivedAt timestamp", async () => {
      const mockEntity = createTestEntity();
      mockSend.mockResolvedValueOnce({ Item: mockEntity });
      mockSend.mockResolvedValueOnce({});
      await archiveEntity({ id: "test-id-123", model: "record" });
      const putCommand = mockSend.mock.calls[1][0];
      expect(putCommand.input.Item.archivedAt).toBeDefined();
    });

    it("re-indexes with #archived suffix", async () => {
      const mockEntity = createTestEntity();
      mockSend.mockResolvedValueOnce({ Item: mockEntity });
      mockSend.mockResolvedValueOnce({});
      await archiveEntity({ id: "test-id-123", model: "record" });
      const putCommand = mockSend.mock.calls[1][0];
      expect(putCommand.input.Item.indexOu).toBe("@#record#archived");
    });

    it("re-indexes all present index keys with #archived suffix", async () => {
      const mockEntity = { ...createTestEntity(), class: "memory" };
      mockSend.mockResolvedValueOnce({ Item: mockEntity });
      mockSend.mockResolvedValueOnce({});
      await archiveEntity({ id: "test-id-123", model: "record" });
      const putCommand = mockSend.mock.calls[1][0];
      expect(putCommand.input.Item.indexOu).toBe("@#record#archived");
      expect(putCommand.input.Item.indexClass).toBe(
        "@#record#memory#archived",
      );
    });
  });

  describe("destroyEntity", () => {
    it("is a function", () => {
      expect(destroyEntity).toBeFunction();
    });

    it("returns true on success", async () => {
      const result = await destroyEntity({
        id: "test-id-123",
        model: "record",
      });
      expect(result).toBe(true);
    });

    it("calls docClient.send with DeleteCommand", async () => {
      await destroyEntity({ id: "test-id-123", model: "record" });
      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.input.TableName).toBe("test-table");
      expect(command.input.Key).toEqual({ id: "test-id-123", model: "record" });
    });
  });

  describe("Combined archived and deleted state", () => {
    it("deleteEntity uses #archived#deleted suffix when entity is already archived", async () => {
      const archivedEntity = {
        ...createTestEntity(),
        archivedAt: "2026-01-01T00:00:00.000Z",
      };
      mockSend.mockResolvedValueOnce({ Item: archivedEntity });
      mockSend.mockResolvedValueOnce({});
      await deleteEntity({ id: "test-id-123", model: "record" });
      const putCommand = mockSend.mock.calls[1][0];
      expect(putCommand.input.Item.indexOu).toBe("@#record#archived#deleted");
      expect(putCommand.input.Item.archivedAt).toBe("2026-01-01T00:00:00.000Z");
      expect(putCommand.input.Item.deletedAt).toBeDefined();
    });

    it("archiveEntity uses #archived#deleted suffix when entity is already deleted", async () => {
      const deletedEntity = {
        ...createTestEntity(),
        deletedAt: "2026-01-01T00:00:00.000Z",
      };
      mockSend.mockResolvedValueOnce({ Item: deletedEntity });
      mockSend.mockResolvedValueOnce({});
      await archiveEntity({ id: "test-id-123", model: "record" });
      const putCommand = mockSend.mock.calls[1][0];
      expect(putCommand.input.Item.indexOu).toBe("@#record#archived#deleted");
      expect(putCommand.input.Item.deletedAt).toBe("2026-01-01T00:00:00.000Z");
      expect(putCommand.input.Item.archivedAt).toBeDefined();
    });

    it("re-indexes all present index keys with combined suffix", async () => {
      const archivedEntity = {
        ...createTestEntity(),
        alias: "my-alias",
        archivedAt: "2026-01-01T00:00:00.000Z",
        class: "memory",
      };
      mockSend.mockResolvedValueOnce({ Item: archivedEntity });
      mockSend.mockResolvedValueOnce({});
      await deleteEntity({ id: "test-id-123", model: "record" });
      const putCommand = mockSend.mock.calls[1][0];
      expect(putCommand.input.Item.indexOu).toBe("@#record#archived#deleted");
      expect(putCommand.input.Item.indexAlias).toBe(
        "@#record#my-alias#archived#deleted",
      );
      expect(putCommand.input.Item.indexClass).toBe(
        "@#record#memory#archived#deleted",
      );
    });
  });
});
