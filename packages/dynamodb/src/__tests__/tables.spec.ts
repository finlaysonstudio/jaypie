import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as clientModule from "../client.js";
import { createTable, destroyTable } from "../tables.js";

const send = vi.fn();

vi.mock("@aws-sdk/client-dynamodb", () => ({
  CreateTableCommand: vi.fn(function CreateTableCommand(input) {
    return { input };
  }),
  DeleteTableCommand: vi.fn(function DeleteTableCommand(input) {
    return { input };
  }),
  DescribeTableCommand: vi.fn(function DescribeTableCommand(input) {
    return { input };
  }),
  waitUntilTableExists: vi.fn().mockResolvedValue({ state: "SUCCESS" }),
}));

vi.mock("@jaypie/fabric", async () => {
  const actual = await vi.importActual("@jaypie/fabric");
  return {
    ...actual,
    getAllRegisteredIndexes: vi.fn().mockReturnValue([]),
  };
});

vi.mock("../client.js", async () => {
  const actual = await vi.importActual("../client.js");
  return {
    ...actual,
    getClient: vi.fn(),
    getTableName: vi.fn(),
  };
});

const notFound = Object.assign(new Error("not found"), {
  name: "ResourceNotFoundException",
});

describe("Table Administration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientModule.getClient).mockReturnValue({
      send,
    } as unknown as ReturnType<typeof clientModule.getClient>);
    vi.mocked(clientModule.getTableName).mockReturnValue("default-table");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createTable", () => {
    it("is a function", () => {
      expect(createTable).toBeFunction();
    });

    it("creates a new table and waits for ACTIVE", async () => {
      send
        .mockRejectedValueOnce(notFound) // DescribeTable -> not found
        .mockResolvedValueOnce({}); // CreateTable

      const { CreateTableCommand, waitUntilTableExists } =
        await import("@aws-sdk/client-dynamodb");

      const result = await createTable({ tableName: "new-table" });

      expect(result.created).toBe(true);
      expect(result.tableName).toBe("new-table");
      expect(CreateTableCommand).toHaveBeenCalled();
      expect(waitUntilTableExists).toHaveBeenCalled();
    });

    it("does not wait when wait is false", async () => {
      send.mockRejectedValueOnce(notFound).mockResolvedValueOnce({});
      const { waitUntilTableExists } = await import("@aws-sdk/client-dynamodb");

      await createTable({ tableName: "new-table", wait: false });
      expect(waitUntilTableExists).not.toHaveBeenCalled();
    });

    it("returns created: false when the table already exists", async () => {
      send.mockResolvedValueOnce({ Table: { TableName: "existing" } });
      const { CreateTableCommand } = await import("@aws-sdk/client-dynamodb");

      const result = await createTable({ tableName: "existing" });

      expect(result.created).toBe(false);
      expect(CreateTableCommand).not.toHaveBeenCalled();
    });

    it("defaults to the initialized table name", async () => {
      send.mockRejectedValueOnce(notFound).mockResolvedValueOnce({});
      const result = await createTable();
      expect(result.tableName).toBe("default-table");
    });

    it("rethrows non-NotFound describe errors", async () => {
      send.mockRejectedValueOnce(new Error("boom"));
      await expect(createTable({ tableName: "x" })).rejects.toThrow("boom");
    });
  });

  describe("destroyTable", () => {
    it("is a function", () => {
      expect(destroyTable).toBeFunction();
    });

    it("deletes the named table", async () => {
      send.mockResolvedValueOnce({});
      const { DeleteTableCommand } = await import("@aws-sdk/client-dynamodb");

      const result = await destroyTable({ tableName: "old-table" });

      expect(result.destroyed).toBe(true);
      expect(result.tableName).toBe("old-table");
      expect(DeleteTableCommand).toHaveBeenCalledWith({
        TableName: "old-table",
      });
    });
  });
});
