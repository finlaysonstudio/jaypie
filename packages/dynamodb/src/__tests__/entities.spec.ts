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
  createEntity,
  transitionEntity,
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
  registerModel({
    model: "job",
    indexes: [fabricIndex()],
    status: ["running", "complete", "error", "canceled", "expired"],
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

  describe("createEntity", () => {
    it("returns the indexed entity with indexModel populated", async () => {
      const entity = createTestEntity();
      const result = (await createEntity({ entity })) as StorableEntity & {
        indexModel?: string;
      };
      expect(result.indexModel).toBe("record");
    });

    it("issues PutCommand with attribute_not_exists(id) condition", async () => {
      await createEntity({ entity: createTestEntity() });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.ConditionExpression).toBe("attribute_not_exists(id)");
    });

    it("returns null when ConditionalCheckFailedException is thrown", async () => {
      const err = Object.assign(new Error("conditional check failed"), {
        name: "ConditionalCheckFailedException",
      });
      mockSend.mockRejectedValueOnce(err);
      const result = await createEntity({ entity: createTestEntity() });
      expect(result).toBeNull();
    });

    it("re-throws non-ConditionalCheckFailedException errors", async () => {
      const err = Object.assign(new Error("boom"), { name: "OtherError" });
      mockSend.mockRejectedValueOnce(err);
      await expect(
        createEntity({ entity: createTestEntity() }),
      ).rejects.toThrow("boom");
    });

    it("auto-bumps updatedAt and backfills createdAt", async () => {
      const entity = createTestEntity();
      const result = await createEntity({ entity });
      expect(result.updatedAt).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });

    it("writes via PutCommand", async () => {
      const entity = createTestEntity();
      await createEntity({ entity });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.TableName).toBe("test-table");
      expect(cmd.input.Item.id).toBe(entity.id);
      expect(cmd.input.Item.model).toBe(entity.model);
    });

    it("auto-populates optional GSI attributes when fields present", async () => {
      const entity = { ...createTestEntity(), alias: "my-alias" };
      const result = (await createEntity({ entity })) as StorableEntity & {
        indexModel?: string;
        indexModelAlias?: string;
      };
      expect(result.indexModel).toBe("record");
      expect(result.indexModelAlias).toBe("record#my-alias");
    });

    it("serializes top-level Date values to ISO strings", async () => {
      const expiresAt = new Date("2026-05-02T19:45:28.000Z");
      const entity = {
        ...createTestEntity(),
        expiresAt,
      } as StorableEntity;
      const result = (await createEntity({ entity })) as StorableEntity & {
        expiresAt?: unknown;
      };
      expect(result.expiresAt).toBe(expiresAt.toISOString());
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Item.expiresAt).toBe(expiresAt.toISOString());
    });

    it("serializes nested Date values inside state to ISO strings", async () => {
      const lastUsedAt = new Date("2026-05-02T19:45:28.000Z");
      const entity = {
        ...createTestEntity(),
        state: { lastUsedAt, nested: { when: lastUsedAt } },
      } as StorableEntity;
      await createEntity({ entity });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Item.state.lastUsedAt).toBe(lastUsedAt.toISOString());
      expect(cmd.input.Item.state.nested.when).toBe(lastUsedAt.toISOString());
    });

    it("serializes Date values inside arrays to ISO strings", async () => {
      const a = new Date("2026-05-02T19:45:28.000Z");
      const b = new Date("2026-05-03T19:45:28.000Z");
      const entity = {
        ...createTestEntity(),
        state: { times: [a, b] },
      } as StorableEntity;
      await createEntity({ entity });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Item.state.times).toEqual([
        a.toISOString(),
        b.toISOString(),
      ]);
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

    it("serializes Date values to ISO strings", async () => {
      const expiresAt = new Date("2026-05-02T19:45:28.000Z");
      const entity = {
        ...createTestEntity(),
        expiresAt,
      } as StorableEntity;
      const result = (await updateEntity({ entity })) as StorableEntity & {
        expiresAt?: unknown;
      };
      expect(result.expiresAt).toBe(expiresAt.toISOString());
    });

    it("emits no ConditionExpression by default", async () => {
      await updateEntity({ entity: createTestEntity() });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ConditionExpression).toBeUndefined();
    });

    it("passes condition, names, and values through to the Put", async () => {
      await updateEntity({
        condition: "#status = :from",
        entity: createTestEntity(),
        names: { "#status": "status" },
        values: { ":from": "running" },
      });
      const command = mockSend.mock.calls[0][0];
      expect(command.input.ConditionExpression).toBe("#status = :from");
      expect(command.input.ExpressionAttributeNames).toEqual({
        "#status": "status",
      });
      expect(command.input.ExpressionAttributeValues).toEqual({
        ":from": "running",
      });
    });

    it("throws a ConflictError when the condition fails", async () => {
      mockSend.mockRejectedValue(
        Object.assign(new Error("The conditional request failed"), {
          name: "ConditionalCheckFailedException",
        }),
      );
      await expect(
        updateEntity({
          condition: "attribute_exists(id)",
          entity: createTestEntity(),
        }),
      ).rejects.toMatchObject({ isJaypieError: true, status: 409 });
    });

    it("propagates errors that are not conditional-check failures", async () => {
      mockSend.mockRejectedValue(new Error("Throughput exceeded"));
      await expect(
        updateEntity({
          condition: "attribute_exists(id)",
          entity: createTestEntity(),
        }),
      ).rejects.toThrow("Throughput exceeded");
    });
  });

  describe("transitionEntity", () => {
    const runningJob = (): StorableEntity =>
      ({
        id: "job-1",
        model: "job",
        scope: "@",
        status: "running",
      }) as StorableEntity;

    it("guards the write on the current status and merges set", async () => {
      mockSend.mockResolvedValue({ Item: runningJob() });

      await transitionEntity({
        from: "running",
        id: "job-1",
        set: { status: "complete" },
      });

      // First send is the GetCommand, second is the conditional PutCommand
      const put = mockSend.mock.calls[1][0];
      expect(put.input.ConditionExpression).toBe(
        "attribute_exists(id) AND #status = :from",
      );
      expect(put.input.ExpressionAttributeNames).toEqual({
        "#status": "status",
      });
      expect(put.input.ExpressionAttributeValues).toEqual({
        ":from": "running",
      });
      expect(put.input.Item.status).toBe("complete");
    });

    it("guards only existence when from is omitted", async () => {
      mockSend.mockResolvedValue({ Item: runningJob() });

      await transitionEntity({ id: "job-1", set: { status: "complete" } });

      const put = mockSend.mock.calls[1][0];
      expect(put.input.ConditionExpression).toBe("attribute_exists(id)");
      expect(put.input.ExpressionAttributeNames).toBeUndefined();
    });

    it("throws NotFoundError when the entity does not exist", async () => {
      mockSend.mockResolvedValue({});

      await expect(
        transitionEntity({
          from: "running",
          id: "missing",
          set: { status: "complete" },
        }),
      ).rejects.toMatchObject({ isJaypieError: true, status: 404 });
    });

    it("throws ConflictError when another writer moved the status", async () => {
      mockSend
        .mockResolvedValueOnce({ Item: runningJob() })
        .mockRejectedValueOnce(
          Object.assign(new Error("The conditional request failed"), {
            name: "ConditionalCheckFailedException",
          }),
        );

      await expect(
        transitionEntity({
          from: "running",
          id: "job-1",
          set: { status: "complete" },
        }),
      ).rejects.toMatchObject({ isJaypieError: true, status: 409 });
    });

    it("rejects a status outside the model vocabulary", async () => {
      mockSend.mockResolvedValue({ Item: runningJob() });

      await expect(
        transitionEntity({
          from: "running",
          id: "job-1",
          set: { status: "banana" },
        }),
      ).rejects.toMatchObject({ isJaypieError: true, status: 400 });
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
      expect(putCmd.input.Item.indexModelAlias).toBe("record#my-alias#deleted");
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
      const result = await createEntity({ entity });
      expect(result.state).toEqual({ active: true });
    });

    it("accepts arbitrary extra properties", async () => {
      const entity: StorableEntity = {
        ...createTestEntity(),
        customField: "custom-value",
      };
      const result = await createEntity({ entity });
      expect(result.customField).toBe("custom-value");
    });
  });
});

describe("TTL", () => {
  const NOW_MS = Date.parse("2026-07-20T00:00:00.000Z");
  const NOW_SECONDS = Math.floor(NOW_MS / 1000);
  const DAY = 60 * 60 * 24;

  const sessionEntity = (): StorableEntity =>
    ({ id: "s-1", model: "session", scope: "@" }) as StorableEntity;

  beforeAll(() => {
    registerModel({
      model: "session",
      indexes: [fabricIndex()],
      ttl: "30 days",
    });
    registerModel({ model: "note", indexes: [fabricIndex()] });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({});
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("createEntity applies the model's default ttl", async () => {
    const result = (await createEntity({
      entity: sessionEntity(),
    })) as StorableEntity;
    expect(result.ttl).toBe(NOW_SECONDS + DAY * 30);
  });

  it("createEntity does not set ttl for a model without a default", async () => {
    const result = (await createEntity({
      entity: { id: "n-1", model: "note", scope: "@" } as StorableEntity,
    })) as StorableEntity;
    expect(result.ttl).toBeUndefined();
  });

  it("per-call ttl overrides the model default (duration)", async () => {
    const result = (await createEntity({
      entity: sessionEntity(),
      ttl: "1 day",
    })) as StorableEntity;
    expect(result.ttl).toBe(NOW_SECONDS + DAY);
  });

  it("per-call ttl accepts an ISO date and an epoch number", async () => {
    const iso = "2026-08-01T00:00:00.000Z";
    const isoResult = (await createEntity({
      entity: sessionEntity(),
      ttl: iso,
    })) as StorableEntity;
    expect(isoResult.ttl).toBe(Math.floor(Date.parse(iso) / 1000));

    const epoch = NOW_SECONDS + 500;
    const epochResult = (await createEntity({
      entity: sessionEntity(),
      ttl: epoch,
    })) as StorableEntity;
    expect(epochResult.ttl).toBe(epoch);
  });

  it("ttl: false opts out of the model default", async () => {
    const result = (await createEntity({
      entity: sessionEntity(),
      ttl: false,
    })) as StorableEntity;
    expect(result.ttl).toBeUndefined();
  });

  it("preserves an existing ttl already on the entity", async () => {
    const existing = NOW_SECONDS + 999;
    const result = (await createEntity({
      entity: { ...sessionEntity(), ttl: existing } as StorableEntity,
    })) as StorableEntity;
    expect(result.ttl).toBe(existing);
  });

  it("updateEntity does not apply the model default", async () => {
    mockSend.mockResolvedValue({});
    const result = await updateEntity({ entity: sessionEntity() });
    expect((result as StorableEntity).ttl).toBeUndefined();
  });

  it("updateEntity honors a per-call ttl", async () => {
    const result = await updateEntity({
      entity: sessionEntity(),
      ttl: "1 day",
    });
    expect((result as StorableEntity).ttl).toBe(NOW_SECONDS + DAY);
  });

  it("updateEntity ttl: false clears an existing ttl", async () => {
    const result = await updateEntity({
      entity: { ...sessionEntity(), ttl: NOW_SECONDS + 5 } as StorableEntity,
      ttl: false,
    });
    expect((result as StorableEntity).ttl).toBeUndefined();
  });
});
