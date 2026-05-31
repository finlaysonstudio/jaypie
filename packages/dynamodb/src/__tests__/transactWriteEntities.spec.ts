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
import { transactWriteEntities } from "../entities.js";
import type { StorableEntity } from "../types.js";

beforeAll(() => {
  clearRegistry();
  registerModel({
    model: "migration",
    indexes: [fabricIndex(), fabricIndex("alias")],
  });
  registerModel({
    model: "apikey",
    indexes: [fabricIndex(), fabricIndex("alias")],
  });
});

// Mock the client module
const mockSend = vi.fn();

vi.spyOn(clientModule, "getDocClient").mockReturnValue({
  send: mockSend,
} as unknown as ReturnType<typeof clientModule.getDocClient>);
vi.spyOn(clientModule, "getTableName").mockReturnValue("test-table");

describe("transactWriteEntities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("is a function", () => {
    expect(transactWriteEntities).toBeTypeOf("function");
  });

  it("sends a TransactWriteCommand with indexed entities", async () => {
    const entities: StorableEntity[] = [
      {
        alias: "001-test",
        id: "migration-1",
        model: "migration",
        name: "Test Migration",
        scope: "@",
      } as StorableEntity,
      {
        alias: "key-hash",
        id: "apikey-1",
        model: "apikey",
        name: "Owner Key",
        scope: "@",
      } as StorableEntity,
    ];

    await transactWriteEntities({ entities });

    expect(mockSend).toHaveBeenCalledOnce();
    const command = mockSend.mock.calls[0][0];
    expect(command.input.TransactItems).toHaveLength(2);

    const firstItem = command.input.TransactItems[0].Put.Item;
    expect(firstItem.indexModel).toBe("migration");
    expect(firstItem.indexModelAlias).toBe("migration#001-test");
    expect(firstItem.updatedAt).toBeDefined();
    expect(command.input.TransactItems[0].Put.TableName).toBe("test-table");
    expect(command.input.TransactItems[1].Put.TableName).toBe("test-table");
  });

  it("handles empty entities array", async () => {
    await transactWriteEntities({ entities: [] });

    expect(mockSend).toHaveBeenCalledOnce();
    const command = mockSend.mock.calls[0][0];
    expect(command.input.TransactItems).toHaveLength(0);
  });

  it("propagates errors from DynamoDB", async () => {
    mockSend.mockRejectedValue(new Error("Transaction failed"));

    await expect(
      transactWriteEntities({
        entities: [
          {
            id: "test",
            model: "migration",
            name: "Test",
            scope: "@",
          } as StorableEntity,
        ],
      }),
    ).rejects.toThrow("Transaction failed");
  });

  it("emits no ConditionExpression by default", async () => {
    await transactWriteEntities({
      entities: [{ id: "a", model: "migration", scope: "@" } as StorableEntity],
    });

    const command = mockSend.mock.calls[0][0];
    expect(
      command.input.TransactItems[0].Put.ConditionExpression,
    ).toBeUndefined();
  });

  describe("conditionalCreate", () => {
    it("applies attribute_not_exists(id) to every Put", async () => {
      await transactWriteEntities({
        conditionalCreate: true,
        entities: [
          { id: "a", model: "migration", scope: "@" } as StorableEntity,
          { id: "b", model: "apikey", scope: "@" } as StorableEntity,
        ],
      });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.TransactItems[0].Put.ConditionExpression).toBe(
        "attribute_not_exists(id)",
      );
      expect(command.input.TransactItems[1].Put.ConditionExpression).toBe(
        "attribute_not_exists(id)",
      );
    });
  });

  describe("condition", () => {
    it("applies the given expression to every Put", async () => {
      await transactWriteEntities({
        condition: "attribute_not_exists(pk)",
        entities: [
          { id: "a", model: "migration", scope: "@" } as StorableEntity,
        ],
      });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.TransactItems[0].Put.ConditionExpression).toBe(
        "attribute_not_exists(pk)",
      );
    });

    it("takes precedence over conditionalCreate", async () => {
      await transactWriteEntities({
        condition: "attribute_not_exists(pk)",
        conditionalCreate: true,
        entities: [
          { id: "a", model: "migration", scope: "@" } as StorableEntity,
        ],
      });

      const command = mockSend.mock.calls[0][0];
      expect(command.input.TransactItems[0].Put.ConditionExpression).toBe(
        "attribute_not_exists(pk)",
      );
    });
  });

  describe("conflict handling", () => {
    it("throws a ConflictError when a conditional check fails", async () => {
      const cancelled = Object.assign(
        new Error("Transaction cancelled, please refer to ..."),
        {
          name: "TransactionCanceledException",
          CancellationReasons: [
            { Code: "ConditionalCheckFailed", Message: "exists" },
            { Code: "None" },
          ],
        },
      );
      mockSend.mockRejectedValue(cancelled);

      await expect(
        transactWriteEntities({
          conditionalCreate: true,
          entities: [
            { id: "a", model: "migration", scope: "@" } as StorableEntity,
          ],
        }),
      ).rejects.toMatchObject({ isJaypieError: true, status: 409 });
    });

    it("propagates a cancellation that is not a conditional check failure", async () => {
      const cancelled = Object.assign(
        new Error("Transaction cancelled, please refer to ..."),
        {
          name: "TransactionCanceledException",
          CancellationReasons: [{ Code: "ProvisionedThroughputExceeded" }],
        },
      );
      mockSend.mockRejectedValue(cancelled);

      await expect(
        transactWriteEntities({
          entities: [
            { id: "a", model: "migration", scope: "@" } as StorableEntity,
          ],
        }),
      ).rejects.toThrow("Transaction cancelled");
    });
  });
});
