import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock @jaypie/dynamodb
vi.mock("@jaypie/dynamodb", async () => {
  const actual = await vi.importActual<typeof import("@jaypie/dynamodb")>(
    "@jaypie/dynamodb",
  );
  return {
    ...actual,
  };
});

// Mock @jaypie/fabric registerModel
vi.mock("@jaypie/fabric", async () => {
  const actual =
    await vi.importActual<typeof import("@jaypie/fabric")>("@jaypie/fabric");
  return {
    ...actual,
    registerModel: vi.fn(),
  };
});

import migration from "../migrations/001-seed-owner-apikey.js";

describe("001-seed-owner-apikey", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it("has correct id", () => {
    expect(migration.id).toBe("001-seed-owner-apikey");
  });

  it("has an apply function", () => {
    expect(migration.apply).toBeTypeOf("function");
  });

  it("returns empty array when PROJECT_ADMIN_SEED is not set", async () => {
    delete process.env.PROJECT_ADMIN_SEED;

    const entities = await migration.apply();

    expect(entities).toEqual([]);
  });

  it("returns apikey entity when PROJECT_ADMIN_SEED is set", async () => {
    process.env.PROJECT_ADMIN_SEED = "test-seed-value-for-testing";

    const entities = await migration.apply();

    expect(entities).toHaveLength(1);
    expect(entities[0]).toMatchObject({
      model: "apikey",
      name: "owner-seed-apikey",
      scope: "@",
    });
    expect(entities[0]).not.toHaveProperty("category");
    expect(entities[0]).not.toHaveProperty("type");
    expect(entities[0].alias).toBeDefined();
    expect(entities[0].id).toBeDefined();
    expect(entities[0].createdAt).toBeDefined();
    expect(entities[0].sequence).toBeTypeOf("number");
  });

  it("generates deterministic key from seed", async () => {
    process.env.PROJECT_ADMIN_SEED = "deterministic-seed";

    const entities1 = await migration.apply();
    const entities2 = await migration.apply();

    // Same seed should produce same hash (alias)
    expect(entities1[0].alias).toBe(entities2[0].alias);
  });
});
