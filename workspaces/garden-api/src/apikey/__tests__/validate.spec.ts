import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@jaypie/dynamodb", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@jaypie/dynamodb")>();
  return {
    ...actual,
    initClient: vi.fn(),
    queryByAlias: vi.fn().mockResolvedValue(null),
  };
});

vi.mock("@jaypie/fabric", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@jaypie/fabric")>();
  return {
    ...actual,
    registerModel: vi.fn(),
  };
});

import { queryByAlias } from "@jaypie/dynamodb";

import { extractToken, validateApiKey } from "../validate.js";

//
//
// Constants
//

// The testkit mock returns "0".repeat(64) for hashJaypieKey
const MOCK_HASH = "0".repeat(64);

// Any valid-format key (mock validateJaypieKey always returns true)
const TEST_KEY = "sk_jaypie_any-valid-key";

//
//
// Tests
//

describe("extractToken", () => {
  it("is a function", () => {
    expect(typeof extractToken).toBe("function");
  });

  it("extracts token from Bearer header", () => {
    expect(extractToken("Bearer sk_jaypie_abc123")).toBe("sk_jaypie_abc123");
  });

  it("is case-insensitive for Bearer prefix", () => {
    expect(extractToken("bearer sk_jaypie_abc123")).toBe("sk_jaypie_abc123");
  });

  it("returns undefined for missing header", () => {
    expect(extractToken(undefined)).toBeUndefined();
  });

  it("returns undefined for malformed header", () => {
    expect(extractToken("sk_jaypie_abc123")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(extractToken("")).toBeUndefined();
  });
});

describe("validateApiKey", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("is a function", () => {
    expect(typeof validateApiKey).toBe("function");
  });

  it("throws UnauthorizedError for invalid format", async () => {
    // Override the mock to return false for this test
    const { validateJaypieKey } = await import("jaypie");
    vi.mocked(validateJaypieKey).mockReturnValueOnce(false);

    await expect(validateApiKey("bad-key")).rejects.toThrow();
  });

  it("returns valid result when key found in database", async () => {
    vi.mocked(queryByAlias).mockResolvedValueOnce({
      alias: MOCK_HASH,
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

    const result = await validateApiKey(TEST_KEY);
    expect(result).toEqual({ level: "owner", valid: true });
  });

  it("throws ForbiddenError when key not found in database", async () => {
    vi.mocked(queryByAlias).mockResolvedValueOnce(null);

    await expect(validateApiKey(TEST_KEY)).rejects.toThrow();
  });

  it("looks up key by hash alias", async () => {
    vi.mocked(queryByAlias).mockResolvedValueOnce(null);

    try {
      await validateApiKey(TEST_KEY);
    } catch {
      // Expected to throw
    }

    expect(queryByAlias).toHaveBeenCalledWith({
      alias: MOCK_HASH,
      model: "apikey",
      scope: "@",
    });
  });
});
