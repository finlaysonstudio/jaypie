import { describe, expect, it, vi } from "vitest";

import { normalizeText, withRetries } from "../ocr.js";

describe("OCR harness", () => {
  describe("normalizeText", () => {
    it("matches a phrase broken across lines or spaced with a non-breaking space", () => {
      expect(normalizeText("# Mock\nPage")).toContain("mock page");
      expect(normalizeText("Mock Page")).toContain("mock page");
      expect(normalizeText("Mock   Page")).toContain("mock page");
    });
  });

  describe("withRetries", () => {
    it("runs a passing test once", async () => {
      const test = vi.fn().mockResolvedValue(true);
      await expect(withRetries(test)).resolves.toEqual({
        count: 1,
        passed: true,
      });
    });

    it("retries a failing test at least twice", async () => {
      const test = vi.fn().mockResolvedValue(false);
      await expect(withRetries(test)).resolves.toEqual({
        count: 3,
        passed: false,
      });
    });

    it("stops at the first pass", async () => {
      const test = vi
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      await expect(withRetries(test)).resolves.toEqual({
        count: 2,
        passed: true,
      });
    });
  });
});
