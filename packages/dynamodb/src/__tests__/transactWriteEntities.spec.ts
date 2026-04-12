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
});
