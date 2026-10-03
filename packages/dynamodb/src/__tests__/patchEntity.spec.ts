import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearRegistry, fabricIndex, registerModel } from "@jaypie/fabric";

import * as clientModule from "../client.js";
import { patchEntity, updateEntity } from "../entities.js";
import type { StorableEntity } from "../types.js";

beforeAll(() => {
  clearRegistry();
  registerModel({
    model: "endpoint",
    indexes: [fabricIndex(), fabricIndex("alias"), fabricIndex("category")],
  });
});

const mockSend = vi.fn();

vi.spyOn(clientModule, "getDocClient").mockReturnValue({
  send: mockSend,
} as unknown as ReturnType<typeof clientModule.getDocClient>);
vi.spyOn(clientModule, "getTableName").mockReturnValue("test-table");

describe("updateEntity (issue #606 report)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({});
  });

  it("writes the whole stale snapshot and moves the indexModel sort key", async () => {
    const stale = {
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "endpoint-1",
      lastDeliveryAt: "2026-01-01T00:00:00.000Z",
      model: "endpoint",
      scope: "@",
      status: "active",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as StorableEntity;

    await updateEntity({
      entity: { ...stale, lastDeliveryAt: "2026-01-02T00:00:00.000Z" },
    });

    const { input } = mockSend.mock.calls[0][0];
    expect(input.Item.status).toBe("active");
    expect(input.Item.indexModelSk).not.toBe("@#2026-01-01T00:00:00.000Z");
  });
});

describe("patchEntity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({ Attributes: { id: "endpoint-1" } });
  });

  it("is a function", () => {
    expect(typeof patchEntity).toBe("function");
  });

  it("sends an UpdateItem that sets only the listed attributes", async () => {
    await patchEntity({
      id: "endpoint-1",
      set: { lastDeliveryAt: "2026-01-02T00:00:00.000Z" },
    });

    const command = mockSend.mock.calls[0][0];
    expect(command.constructor.name).toBe("UpdateCommand");
    const { input } = command;
    expect(input.Key).toEqual({ id: "endpoint-1" });
    expect(input.TableName).toBe("test-table");
    expect(input.UpdateExpression).toBe("SET #s0 = :s0");
    expect(input.ExpressionAttributeNames).toEqual({
      "#s0": "lastDeliveryAt",
    });
    expect(input.ExpressionAttributeValues).toEqual({
      ":s0": "2026-01-02T00:00:00.000Z",
    });
    expect(input.ConditionExpression).toBe("attribute_exists(id)");
    expect(input.ReturnValues).toBe("ALL_NEW");
  });

  it("does not touch updatedAt or any index attribute", async () => {
    await patchEntity({ id: "endpoint-1", set: { count: 2 } });
    const { input } = mockSend.mock.calls[0][0];
    const names = Object.values(input.ExpressionAttributeNames);
    expect(names).not.toContain("updatedAt");
    expect(names.some((name) => String(name).startsWith("index"))).toBe(false);
  });

  it("removes listed attributes", async () => {
    await patchEntity({
      id: "endpoint-1",
      remove: ["lastError"],
      set: { lastDeliveryAt: "2026-01-02T00:00:00.000Z" },
    });
    const { input } = mockSend.mock.calls[0][0];
    expect(input.UpdateExpression).toBe("SET #s0 = :s0 REMOVE #r0");
    expect(input.ExpressionAttributeNames["#r0"]).toBe("lastError");
  });

  it("serializes Date values", async () => {
    await patchEntity({
      id: "endpoint-1",
      set: { lastDeliveryAt: new Date("2026-01-02T00:00:00.000Z") },
    });
    const { input } = mockSend.mock.calls[0][0];
    expect(input.ExpressionAttributeValues[":s0"]).toBe(
      "2026-01-02T00:00:00.000Z",
    );
  });

  it("combines a caller condition with the existence guard", async () => {
    await patchEntity({
      condition: "#status = :active",
      id: "endpoint-1",
      names: { "#status": "status" },
      set: { lastDeliveryAt: "2026-01-02T00:00:00.000Z" },
      values: { ":active": "active" },
    });
    const { input } = mockSend.mock.calls[0][0];
    expect(input.ConditionExpression).toBe(
      "attribute_exists(id) AND (#status = :active)",
    );
    expect(input.ExpressionAttributeNames["#status"]).toBe("status");
    expect(input.ExpressionAttributeValues[":active"]).toBe("active");
  });

  it("returns the updated entity", async () => {
    const result = await patchEntity({ id: "endpoint-1", set: { count: 2 } });
    expect(result).toEqual({ id: "endpoint-1" });
  });

  it("throws NotFoundError when the entity does not exist", async () => {
    mockSend.mockRejectedValue(
      Object.assign(new Error("The conditional request failed"), {
        name: "ConditionalCheckFailedException",
      }),
    );
    await expect(
      patchEntity({ id: "missing", set: { count: 2 } }),
    ).rejects.toMatchObject({ isJaypieError: true, status: 404 });
  });

  it("throws ConflictError when a caller condition fails", async () => {
    mockSend.mockRejectedValue(
      Object.assign(new Error("The conditional request failed"), {
        name: "ConditionalCheckFailedException",
      }),
    );
    await expect(
      patchEntity({
        condition: "#status = :active",
        id: "endpoint-1",
        names: { "#status": "status" },
        set: { count: 2 },
        values: { ":active": "active" },
      }),
    ).rejects.toMatchObject({ isJaypieError: true, status: 409 });
  });

  it.each([
    "alias",
    "archivedAt",
    "category",
    "deletedAt",
    "id",
    "indexModel",
    "indexModelSk",
    "model",
    "scope",
    "updatedAt",
  ])("rejects %s with BadRequestError", async (field) => {
    await expect(
      patchEntity({ id: "endpoint-1", set: { [field]: "x" } }),
    ).rejects.toMatchObject({ isJaypieError: true, status: 400 });
    await expect(
      patchEntity({ id: "endpoint-1", remove: [field] }),
    ).rejects.toMatchObject({ isJaypieError: true, status: 400 });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("rejects caller placeholders that collide with generated ones", async () => {
    await expect(
      patchEntity({
        condition: "#s0 = :ok",
        id: "endpoint-1",
        names: { "#s0": "status" },
        set: { count: 2 },
        values: { ":ok": "active" },
      }),
    ).rejects.toMatchObject({ isJaypieError: true, status: 400 });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("rejects an empty patch with BadRequestError", async () => {
    await expect(patchEntity({ id: "endpoint-1" })).rejects.toMatchObject({
      isJaypieError: true,
      status: 400,
    });
  });
});
