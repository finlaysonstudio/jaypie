import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { clearRegistry, fabricIndex, registerModel } from "@jaypie/fabric";

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

beforeAll(() => {
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
});

const mockSend = vi.fn();

vi.spyOn(clientModule, "getDocClient").mockReturnValue({
  send: mockSend,
} as unknown as ReturnType<typeof clientModule.getDocClient>);
vi.spyOn(clientModule, "getTableName").mockReturnValue("test-table");

describe("Entity Operations", () => {
  const createTestEntity = (): StorableEntity =>
    ({
      id: "test-id-123",
      model: "record",
      name: "Test Record",
      scope: "@",
    }) as StorableEntity;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getEntity", () => {
    it("returns entity when found", async () => {
      const mockEntity = createTestEntity();
      mockSend.mockResolvedValueOnce({ Item: mockEntity });
      const result = await getEntity({ id: "test-id-123" });
      expect(result).toEqual(mockEntity);
    });

    it("returns null when not found", async () => {
      mockSend.mockResolvedValueOnce({});
      const result = await getEntity({ id: "nonexistent" });
      expect(result).toBeNull();
    });

    it("calls GetCommand with Key = { id }", async () => {
      await getEntity({ id: "test-id-123" });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.TableName).toBe("test-table");
      expect(cmd.input.Key).toEqual({ id: "test-id-123" });
    });
  });

  describe("putEntity", () => {
    it("returns the indexed entity with indexModel populated", async () => {
      const entity = createTestEntity();
      const result = (await putEntity({ entity })) as StorableEntity & {
        indexModel?: string;
      };
      expect(result.indexModel).toBe("record");
    });

    it("auto-bumps updatedAt and backfills createdAt", async () => {
      const entity = createTestEntity();
      const result = await putEntity({ entity });
      expect(result.updatedAt).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });

    it("writes via PutCommand", async () => {
      const entity = createTestEntity();
      await putEntity({ entity });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.TableName).toBe("test-table");
      expect(cmd.input.Item.id).toBe(entity.id);
      expect(cmd.input.Item.model).toBe(entity.model);
    });

    it("auto-populates optional GSI attributes when fields present", async () => {
      const entity = { ...createTestEntity(), alias: "my-alias" };
      const result = (await putEntity({ entity })) as StorableEntity & {
        indexModel?: string;
        indexModelAlias?: string;
      };
      expect(result.indexModel).toBe("record");
      expect(result.indexModelAlias).toBe("record#my-alias");
    });
  });

  describe("updateEntity", () => {
    it("advances updatedAt on every call", async () => {
      const entity = {
        ...createTestEntity(),
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };
      const result = await updateEntity({ entity });
      expect(result.updatedAt).not.toBe("2026-01-01T00:00:00.000Z");
    });

    it("preserves createdAt on updates", async () => {
      const entity = {
        ...createTestEntity(),
        createdAt: "2026-01-01T00:00:00.000Z",
      };
      const result = await updateEntity({ entity });
      expect(result.createdAt).toBe("2026-01-01T00:00:00.000Z");
    });

    it("re-indexes optional fields", async () => {
      const entity = { ...createTestEntity(), type: "note" };
      const result = (await updateEntity({ entity })) as StorableEntity & {
        indexModel?: string;
        indexModelType?: string;
      };
      expect(result.indexModel).toBe("record");
      expect(result.indexModelType).toBe("record#note");
    });
  });

  describe("deleteEntity", () => {
    it("returns true on success", async () => {
      const mockEntity = createTestEntity();
      mockSend.mockResolvedValueOnce({ Item: mockEntity });
      mockSend.mockResolvedValueOnce({});
      const result = await deleteEntity({ id: "test-id-123" });
      expect(result).toBe(true);
    });

    it("returns false when entity not found", async () => {
      mockSend.mockResolvedValueOnce({});
      const result = await deleteEntity({ id: "nonexistent" });
      expect(result).toBe(false);
    });

    it("fetches then writes with #deleted suffix on pk", async () => {
      const mockEntity = createTestEntity();
      mockSend.mockResolvedValueOnce({ Item: mockEntity });
      mockSend.mockResolvedValueOnce({});
      await deleteEntity({ id: "test-id-123" });
      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(mockSend.mock.calls[0][0].input.Key).toEqual({
        id: "test-id-123",
      });
      const putCmd = mockSend.mock.calls[1][0];
      expect(putCmd.input.Item.deletedAt).toBeDefined();
      expect(putCmd.input.Item.indexModel).toBe("record#deleted");
    });

    it("re-indexes optional fields with #deleted suffix", async () => {
      const mockEntity = { ...createTestEntity(), alias: "my-alias" };
      mockSend.mockResolvedValueOnce({ Item: mockEntity });
      mockSend.mockResolvedValueOnce({});
      await deleteEntity({ id: "test-id-123" });
      const putCmd = mockSend.mock.calls[1][0];
      expect(putCmd.input.Item.indexModel).toBe("record#deleted");
      expect(putCmd.input.Item.indexModelAlias).toBe(
        "record#my-alias#deleted",
      );
    });
  });

  describe("archiveEntity", () => {
    it("returns true on success", async () => {
      const mockEntity = createTestEntity();
      mockSend.mockResolvedValueOnce({ Item: mockEntity });
      mockSend.mockResolvedValueOnce({});
      const result = await archiveEntity({ id: "test-id-123" });
      expect(result).toBe(true);
    });

    it("re-indexes with #archived suffix on pk", async () => {
      const mockEntity = createTestEntity();
      mockSend.mockResolvedValueOnce({ Item: mockEntity });
      mockSend.mockResolvedValueOnce({});
      await archiveEntity({ id: "test-id-123" });
      const putCmd = mockSend.mock.calls[1][0];
      expect(putCmd.input.Item.archivedAt).toBeDefined();
      expect(putCmd.input.Item.indexModel).toBe("record#archived");
    });
  });

  describe("destroyEntity", () => {
    it("calls DeleteCommand with Key = { id }", async () => {
      await destroyEntity({ id: "test-id-123" });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.TableName).toBe("test-table");
      expect(cmd.input.Key).toEqual({ id: "test-id-123" });
    });
  });

  describe("Combined archived + deleted state", () => {
    it("deleteEntity uses #archived#deleted suffix when already archived", async () => {
      const archivedEntity = {
        ...createTestEntity(),
        archivedAt: "2026-01-01T00:00:00.000Z",
      };
      mockSend.mockResolvedValueOnce({ Item: archivedEntity });
      mockSend.mockResolvedValueOnce({});
      await deleteEntity({ id: "test-id-123" });
      const putCmd = mockSend.mock.calls[1][0];
      expect(putCmd.input.Item.indexModel).toBe("record#archived#deleted");
    });

    it("archiveEntity uses #archived#deleted suffix when already deleted", async () => {
      const deletedEntity = {
        ...createTestEntity(),
        deletedAt: "2026-01-01T00:00:00.000Z",
      };
      mockSend.mockResolvedValueOnce({ Item: deletedEntity });
      mockSend.mockResolvedValueOnce({});
      await archiveEntity({ id: "test-id-123" });
      const putCmd = mockSend.mock.calls[1][0];
      expect(putCmd.input.Item.indexModel).toBe("record#archived#deleted");
    });
  });

  describe("StorableEntity flexibility", () => {
    it("accepts state property", async () => {
      const entity: StorableEntity = {
        ...createTestEntity(),
        state: { active: true },
      };
      const result = await putEntity({ entity });
      expect(result.state).toEqual({ active: true });
    });

    it("accepts arbitrary extra properties", async () => {
      const entity: StorableEntity = {
        ...createTestEntity(),
        customField: "custom-value",
      };
      const result = await putEntity({ entity });
      expect(result.customField).toBe("custom-value");
    });
  });
});
