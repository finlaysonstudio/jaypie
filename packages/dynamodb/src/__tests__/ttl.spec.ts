import log from "@jaypie/logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveTtl } from "../ttl.js";

// Fixed "now": 2026-07-20T00:00:00.000Z => 1784937600 epoch seconds
const NOW_MS = Date.parse("2026-07-20T00:00:00.000Z");
const NOW_SECONDS = Math.floor(NOW_MS / 1000);
const DAY = 60 * 60 * 24;

describe("resolveTtl", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("number input (epoch seconds)", () => {
    it("returns a future epoch value unchanged (floored)", () => {
      const future = NOW_SECONDS + DAY + 0.9;
      expect(resolveTtl(future)).toBe(Math.floor(future));
    });

    it("throws BadRequestError on a non-finite number", () => {
      expect(() => resolveTtl(Number.NaN)).toThrowJaypieError();
      expect(() => resolveTtl(Number.POSITIVE_INFINITY)).toThrowJaypieError();
    });
  });

  describe("duration string input", () => {
    it("resolves fixed units against now", () => {
      expect(resolveTtl("1 day")).toBe(NOW_SECONDS + DAY);
      expect(resolveTtl("4 weeks")).toBe(NOW_SECONDS + DAY * 7 * 4);
      expect(resolveTtl("2 hours")).toBe(NOW_SECONDS + 60 * 60 * 2);
    });

    it("treats a month as 31 days and a year as 366 days", () => {
      expect(resolveTtl("1 month")).toBe(NOW_SECONDS + DAY * 31);
      expect(resolveTtl("1 year")).toBe(NOW_SECONDS + DAY * 366);
    });

    it("accepts singular, plural, and surrounding whitespace", () => {
      expect(resolveTtl("1 day")).toBe(resolveTtl("1 days"));
      expect(resolveTtl("  3 weeks  ")).toBe(NOW_SECONDS + DAY * 7 * 3);
    });
  });

  describe("ISO 8601 date string input", () => {
    it("resolves a future ISO date to epoch seconds", () => {
      const iso = "2026-07-21T00:00:00.000Z";
      expect(resolveTtl(iso)).toBe(Math.floor(Date.parse(iso) / 1000));
    });

    it("throws BadRequestError on an unparseable string", () => {
      expect(() => resolveTtl("not a date")).toThrowJaypieError();
      // Dashed pseudo-ISO is not accepted (standard ISO only)
      expect(() => resolveTtl("2026-07-20T04-59-16-368Z")).toThrowJaypieError();
    });
  });

  describe("non-future values", () => {
    it("returns the value but logs an error on a past duration/date", () => {
      const spy = vi.spyOn(log, "error").mockImplementation(() => log);
      const past = "2020-01-01T00:00:00.000Z";
      const result = resolveTtl(past);
      expect(result).toBe(Math.floor(Date.parse(past) / 1000));
      expect(spy).toHaveBeenCalled();
    });

    it("returns a past epoch number but logs an error", () => {
      const spy = vi.spyOn(log, "error").mockImplementation(() => log);
      const past = NOW_SECONDS - DAY;
      expect(resolveTtl(past)).toBe(past);
      expect(spy).toHaveBeenCalled();
    });
  });
});
