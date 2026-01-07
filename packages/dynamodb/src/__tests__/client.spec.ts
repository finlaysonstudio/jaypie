import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getDocClient,
  getTableName,
  initClient,
  isInitialized,
  resetClient,
} from "../client.js";

// Mock AWS SDK
vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: vi.fn().mockImplementation(() => ({
      send: vi.fn(),
    })),
  },
}));

describe("Client", () => {
  beforeEach(() => {
    resetClient();
  });

  afterEach(() => {
    resetClient();
  });

  describe("initClient", () => {
    it("is a function", () => {
      expect(initClient).toBeFunction();
    });

    it("initializes the client with tableName", () => {
      initClient({ tableName: "test-table" });
      expect(isInitialized()).toBe(true);
    });

    it("sets the table name", () => {
      initClient({ tableName: "my-table" });
      expect(getTableName()).toBe("my-table");
    });

    it("can be called with optional endpoint", () => {
      expect(() =>
        initClient({
          endpoint: "http://localhost:8000",
          tableName: "test-table",
        }),
      ).not.toThrow();
    });

    it("can be called with optional region", () => {
      expect(() =>
        initClient({ region: "eu-west-1", tableName: "test-table" }),
      ).not.toThrow();
    });

    it("can be called with optional credentials", () => {
      expect(() =>
        initClient({
          credentials: { accessKeyId: "test", secretAccessKey: "test" },
          tableName: "test-table",
        }),
      ).not.toThrow();
    });
  });

  describe("getDocClient", () => {
    it("is a function", () => {
      expect(getDocClient).toBeFunction();
    });

    it("throws ConfigurationError when not initialized", () => {
      expect(() => getDocClient()).toThrow("DynamoDB client not initialized");
    });

    it("returns the client when initialized", () => {
      initClient({ tableName: "test-table" });
      expect(() => getDocClient()).not.toThrow();
      expect(getDocClient()).toBeDefined();
    });
  });

  describe("getTableName", () => {
    it("is a function", () => {
      expect(getTableName).toBeFunction();
    });

    it("throws ConfigurationError when not initialized", () => {
      expect(() => getTableName()).toThrow("DynamoDB client not initialized");
    });

    it("returns the table name when initialized", () => {
      initClient({ tableName: "my-table" });
      expect(getTableName()).toBe("my-table");
    });
  });

  describe("isInitialized", () => {
    it("is a function", () => {
      expect(isInitialized).toBeFunction();
    });

    it("returns false before initialization", () => {
      expect(isInitialized()).toBe(false);
    });

    it("returns true after initialization", () => {
      initClient({ tableName: "test-table" });
      expect(isInitialized()).toBe(true);
    });
  });

  describe("resetClient", () => {
    it("is a function", () => {
      expect(resetClient).toBeFunction();
    });

    it("resets the client state", () => {
      initClient({ tableName: "test-table" });
      expect(isInitialized()).toBe(true);
      resetClient();
      expect(isInitialized()).toBe(false);
    });
  });
});
