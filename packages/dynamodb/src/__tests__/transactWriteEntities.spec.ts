import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { type IndexDefinition, registerModel } from "@jaypie/fabric";

import * as clientModule from "../client.js";
import { transactWriteEntities } from "../entities.js";
import type { StorableEntity } from "../types.js";

const STANDARD_INDEXES: IndexDefinition[] = [
  { name: "indexScope", pk: ["scope", "model"], sk: ["sequence"] },
  {
    name: "indexAlias",
    pk: ["scope", "model", "alias"],
    sk: ["sequence"],
    sparse: true,
  },
];

beforeAll(() => {
  registerModel({ model: "migration", indexes: STANDARD_INDEXES });
  registerModel({ model: "apikey", indexes: STANDARD_INDEXES });
});

// Mock the client module
const mockSend = vi.fn();

vi.spyOn(clientModule, "getDocClient").mockReturnValue({
  send: mockSend,
} as unknown as ReturnType<typeof clientModule.getDocClient>);
vi.spyOn(clientModule, "getTableName").mockReturnValue("test-table");

describe("transactWriteEntities", () => {
  const now = new Date().toISOString();

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
        createdAt: now,
        id: "migration-1",
        model: "migration",
        name: "Test Migration",
        scope: "@",
        sequence: 1,
        updatedAt: now,
      },
      {
        alias: "key-hash",
        createdAt: now,
        id: "apikey-1",
        model: "apikey",
        name: "Owner Key",
        scope: "@",
        sequence: 2,
        updatedAt: now,
      },
    ];

    await transactWriteEntities({ entities });

    expect(mockSend).toHaveBeenCalledOnce();
    const command = mockSend.mock.calls[0][0];
    expect(command.input.TransactItems).toHaveLength(2);

    // Verify entities are indexed (have indexScope populated)
    const firstItem = command.input.TransactItems[0].Put.Item;
    expect(firstItem.indexScope).toBeDefined();
    expect(firstItem.indexAlias).toBeDefined();
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
            createdAt: now,
            id: "test",
            model: "migration",
            name: "Test",
            scope: "@",
            sequence: 1,
            updatedAt: now,
          },
        ],
      }),
    ).rejects.toThrow("Transaction failed");
  });
});
