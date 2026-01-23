// Tests for FabricData CRUD adapter

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  APEX,
  capitalize,
  decodeCursor,
  DEFAULT_LIMIT,
  encodeCursor,
  extractId,
  extractScopeContext,
  FabricData,
  isFabricDataResult,
  MAX_LIMIT,
  pluralize,
  transformArchive,
  transformCreate,
  transformDelete,
  transformExecute,
  transformList,
  transformRead,
  transformUpdate,
} from "../data/index.js";
import type { HttpContext } from "../http/types.js";

// Mock @jaypie/dynamodb
vi.mock("@jaypie/dynamodb", () => ({
  archiveEntity: vi.fn().mockResolvedValue(true),
  deleteEntity: vi.fn().mockResolvedValue(true),
  getEntity: vi.fn().mockResolvedValue(null),
  putEntity: vi.fn().mockImplementation(async ({ entity }) => ({
    ...entity,
    indexScope: "@#record",
  })),
  queryByScope: vi
    .fn()
    .mockResolvedValue({ items: [], lastEvaluatedKey: undefined }),
  updateEntity: vi.fn().mockImplementation(async ({ entity }) => ({
    ...entity,
    updatedAt: new Date().toISOString(),
  })),
}));

describe("FabricData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // #region Transform Utilities

  describe("Transform Utilities", () => {
    describe("extractId", () => {
      it("is a function", () => {
        expect(extractId).toBeFunction();
      });

      it("extracts id from params", () => {
        const context = {
          body: {},
          headers: new Headers(),
          method: "GET",
          params: { id: "123" },
          path: "/records/123",
          query: new URLSearchParams(),
        } as HttpContext;
        expect(extractId(context)).toBe("123");
      });

      it("returns undefined when id is missing", () => {
        const context = {
          body: {},
          headers: new Headers(),
          method: "GET",
          params: {},
          path: "/records",
          query: new URLSearchParams(),
        } as HttpContext;
        expect(extractId(context)).toBeUndefined();
      });
    });

    describe("extractScopeContext", () => {
      it("is a function", () => {
        expect(extractScopeContext).toBeFunction();
      });

      it("extracts scope context from HTTP context", () => {
        const context = {
          body: { name: "Test" },
          headers: new Headers(),
          method: "POST",
          params: { id: "123" },
          path: "/records/123",
          query: new URLSearchParams("limit=10"),
        } as HttpContext;
        const scopeContext = extractScopeContext(context);
        expect(scopeContext.body).toEqual({ name: "Test" });
        expect(scopeContext.params).toEqual({ id: "123" });
        expect(scopeContext.query.get("limit")).toBe("10");
      });
    });

    describe("transformCreate", () => {
      it("is a function", () => {
        expect(transformCreate).toBeFunction();
      });

      it("extracts body fields", () => {
        const context = {
          body: { name: "Test Record", description: "A test" },
          headers: new Headers(),
          method: "POST",
          params: {},
          path: "/records",
          query: new URLSearchParams(),
        } as HttpContext;
        const result = transformCreate(context);
        expect(result).toEqual({ name: "Test Record", description: "A test" });
      });
    });

    describe("transformRead", () => {
      it("is a function", () => {
        expect(transformRead).toBeFunction();
      });

      it("extracts id from params", () => {
        const context = {
          body: {},
          headers: new Headers(),
          method: "GET",
          params: { id: "abc-123" },
          path: "/records/abc-123",
          query: new URLSearchParams(),
        } as HttpContext;
        const result = transformRead(context);
        expect(result).toEqual({ id: "abc-123" });
      });

      it("throws when id is missing", () => {
        const context = {
          body: {},
          headers: new Headers(),
          method: "GET",
          params: {},
          path: "/records",
          query: new URLSearchParams(),
        } as HttpContext;
        expect(() => transformRead(context)).toThrow("Missing id parameter");
      });
    });

    describe("transformUpdate", () => {
      it("is a function", () => {
        expect(transformUpdate).toBeFunction();
      });

      it("extracts id and merges with body", () => {
        const context = {
          body: { name: "Updated Name" },
          headers: new Headers(),
          method: "POST",
          params: { id: "abc-123" },
          path: "/records/abc-123",
          query: new URLSearchParams(),
        } as HttpContext;
        const result = transformUpdate(context);
        expect(result).toEqual({ id: "abc-123", name: "Updated Name" });
      });

      it("throws when id is missing", () => {
        const context = {
          body: { name: "Test" },
          headers: new Headers(),
          method: "POST",
          params: {},
          path: "/records",
          query: new URLSearchParams(),
        } as HttpContext;
        expect(() => transformUpdate(context)).toThrow("Missing id parameter");
      });
    });

    describe("transformDelete", () => {
      it("is a function", () => {
        expect(transformDelete).toBeFunction();
      });

      it("extracts id from params", () => {
        const context = {
          body: {},
          headers: new Headers(),
          method: "DELETE",
          params: { id: "abc-123" },
          path: "/records/abc-123",
          query: new URLSearchParams(),
        } as HttpContext;
        const result = transformDelete(context);
        expect(result).toEqual({ id: "abc-123" });
      });
    });

    describe("transformArchive", () => {
      it("is a function", () => {
        expect(transformArchive).toBeFunction();
      });

      it("extracts id from params", () => {
        const context = {
          body: {},
          headers: new Headers(),
          method: "POST",
          params: { id: "abc-123" },
          path: "/records/abc-123/archive",
          query: new URLSearchParams(),
        } as HttpContext;
        const result = transformArchive(context);
        expect(result).toEqual({ id: "abc-123" });
      });
    });

    describe("transformList", () => {
      it("is a function", () => {
        expect(transformList).toBeFunction();
      });

      it("extracts pagination options from query", () => {
        const context = {
          body: {},
          headers: new Headers(),
          method: "GET",
          params: {},
          path: "/records",
          query: new URLSearchParams("limit=50&cursor=abc&ascending=true"),
        } as HttpContext;
        const result = transformList(context);
        expect(result.limit).toBe(50);
        expect(result.startKey).toBe("abc");
        expect(result.ascending).toBe(true);
      });

      it("uses default limit when not specified", () => {
        const context = {
          body: {},
          headers: new Headers(),
          method: "GET",
          params: {},
          path: "/records",
          query: new URLSearchParams(),
        } as HttpContext;
        const result = transformList(context);
        expect(result.limit).toBe(DEFAULT_LIMIT);
      });

      it("caps limit at max", () => {
        const context = {
          body: {},
          headers: new Headers(),
          method: "GET",
          params: {},
          path: "/records",
          query: new URLSearchParams("limit=500"),
        } as HttpContext;
        const result = transformList(context);
        expect(result.limit).toBe(MAX_LIMIT);
      });

      it("parses archived and deleted flags", () => {
        const context = {
          body: {},
          headers: new Headers(),
          method: "GET",
          params: {},
          path: "/records",
          query: new URLSearchParams("archived=true&deleted=true"),
        } as HttpContext;
        const result = transformList(context);
        expect(result.archived).toBe(true);
        expect(result.deleted).toBe(true);
      });
    });

    describe("transformExecute", () => {
      it("is a function", () => {
        expect(transformExecute).toBeFunction();
      });

      it("extracts id and merges with body", () => {
        const context = {
          body: { publishDate: "2024-01-01" },
          headers: new Headers(),
          method: "POST",
          params: { id: "abc-123" },
          path: "/records/abc-123/publish",
          query: new URLSearchParams(),
        } as HttpContext;
        const result = transformExecute(context);
        expect(result).toEqual({ id: "abc-123", publishDate: "2024-01-01" });
      });
    });
  });

  // #endregion

  // #region Helper Utilities

  describe("Helper Utilities", () => {
    describe("pluralize", () => {
      it("is a function", () => {
        expect(pluralize).toBeFunction();
      });

      it("adds s to regular words", () => {
        expect(pluralize("record")).toBe("records");
        expect(pluralize("user")).toBe("users");
      });

      it("handles words ending in y", () => {
        expect(pluralize("category")).toBe("categories");
        expect(pluralize("entry")).toBe("entries");
      });

      it("handles words ending in s", () => {
        expect(pluralize("status")).toBe("status");
      });

      it("handles words ending in x, ch, sh", () => {
        expect(pluralize("box")).toBe("boxes");
        expect(pluralize("match")).toBe("matches");
        expect(pluralize("wish")).toBe("wishes");
      });
    });

    describe("capitalize", () => {
      it("is a function", () => {
        expect(capitalize).toBeFunction();
      });

      it("capitalizes first letter", () => {
        expect(capitalize("record")).toBe("Record");
        expect(capitalize("user")).toBe("User");
      });

      it("handles empty string", () => {
        expect(capitalize("")).toBe("");
      });

      it("handles single character", () => {
        expect(capitalize("a")).toBe("A");
      });
    });

    describe("encodeCursor / decodeCursor", () => {
      it("encodes and decodes cursor", () => {
        const key = { model: "record", id: "123" };
        const encoded = encodeCursor(key);
        expect(encoded).toBeString();
        const decoded = decodeCursor(encoded);
        expect(decoded).toEqual(key);
      });

      it("returns undefined for undefined input", () => {
        expect(encodeCursor(undefined)).toBeUndefined();
        expect(decodeCursor(undefined)).toBeUndefined();
      });

      it("returns undefined for invalid cursor", () => {
        expect(decodeCursor("not-valid-base64!@#")).toBeUndefined();
      });
    });
  });

  // #endregion

  // #region Constants

  describe("Constants", () => {
    it("exports APEX", () => {
      expect(APEX).toBe("@");
    });

    it("exports DEFAULT_LIMIT", () => {
      expect(DEFAULT_LIMIT).toBe(20);
    });

    it("exports MAX_LIMIT", () => {
      expect(MAX_LIMIT).toBe(100);
    });
  });

  // #endregion

  // #region FabricData Function

  describe("FabricData Function", () => {
    it("is a function", () => {
      expect(FabricData).toBeFunction();
    });

    it("returns FabricDataResult", () => {
      const result = FabricData({ model: "record" });
      expect(result).toHaveProperty("model");
      expect(result).toHaveProperty("prefix");
      expect(result).toHaveProperty("services");
    });

    it("sets model alias correctly", () => {
      const result = FabricData({ model: "record" });
      expect(result.model).toBe("record");
    });

    it("sets prefix to pluralized model", () => {
      const result = FabricData({ model: "record" });
      expect(result.prefix).toBe("/records");
    });

    it("creates all CRUD services by default", () => {
      const result = FabricData({ model: "record" });
      expect(result.services.length).toBe(6); // create, list, read, update, delete, archive
    });

    it("accepts model as object", () => {
      const result = FabricData({
        model: { alias: "widget", name: "Widget" },
      });
      expect(result.model).toBe("widget");
      expect(result.prefix).toBe("/widgets");
    });

    it("disables operations when set to false", () => {
      const result = FabricData({
        model: "record",
        operations: {
          archive: false,
          delete: false,
        },
      });
      // Should have 4 services (create, list, read, update)
      expect(result.services.length).toBe(4);
    });

    it("adds execute actions", () => {
      const result = FabricData({
        model: "record",
        execute: [
          {
            alias: "publish",
            service: async () => ({ published: true }),
          },
          {
            alias: "duplicate",
            service: async () => ({ duplicated: true }),
          },
        ],
      });
      // Should have 8 services (6 CRUD + 2 execute)
      expect(result.services.length).toBe(8);
    });
  });

  // #endregion

  // #region isFabricDataResult

  describe("isFabricDataResult", () => {
    it("is a function", () => {
      expect(isFabricDataResult).toBeFunction();
    });

    it("returns true for valid result", () => {
      const result = FabricData({ model: "record" });
      expect(isFabricDataResult(result)).toBe(true);
    });

    it("returns false for non-object", () => {
      expect(isFabricDataResult(null)).toBe(false);
      expect(isFabricDataResult("string")).toBe(false);
      expect(isFabricDataResult(123)).toBe(false);
    });

    it("returns false for object missing properties", () => {
      expect(isFabricDataResult({ model: "test" })).toBe(false);
      expect(isFabricDataResult({ prefix: "/test" })).toBe(false);
      expect(isFabricDataResult({ services: [] })).toBe(false);
    });
  });

  // #endregion

  // #region Service Generation

  describe("Service Generation", () => {
    it("generates services with correct aliases", () => {
      const result = FabricData({ model: "record" });
      const aliases = result.services.map((s) => s.alias);
      expect(aliases).toContain("create-record");
      expect(aliases).toContain("list-records");
      expect(aliases).toContain("read-record");
      expect(aliases).toContain("update-record");
      expect(aliases).toContain("delete-record");
      expect(aliases).toContain("archive-record");
    });

    it("applies global authorization to all services", () => {
      const authFn = async () => ({ userId: "123" });
      const result = FabricData({
        model: "record",
        authorization: authFn,
      });
      result.services.forEach((service) => {
        expect(service.authorization).toBe(authFn);
      });
    });

    it("allows per-operation authorization override", () => {
      const globalAuth = async () => ({ role: "user" });
      const adminAuth = async () => ({ role: "admin" });
      const result = FabricData({
        model: "record",
        authorization: globalAuth,
        operations: {
          delete: { authorization: adminAuth },
          read: { authorization: false },
        },
      });

      const readService = result.services.find(
        (s) => s.alias === "read-record",
      );
      const deleteService = result.services.find(
        (s) => s.alias === "delete-record",
      );
      const createService = result.services.find(
        (s) => s.alias === "create-record",
      );

      expect(readService?.authorization).toBe(false);
      expect(deleteService?.authorization).toBe(adminAuth);
      expect(createService?.authorization).toBe(globalAuth);
    });
  });

  // #endregion
});
