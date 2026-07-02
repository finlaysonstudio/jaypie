import { describe, expect, it } from "vitest";

import { maxOutputTokens, resolveMaxOutputTokens } from "../maxOutputTokens.js";

describe("maxOutputTokens", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof maxOutputTokens).toBe("function");
      expect(typeof resolveMaxOutputTokens).toBe("function");
    });

    it("returns undefined for unknown models", () => {
      expect(maxOutputTokens("unknown-model")).toBeUndefined();
      expect(maxOutputTokens("gpt-5.4")).toBeUndefined();
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    it("resolves current Anthropic models to 128000", () => {
      expect(maxOutputTokens("claude-opus-4-8")).toBe(128000);
      expect(maxOutputTokens("claude-opus-4-6")).toBe(128000);
      expect(maxOutputTokens("claude-sonnet-4-6")).toBe(128000);
      expect(maxOutputTokens("claude-sonnet-5")).toBe(128000);
      expect(maxOutputTokens("claude-fable-5")).toBe(128000);
      expect(maxOutputTokens("claude-mythos-5")).toBe(128000);
    });

    it("resolves Claude Haiku to 64000", () => {
      expect(maxOutputTokens("claude-haiku-4-5")).toBe(64000);
    });

    it("resolves legacy Anthropic models to their lower caps", () => {
      expect(maxOutputTokens("claude-opus-4-0")).toBe(32000);
      expect(maxOutputTokens("claude-opus-4-1")).toBe(32000);
      expect(maxOutputTokens("claude-opus-4-1-20250805")).toBe(32000);
      expect(maxOutputTokens("claude-opus-4-20250514")).toBe(32000);
      expect(maxOutputTokens("claude-opus-4-5")).toBe(64000);
      expect(maxOutputTokens("claude-sonnet-4-5")).toBe(64000);
      expect(maxOutputTokens("claude-sonnet-4-5-20250929")).toBe(64000);
      expect(maxOutputTokens("claude-sonnet-4-20250514")).toBe(64000);
    });

    it("resolves current Gemini models to 65536", () => {
      expect(maxOutputTokens("gemini-3.1-pro-preview")).toBe(65536);
      expect(maxOutputTokens("gemini-3.5-flash")).toBe(65536);
      expect(maxOutputTokens("gemini-3.1-flash-lite")).toBe(65536);
      expect(maxOutputTokens("gemini-2.5-pro")).toBe(65536);
    });

    it("resolves older Gemini models to 8192", () => {
      expect(maxOutputTokens("gemini-2.0-flash")).toBe(8192);
      expect(maxOutputTokens("gemini-1.5-pro")).toBe(8192);
    });
  });

  // Features
  describe("Features", () => {
    describe("resolveMaxOutputTokens", () => {
      it("caps non-streaming defaults at the non-streaming maximum", () => {
        expect(resolveMaxOutputTokens("claude-opus-4-8")).toBe(16384);
        expect(resolveMaxOutputTokens("claude-haiku-4-5")).toBe(16384);
        expect(resolveMaxOutputTokens("gemini-3.1-pro-preview")).toBe(16384);
      });

      it("uses the model maximum when streaming", () => {
        expect(
          resolveMaxOutputTokens("claude-opus-4-8", { stream: true }),
        ).toBe(128000);
        expect(
          resolveMaxOutputTokens("claude-haiku-4-5", { stream: true }),
        ).toBe(64000);
        expect(
          resolveMaxOutputTokens("gemini-3.5-flash", { stream: true }),
        ).toBe(65536);
      });

      it("keeps model maximums below the cap for non-streaming", () => {
        expect(resolveMaxOutputTokens("gemini-2.0-flash")).toBe(8192);
      });

      it("returns undefined for unknown models", () => {
        expect(resolveMaxOutputTokens("unknown-model")).toBeUndefined();
        expect(
          resolveMaxOutputTokens("unknown-model", { stream: true }),
        ).toBeUndefined();
      });
    });
  });
});
