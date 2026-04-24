import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { ConfigurationError } from "@jaypie/errors";
import { clearRegistry, fabricIndex, registerModel } from "@jaypie/fabric";

import * as clientModule from "../client.js";
import {
  queryByAlias,
  queryByCategory,
  queryByScope,
  queryByType,
  queryByXid,
} from "../queries.js";

const mockSend = vi.fn();

vi.spyOn(clientModule, "getDocClient").mockReturnValue({
  send: mockSend,
} as unknown as ReturnType<typeof clientModule.getDocClient>);
vi.spyOn(clientModule, "getTableName").mockReturnValue("test-table");

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
  // "minimal" only has the base index — used to verify queryByCategory throws
  registerModel({
    model: "minimal",
    indexes: [fabricIndex()],
  });
});

describe("Query Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({ Items: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("queryByScope", () => {
    it("uses indexModel GSI and partitions by model", async () => {
      await queryByScope({ model: "record", scope: "@" });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.IndexName).toBe("indexModel");
      expect(cmd.input.ExpressionAttributeValues[":pkValue"]).toBe("record");
    });

    it("applies scope as a begins_with sk prefix", async () => {
      await queryByScope({ model: "record", scope: "@" });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.KeyConditionExpression).toBe(
        "#pk = :pkValue AND begins_with(#sk, :skPrefix)",
      );
      expect(cmd.input.ExpressionAttributeNames["#sk"]).toBe("indexModelSk");
      expect(cmd.input.ExpressionAttributeValues[":skPrefix"]).toBe("@#");
    });

    it("omits sk condition when scope is not provided (cross-scope)", async () => {
      await queryByScope({ model: "record" });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.KeyConditionExpression).toBe("#pk = :pkValue");
      expect(cmd.input.ExpressionAttributeNames["#sk"]).toBeUndefined();
    });

    it("supports a hierarchical scope prefix", async () => {
      await queryByScope({ model: "record", scope: "chat#abc-123" });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.ExpressionAttributeValues[":skPrefix"]).toBe(
        "chat#abc-123#",
      );
    });

    it("defaults to descending order (most recent first)", async () => {
      await queryByScope({ model: "record", scope: "@" });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.ScanIndexForward).toBe(false);
    });

    it("supports ascending order", async () => {
      await queryByScope({ ascending: true, model: "record", scope: "@" });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.ScanIndexForward).toBe(true);
    });

    it("passes limit and startKey through", async () => {
      const startKey = { id: "some-id" };
      await queryByScope({ limit: 10, model: "record", scope: "@", startKey });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Limit).toBe(10);
      expect(cmd.input.ExclusiveStartKey).toEqual(startKey);
    });

    it("returns lastEvaluatedKey for pagination", async () => {
      const lastKey = { id: "last-id" };
      mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: lastKey });
      const result = await queryByScope({ model: "record", scope: "@" });
      expect(result.lastEvaluatedKey).toEqual(lastKey);
    });

    it("does not use FilterExpression", async () => {
      await queryByScope({ model: "record", scope: "@" });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.FilterExpression).toBeUndefined();
    });
  });

  describe("queryByAlias", () => {
    it("returns null when no items found", async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });
      const result = await queryByAlias({
        alias: "my-alias",
        model: "record",
        scope: "@",
      });
      expect(result).toBeNull();
    });

    it("returns the first item when found", async () => {
      const mockItem = { id: "123", model: "record", name: "Test" };
      mockSend.mockResolvedValueOnce({ Items: [mockItem] });
      const result = await queryByAlias({
        alias: "my-alias",
        model: "record",
        scope: "@",
      });
      expect(result).toEqual(mockItem);
    });

    it("uses indexModelAlias GSI", async () => {
      await queryByAlias({ alias: "my-alias", model: "record", scope: "@" });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.IndexName).toBe("indexModelAlias");
    });

    it("builds pk as model#alias and sk prefix as scope#", async () => {
      await queryByAlias({ alias: "my-alias", model: "record", scope: "@" });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "record#my-alias",
      );
      expect(cmd.input.ExpressionAttributeValues[":skPrefix"]).toBe("@#");
    });

    it("scope is optional (cross-scope lookup)", async () => {
      await queryByAlias({ alias: "my-alias", model: "record" });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.KeyConditionExpression).toBe("#pk = :pkValue");
    });

    it("limits to 1 result", async () => {
      await queryByAlias({ alias: "my-alias", model: "record", scope: "@" });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Limit).toBe(1);
    });
  });

  describe("queryByCategory", () => {
    it("uses indexModelCategory GSI", async () => {
      await queryByCategory({
        category: "memory",
        model: "record",
        scope: "@",
      });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.IndexName).toBe("indexModelCategory");
    });

    it("builds pk as model#category", async () => {
      await queryByCategory({
        category: "memory",
        model: "record",
        scope: "@",
      });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "record#memory",
      );
    });

    it("throws ConfigurationError when model did not register a category index", async () => {
      await expect(
        queryByCategory({
          category: "memory",
          model: "minimal",
          scope: "@",
        }),
      ).rejects.toThrow(ConfigurationError);
    });
  });

  describe("queryByType", () => {
    it("uses indexModelType GSI", async () => {
      await queryByType({ model: "record", scope: "@", type: "note" });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.IndexName).toBe("indexModelType");
    });

    it("builds pk as model#type", async () => {
      await queryByType({ model: "record", scope: "@", type: "note" });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "record#note",
      );
    });

    it("throws ConfigurationError when model did not register a type index", async () => {
      await expect(
        queryByType({ model: "minimal", scope: "@", type: "note" }),
      ).rejects.toThrow(ConfigurationError);
    });
  });

  describe("queryByXid", () => {
    it("returns null when no items found", async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });
      const result = await queryByXid({
        model: "record",
        scope: "@",
        xid: "ext-123",
      });
      expect(result).toBeNull();
    });

    it("returns the first item when found", async () => {
      const mockItem = { id: "123", model: "record", xid: "ext-123" };
      mockSend.mockResolvedValueOnce({ Items: [mockItem] });
      const result = await queryByXid({
        model: "record",
        scope: "@",
        xid: "ext-123",
      });
      expect(result).toEqual(mockItem);
    });

    it("uses indexModelXid GSI and model#xid pk", async () => {
      await queryByXid({ model: "record", scope: "@", xid: "ext-123" });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.IndexName).toBe("indexModelXid");
      expect(cmd.input.ExpressionAttributeValues[":pkValue"]).toBe(
        "record#ext-123",
      );
    });

    it("limits to 1 result", async () => {
      await queryByXid({ model: "record", scope: "@", xid: "ext-123" });
      const cmd = mockSend.mock.calls[0][0];
      expect(cmd.input.Limit).toBe(1);
    });
  });

  describe("Soft State Query Options", () => {
    describe("deleted suffix on pk", () => {
      it("queryByScope appends #deleted", async () => {
        await queryByScope({ deleted: true, model: "record", scope: "@" });
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":pkValue"]).toBe(
          "record#deleted",
        );
      });

      it("queryByAlias appends #deleted to model#alias pk", async () => {
        await queryByAlias({
          alias: "my-alias",
          deleted: true,
          model: "record",
          scope: "@",
        });
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":pkValue"]).toBe(
          "record#my-alias#deleted",
        );
      });

      it("queryByXid appends #deleted to model#xid pk", async () => {
        await queryByXid({
          deleted: true,
          model: "record",
          scope: "@",
          xid: "ext-123",
        });
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":pkValue"]).toBe(
          "record#ext-123#deleted",
        );
      });
    });

    describe("archived suffix on pk", () => {
      it("queryByScope appends #archived", async () => {
        await queryByScope({ archived: true, model: "record", scope: "@" });
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":pkValue"]).toBe(
          "record#archived",
        );
      });

      it("queryByCategory appends #archived to model#category pk", async () => {
        await queryByCategory({
          archived: true,
          category: "memory",
          model: "record",
          scope: "@",
        });
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":pkValue"]).toBe(
          "record#memory#archived",
        );
      });
    });

    describe("combined archived + deleted", () => {
      it("queryByScope appends #archived#deleted", async () => {
        await queryByScope({
          archived: true,
          deleted: true,
          model: "record",
          scope: "@",
        });
        const cmd = mockSend.mock.calls[0][0];
        expect(cmd.input.ExpressionAttributeValues[":pkValue"]).toBe(
          "record#archived#deleted",
        );
      });
    });
  });
});
