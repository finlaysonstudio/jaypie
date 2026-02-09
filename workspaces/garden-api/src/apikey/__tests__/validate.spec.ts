import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@jaypie/dynamodb", () => ({
  APEX: "@",
  initClient: vi.fn(),
  putEntity: vi.fn().mockResolvedValue({}),
  queryByAlias: vi.fn().mockResolvedValue(null),
}));

vi.mock("@jaypie/errors", async () => {
  const actual = await vi.importActual("@jaypie/errors");
  return actual;
});

vi.mock("@jaypie/logger", () => ({
  log: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
  },
}));

import { putEntity, queryByAlias } from "@jaypie/dynamodb";

import { generateKeyFromSeed, hashKey } from "../generate.js";
import { extractToken, validateApiKey } from "../validate.js";

//
//
// Tests
//

describe("extractToken", () => {
  it("is a function", () => {
    expect(typeof extractToken).toBe("function");
  });

  it("extracts token from Bearer header", () => {
    expect(extractToken("Bearer sk_jpi_abc123")).toBe("sk_jpi_abc123");
  });

  it("is case-insensitive for Bearer prefix", () => {
    expect(extractToken("bearer sk_jpi_abc123")).toBe("sk_jpi_abc123");
  });

  it("returns undefined for missing header", () => {
    expect(extractToken(undefined)).toBeUndefined();
  });

  it("returns undefined for malformed header", () => {
    expect(extractToken("sk_jpi_abc123")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(extractToken("")).toBeUndefined();
  });
});

describe("validateApiKey", () => {
  const SEED = "test-admin-seed";
  const SEED_KEY = generateKeyFromSeed(SEED);
  const SEED_HASH = hashKey(SEED_KEY);

  beforeEach(() => {
    process.env.PROJECT_ADMIN_SEED = SEED;
  });

  afterEach(() => {
    delete process.env.PROJECT_ADMIN_SEED;
    vi.clearAllMocks();
  });

  it("is a function", () => {
    expect(typeof validateApiKey).toBe("function");
  });

  it("throws UnauthorizedError for invalid format", async () => {
    await expect(validateApiKey("bad-key")).rejects.toThrow();
  });

  it("returns valid result when key found in database", async () => {
    vi.mocked(queryByAlias).mockResolvedValueOnce({
      alias: SEED_HASH,
      category: "owner",
      createdAt: new Date().toISOString(),
      id: "test-id",
      model: "apikey",
      name: "Owner Key",
      scope: "@",
      sequence: Date.now(),
      type: "seed",
      updatedAt: new Date().toISOString(),
    });

    const result = await validateApiKey(SEED_KEY);
    expect(result).toEqual({ level: "owner", valid: true });
  });

  it("auto-provisions seed key when not in database", async () => {
    vi.mocked(queryByAlias).mockResolvedValueOnce(null);

    const result = await validateApiKey(SEED_KEY);
    expect(result).toEqual({ level: "owner", valid: true });
    expect(putEntity).toHaveBeenCalledOnce();
  });

  it("stores hashed key as alias when provisioning", async () => {
    vi.mocked(queryByAlias).mockResolvedValueOnce(null);

    await validateApiKey(SEED_KEY);

    expect(putEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: expect.objectContaining({
          alias: SEED_HASH,
          category: "owner",
          label: SEED_KEY.slice(-4),
          model: "apikey",
          scope: "@",
          type: "seed",
        }),
      }),
    );
  });

  it("throws ForbiddenError for unrecognized valid-format key", async () => {
    const otherKey = generateKeyFromSeed("different-seed");
    vi.mocked(queryByAlias).mockResolvedValueOnce(null);

    await expect(validateApiKey(otherKey)).rejects.toThrow();
  });

  it("throws ForbiddenError when no seed configured and key not in DB", async () => {
    delete process.env.PROJECT_ADMIN_SEED;
    const otherKey = generateKeyFromSeed("any-seed");
    vi.mocked(queryByAlias).mockResolvedValueOnce(null);

    await expect(validateApiKey(otherKey)).rejects.toThrow();
  });
});
