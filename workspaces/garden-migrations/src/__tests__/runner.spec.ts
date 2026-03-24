import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock @jaypie/dynamodb before importing runner
vi.mock("@jaypie/dynamodb", async () => {
  const actual =
    await vi.importActual<typeof import("@jaypie/dynamodb")>(
      "@jaypie/dynamodb",
    );
  return {
    ...actual,
    queryByAlias: vi.fn(),
    transactWriteEntities: vi.fn(),
  };
});

// Mock @jaypie/fabric registerModel to avoid side effects
vi.mock("@jaypie/fabric", async () => {
  const actual =
    await vi.importActual<typeof import("@jaypie/fabric")>("@jaypie/fabric");
  return {
    ...actual,
    registerModel: vi.fn(),
  };
});

import { queryByAlias, transactWriteEntities } from "@jaypie/dynamodb";
import { runMigrations, type Migration } from "../runner.js";

// Access the migrations array to manipulate it in tests
vi.mock("../migrations/index.js", () => ({
  migrations: [] as Migration[],
}));

import { migrations } from "../migrations/index.js";

const mockQueryByAlias = vi.mocked(queryByAlias);
const mockTransactWriteEntities = vi.mocked(transactWriteEntities);

describe("runMigrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset migrations array
    migrations.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("is a function", () => {
    expect(runMigrations).toBeTypeOf("function");
  });

  it("does nothing with empty migrations", async () => {
    await runMigrations();
    expect(mockQueryByAlias).not.toHaveBeenCalled();
    expect(mockTransactWriteEntities).not.toHaveBeenCalled();
  });

  it("skips already-applied migrations", async () => {
    migrations.push({
      apply: vi.fn().mockResolvedValue([]),
      id: "001-test",
    });

    mockQueryByAlias.mockResolvedValue({
      alias: "001-test",
      createdAt: "",
      id: "001-test",
      model: "migration",
      name: "001-test",
      scope: "@",
      sequence: 1,
      updatedAt: "",
    });

    await runMigrations();

    expect(mockQueryByAlias).toHaveBeenCalledOnce();
    expect(mockTransactWriteEntities).not.toHaveBeenCalled();
    expect(migrations[0].apply).not.toHaveBeenCalled();
  });

  it("applies new migrations and writes migration record", async () => {
    const mockEntity = {
      alias: "test-hash",
      createdAt: "",
      id: "test-id",
      model: "apikey",
      name: "Test Key",
      scope: "@",
      sequence: 1,
      updatedAt: "",
    };

    migrations.push({
      apply: vi.fn().mockResolvedValue([mockEntity]),
      id: "001-test",
    });

    mockQueryByAlias.mockResolvedValue(null);

    await runMigrations();

    expect(mockTransactWriteEntities).toHaveBeenCalledOnce();

    const call = mockTransactWriteEntities.mock.calls[0][0];
    // Should include the seeded entity + the migration record
    expect(call.entities).toHaveLength(2);
    expect(call.entities[0]).toEqual(mockEntity);
    expect(call.entities[1]).toMatchObject({
      alias: "001-test",
      model: "migration",
      scope: "@",
    });
  });

  it("runs migrations sequentially", async () => {
    const order: string[] = [];

    migrations.push(
      {
        apply: vi.fn().mockImplementation(async () => {
          order.push("first");
          return [];
        }),
        id: "001-first",
      },
      {
        apply: vi.fn().mockImplementation(async () => {
          order.push("second");
          return [];
        }),
        id: "002-second",
      },
    );

    mockQueryByAlias.mockResolvedValue(null);

    await runMigrations();

    expect(order).toEqual(["first", "second"]);
    expect(mockTransactWriteEntities).toHaveBeenCalledTimes(2);
  });

  it("stops on error without writing migration record", async () => {
    migrations.push({
      apply: vi.fn().mockRejectedValue(new Error("Migration failed")),
      id: "001-fail",
    });

    mockQueryByAlias.mockResolvedValue(null);

    await expect(runMigrations()).rejects.toThrow("Migration failed");
    expect(mockTransactWriteEntities).not.toHaveBeenCalled();
  });
});
