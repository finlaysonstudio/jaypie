import { describe, it, expect } from "vitest";
import { fabricator } from "./index.js";

const wordCount = (s: string): number => {
  const t = s.trim();
  return t === "" ? 0 : t.split(/\s+/).length;
};

describe("Fabricator.corpus", () => {
  describe("signatures", () => {
    it("returns a non-empty string with no arguments", () => {
      const fab = fabricator("sig-default");
      const text = fab.corpus();
      expect(typeof text).toBe("string");
      expect(text.length).toBeGreaterThan(0);
    });

    it("defaults to 108 words", () => {
      const fab = fabricator("sig-default-words");
      expect(wordCount(fab.corpus())).toBe(108);
    });

    it("accepts a word count", () => {
      const fab = fabricator("sig-count");
      expect(wordCount(fab.corpus(50))).toBe(50);
    });

    it("accepts an options object", () => {
      const fab = fabricator("sig-options");
      const text = fab.corpus({ wordsPerPeriod: 5 });
      expect(wordCount(text)).toBe(108);
    });

    it("accepts word count and options", () => {
      const fab = fabricator("sig-both");
      const text = fab.corpus(40, { wordsPerPeriod: 5 });
      expect(wordCount(text)).toBe(40);
    });
  });

  describe("determinism", () => {
    it("advances state — successive calls with same params differ", () => {
      const fab = fabricator("advance");
      const a = fab.corpus(100);
      const b = fab.corpus(100);
      expect(a).not.toEqual(b);
    });

    it("replays from a fresh fabricator with the same seed", () => {
      const fab1 = fabricator("replay");
      const a1 = fab1.corpus(100);
      const b1 = fab1.corpus(100);

      const fab2 = fabricator("replay");
      const a2 = fab2.corpus(100);
      const b2 = fab2.corpus(100);

      expect(a1).toEqual(a2);
      expect(b1).toEqual(b2);
    });

    it("different word counts produce independent streams (no off-by-one leakage)", () => {
      const a = fabricator("indep").corpus(100);
      const b = fabricator("indep").corpus(101);
      expect(a).not.toEqual(b);

      // The 101-word output should not be the 100-word output plus a single
      // word — folding length into the seed makes them independent streams.
      const aWords = a
        .replace(/[.,!?;:]/g, "")
        .trim()
        .split(/\s+/);
      const bWords = b
        .replace(/[.,!?;:]/g, "")
        .trim()
        .split(/\s+/);
      // First 100 words should differ in at least 5 positions (independent
      // streams; identical streams would diverge only at position 100).
      let diffs = 0;
      for (let i = 0; i < Math.min(aWords.length, bWords.length, 100); i++) {
        if (aWords[i] !== bWords[i]) diffs++;
      }
      expect(diffs).toBeGreaterThan(5);
    });

    it("different options produce independent output", () => {
      const fab1 = fabricator("opts-a");
      const a = fab1.corpus(50, { wordsPerPeriod: 5 });

      const fab2 = fabricator("opts-a");
      const b = fab2.corpus(50, { wordsPerPeriod: 20 });

      expect(a).not.toEqual(b);
    });

    it("an unseeded fabricator still produces self-consistent output across calls", () => {
      const fab = fabricator();
      const a = fab.corpus(20);
      const b = fab.corpus(20);
      // Different — state advances even without an explicit seed
      expect(a).not.toEqual(b);
    });
  });

  describe("custom corpus", () => {
    it("accepts a raw text corpus and produces output", () => {
      const fab = fabricator("custom-text");
      const text = fab.corpus(80, {
        corpus: "deploy pipeline lambda secrets bucket route handler queue",
      });
      expect(wordCount(text)).toBe(80);
    });

    it("accepts an explicit weighted words pool", () => {
      const fab = fabricator("custom-weights");
      const text = fab.corpus(60, {
        words: [
          ["alpha", 5],
          ["bravo", 3],
          ["charlie", 2],
        ],
      });
      expect(wordCount(text)).toBe(60);
      // Default blend is 0.5 — output is mixed with default English, so we
      // can't assert pure custom words. But replaceDefaults guarantees it.
    });

    it("replaceDefaults yields output drawn entirely from the custom pool", () => {
      const fab = fabricator("replace-only");
      const text = fab.corpus(80, {
        words: [
          ["alpha", 1],
          ["bravo", 1],
          ["charlie", 1],
        ],
        replaceDefaults: true,
        typoRate: 0,
        phonotacticRate: 0,
      });
      const tokens = text
        .replace(/[.,!?;:]/g, "")
        .trim()
        .split(/\s+/)
        .map((t) => t.toLowerCase());
      for (const token of tokens) {
        expect(["alpha", "bravo", "charlie"]).toContain(token);
      }
    });

    it("blend=0 is equivalent to default English (custom pool ignored)", () => {
      const a = fabricator("blend0").corpus(40, { blend: 0 });
      const b = fabricator("blend0").corpus(40, {
        blend: 0,
        words: [["zzqq", 1]],
      });
      // Different blend stringification — but both should produce no zzqq
      expect(a.toLowerCase()).not.toContain("zzqq");
      expect(b.toLowerCase()).not.toContain("zzqq");
    });

    it("blend=1 yields output entirely from the custom pool", () => {
      const fab = fabricator("blend1");
      const text = fab.corpus(60, {
        blend: 1,
        words: [
          ["alpha", 1],
          ["bravo", 1],
        ],
        typoRate: 0,
        phonotacticRate: 0,
      });
      const tokens = text
        .replace(/[.,!?;:]/g, "")
        .trim()
        .split(/\s+/)
        .map((t) => t.toLowerCase());
      for (const token of tokens) {
        expect(["alpha", "bravo"]).toContain(token);
      }
    });

    it("replaceDefaults without a custom pool throws", () => {
      const fab = fabricator("replace-empty");
      expect(() => fab.corpus(50, { replaceDefaults: true })).toThrow();
    });

    it("rejects out-of-range blend", () => {
      const fab = fabricator("bad-blend");
      expect(() => fab.corpus(50, { blend: 1.5, words: [["a", 1]] })).toThrow();
    });
  });

  describe("char escape hatch", () => {
    it("respects chars option and roughly matches char count", () => {
      const fab = fabricator("chars");
      const text = fab.corpus({ chars: 200 });
      expect(text.length).toBeLessThanOrEqual(200);
      expect(text.length).toBeGreaterThan(150);
    });
  });

  describe("functions", () => {
    const UUID_RE =
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

    it("accepts shorthand [fn, weight] and emits tokens from it", () => {
      const fab = fabricator("fn-shorthand");
      const text = fab.corpus(200, {
        functions: [({ fab }) => fab.string.uuid(), 0.5],
      });
      expect(UUID_RE.test(text)).toBe(true);
    });

    it("accepts the array-of-entries form with multiple functions", () => {
      const fab = fabricator("fn-array");
      const text = fab.corpus(200, {
        functions: [
          [({ fab }) => fab.string.uuid(), 0.3],
          [({ fab }) => "$" + fab.number.int({ min: 1, max: 999 }), 0.3],
        ],
      });
      expect(UUID_RE.test(text)).toBe(true);
      expect(/\$\d+/.test(text)).toBe(true);
    });

    it("function weight reduces the main word stream proportionally", () => {
      // With replaceDefaults + a one-word custom pool + a function at 0.5,
      // roughly half of content tokens should be "alpha" and half should
      // come from the function. Disable typos and phonotactic to make the
      // arithmetic clean.
      const fab = fabricator("fn-weight");
      const text = fab.corpus(400, {
        words: [["alpha", 1]],
        replaceDefaults: true,
        typoRate: 0,
        phonotacticRate: 0,
        functions: [() => "BETA", 0.5],
      });
      const tokens = text
        .replace(/[.,!?;:]/g, "")
        .trim()
        .split(/\s+/)
        .map((t) => t.toLowerCase());
      const alphas = tokens.filter((t) => t === "alpha").length;
      const betas = tokens.filter((t) => t === "beta").length;
      // Expect both well-represented; with rate 0.5 the counts should be
      // close. Using a generous bound to avoid flakiness on small samples.
      expect(alphas).toBeGreaterThan(50);
      expect(betas).toBeGreaterThan(50);
      expect(alphas + betas).toBe(tokens.length);
    });

    it("functions receive the fabricator and produce deterministic output", () => {
      const make = () =>
        fabricator("fn-deterministic").corpus(80, {
          functions: [({ fab }) => fab.string.uuid(), 0.2],
        });
      expect(make()).toEqual(make());
    });

    it("rejects when total weight (typo + phono + functions) >= 1", () => {
      const fab = fabricator("fn-overweight");
      expect(() =>
        fab.corpus(100, {
          typoRate: 0.5,
          phonotacticRate: 0.4,
          functions: [() => "x", 0.2],
        }),
      ).toThrow();
    });

    it("rejects negative function weights", () => {
      const fab = fabricator("fn-negative");
      expect(() => fab.corpus(100, { functions: [() => "x", -0.1] })).toThrow();
    });
  });

  describe("validation", () => {
    it("rejects zero or negative word counts", () => {
      const fab = fabricator("invalid-words");
      expect(() => fab.corpus(0)).toThrow();
      expect(() => fab.corpus(-5)).toThrow();
    });

    it("rejects zero or negative chars", () => {
      const fab = fabricator("invalid-chars");
      expect(() => fab.corpus({ chars: 0 })).toThrow();
      expect(() => fab.corpus({ chars: -10 })).toThrow();
    });
  });
});
