import { describe, expect, it } from "vitest";

import {
  CACHE_TTL_DEFAULT,
  promptCacheKey,
  resolveCache,
} from "../cacheControl.js";

describe("resolveCache", () => {
  it("Is a Function", () => {
    expect(resolveCache).toBeTypeOf("function");
  });

  it("Enables at default TTL for undefined and true", () => {
    expect(resolveCache(undefined)).toEqual({
      enabled: true,
      ttl: CACHE_TTL_DEFAULT,
    });
    expect(resolveCache(true)).toEqual({
      enabled: true,
      ttl: CACHE_TTL_DEFAULT,
    });
  });

  it("Disables for false and 0", () => {
    expect(resolveCache(false).enabled).toBe(false);
    expect(resolveCache(0).enabled).toBe(false);
  });

  it("Honors explicit TTL", () => {
    expect(resolveCache("5m")).toEqual({ enabled: true, ttl: "5m" });
    expect(resolveCache("1h")).toEqual({ enabled: true, ttl: "1h" });
  });

  it("Honors an overridden default TTL", () => {
    expect(resolveCache(undefined, { defaultTtl: "1h" })).toEqual({
      enabled: true,
      ttl: "1h",
    });
    expect(resolveCache(true, { defaultTtl: "1h" })).toEqual({
      enabled: true,
      ttl: "1h",
    });
    expect(resolveCache("5m", { defaultTtl: "1h" })).toEqual({
      enabled: true,
      ttl: "5m",
    });
    expect(resolveCache(false, { defaultTtl: "1h" }).enabled).toBe(false);
  });
});

describe("promptCacheKey", () => {
  it("Is deterministic for the same seed", () => {
    expect(promptCacheKey("abc")).toBe(promptCacheKey("abc"));
  });

  it("Differs for different seeds", () => {
    expect(promptCacheKey("abc")).not.toBe(promptCacheKey("abd"));
  });

  it("Is prefixed and non-empty", () => {
    expect(promptCacheKey("seed")).toMatch(/^jaypie-[0-9a-f]+$/);
  });
});
