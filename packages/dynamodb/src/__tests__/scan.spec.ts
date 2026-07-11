import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as clientModule from "../client.js";
import { countTable, scanTable } from "../scan.js";

const send = vi.fn();

vi.mock("../client.js", async () => {
  const actual = await vi.importActual("../client.js");
  return {
    ...actual,
    getDocClient: vi.fn(),
    getTableName: vi.fn(),
  };
});

describe("Scan Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientModule.getDocClient).mockReturnValue({
      send,
    } as unknown as ReturnType<typeof clientModule.getDocClient>);
    vi.mocked(clientModule.getTableName).mockReturnValue("default-table");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("scanTable", () => {
    it("is a function", () => {
      expect(scanTable).toBeFunction();
    });

    it("yields every item across pages", async () => {
      send
        .mockResolvedValueOnce({
          Items: [{ id: "a" }, { id: "b" }],
          LastEvaluatedKey: { id: "b" },
        })
        .mockResolvedValueOnce({ Items: [{ id: "c" }] });

      const items: Array<Record<string, unknown>> = [];
      for await (const item of scanTable()) {
        items.push(item);
      }

      expect(items).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
      expect(send).toHaveBeenCalledTimes(2);
    });

    it("defaults to the initialized table name", async () => {
      send.mockResolvedValueOnce({ Items: [] });

      for await (const _ of scanTable()) {
        // drain
      }
      const command = send.mock.calls[0][0];
      expect(command.input.TableName).toBe("default-table");
    });

    it("scans an explicit table name", async () => {
      send.mockResolvedValueOnce({ Items: [] });

      for await (const _ of scanTable({ tableName: "old-table" })) {
        // drain
      }
      const command = send.mock.calls[0][0];
      expect(command.input.TableName).toBe("old-table");
    });

    it("handles an empty table", async () => {
      send.mockResolvedValueOnce({ Items: [] });
      const items: Array<Record<string, unknown>> = [];
      for await (const item of scanTable()) {
        items.push(item);
      }
      expect(items).toEqual([]);
    });
  });

  describe("countTable", () => {
    it("is a function", () => {
      expect(countTable).toBeFunction();
    });

    it("sums counts across pages", async () => {
      send
        .mockResolvedValueOnce({ Count: 2, LastEvaluatedKey: { id: "b" } })
        .mockResolvedValueOnce({ Count: 3 });

      const count = await countTable({ tableName: "old-table" });
      expect(count).toBe(5);
      expect(send).toHaveBeenCalledTimes(2);
    });

    it("returns 0 for an empty table", async () => {
      send.mockResolvedValueOnce({ Count: 0 });
      expect(await countTable()).toBe(0);
    });
  });
});
