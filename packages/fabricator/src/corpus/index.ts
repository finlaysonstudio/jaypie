/**
 * Internal corpus generator. Not exported from @jaypie/fabricator.
 *
 * Vendored from text-gen and adapted: word-count interface, custom-corpus
 * blend, and a single entry point — corpus(seed, words, options).
 */

import { babble } from "./generators/babble.js";
import type { BabbleOptions } from "./generators/babble.js";
import type { PhonotacticOptions } from "./generators/phonotactic.js";
import { ENGLISH_WORDS } from "./data/english-corpus.js";

const DEFAULT_WORDS = 108;
const CHARS_PER_WORD_ESTIMATE = 6;
const SAFETY_PADDING = 1.5;

export interface CorpusOptions {
  /**
   * Custom corpus as raw text. Word frequencies are derived from it. Mixed
   * with the default English pool so the custom corpus contributes `blend` of
   * the total real-word weight (default 0.5 — equal weight with defaults).
   */
  corpus?: string;
  /**
   * Custom word pool with explicit weights. Mixed with the default English
   * pool the same way `corpus` is.
   */
  words?: ReadonlyArray<readonly [string, number]>;
  /**
   * Share of real-word weight given to the custom pool when one is provided.
   * 0 = ignore custom, 0.5 = equal with defaults (default), 1 = pure custom.
   */
  blend?: number;
  /**
   * Replace defaults entirely instead of blending. Equivalent to blend = 1
   * but also takes effect with no custom input (resulting in an error,
   * since there would be nothing to draw from).
   */
  replaceDefaults?: boolean;

  /** Override the typo pool entirely. */
  typos?: ReadonlyArray<readonly [string, number]>;
  /** Tune phonotactic invention. */
  phonotactic?: PhonotacticOptions;

  /** Fraction of content tokens that are typos. Default 0.06. */
  typoRate?: number;
  /** Fraction of content tokens that are invented words. Default 0.03. */
  phonotacticRate?: number;

  /** Average words between periods. Default 17. Pass Infinity to disable. */
  wordsPerPeriod?: number;
  /** Average words between commas. Default 22. Pass Infinity to disable. */
  wordsPerComma?: number;
  /** Plain periods per line-break period. Default 5. */
  periodsPerBreak?: number;
  /** Capitalize first word of each sentence/paragraph. Default true. */
  sentences?: boolean;

  /**
   * Generate by character length instead of word count. When set, the
   * `words` argument to corpus() is ignored.
   */
  chars?: number;
}

function deriveWordsFromCorpus(
  corpus: string,
): Array<readonly [string, number]> {
  const counts = new Map<string, number>();
  for (const match of corpus.toLowerCase().matchAll(/[a-z][a-z']*/g)) {
    const w = match[0];
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return Array.from(counts.entries());
}

function buildWordPool(
  options: CorpusOptions,
): ReadonlyArray<readonly [string, number]> {
  const customRaw =
    options.words ??
    (options.corpus ? deriveWordsFromCorpus(options.corpus) : null);

  if (options.replaceDefaults) {
    if (!customRaw || customRaw.length === 0) {
      throw new Error(
        "corpus: replaceDefaults requires a custom corpus or words pool",
      );
    }
    return customRaw;
  }

  if (!customRaw || customRaw.length === 0) return ENGLISH_WORDS;

  const blend = options.blend ?? 0.5;
  if (blend < 0 || blend > 1) {
    throw new Error("corpus: blend must be in [0, 1]");
  }
  if (blend === 0) return ENGLISH_WORDS;
  if (blend === 1) return customRaw;

  // Rebalance both pools to have weight equal to (blend) and (1 - blend).
  const customTotal = customRaw.reduce((s, [, w]) => s + w, 0);
  const defaultTotal = ENGLISH_WORDS.reduce((s, [, w]) => s + w, 0);
  if (customTotal <= 0) return ENGLISH_WORDS;

  const customScale = blend / customTotal;
  const defaultScale = (1 - blend) / defaultTotal;

  const merged: Array<readonly [string, number]> = [];
  for (const [word, weight] of ENGLISH_WORDS) {
    merged.push([word, weight * defaultScale]);
  }
  for (const [word, weight] of customRaw) {
    merged.push([word, weight * customScale]);
  }
  return merged;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function trimToWordCount(text: string, words: number, sentences: boolean) {
  const tokens = text.split(/(\s+)/);
  let kept = 0;
  let endIdx = tokens.length;
  for (let i = 0; i < tokens.length; i++) {
    if (!/^\s+$/.test(tokens[i]!) && tokens[i]!.length > 0) {
      kept++;
      if (kept === words) {
        endIdx = i + 1;
        break;
      }
    }
  }
  let result = tokens.slice(0, endIdx).join("");
  if (sentences) {
    result = result.replace(/[\s.,!?;:]+$/, "") + ".";
  }
  return result;
}

/**
 * Generate corpus text. Always deterministic given seed + words + options.
 */
export function corpus(
  seed: string,
  words: number = DEFAULT_WORDS,
  options: CorpusOptions = {},
): string {
  const wordPool = buildWordPool(options);
  if (wordPool.length === 0) {
    throw new Error("corpus: empty word pool");
  }

  const babbleOptions: BabbleOptions = {
    words: wordPool,
    typos: options.typos,
    phonotactic: options.phonotactic,
    typoRate: options.typoRate,
    phonotacticRate: options.phonotacticRate,
    wordsPerPeriod: options.wordsPerPeriod,
    wordsPerComma: options.wordsPerComma,
    periodsPerBreak: options.periodsPerBreak,
    sentences: options.sentences,
  };

  if (typeof options.chars === "number") {
    if (!Number.isFinite(options.chars) || options.chars <= 0) {
      throw new Error("corpus: chars must be a positive finite number");
    }
    return babble(seed, options.chars, babbleOptions);
  }

  if (!Number.isFinite(words) || words <= 0) {
    throw new Error("corpus: words must be a positive finite number");
  }

  // Generate at an estimated char length, then trim to exact word count.
  // Loop with growing budget if estimate falls short.
  let charBudget = Math.ceil(words * CHARS_PER_WORD_ESTIMATE * SAFETY_PADDING);
  let attempt = 0;
  while (attempt < 4) {
    const text = babble(seed, charBudget, babbleOptions);
    if (countWords(text) >= words) {
      return trimToWordCount(text, words, babbleOptions.sentences ?? true);
    }
    charBudget = Math.ceil(charBudget * 1.75);
    attempt++;
  }
  // Best effort — return whatever the largest run produced.
  return babble(seed, charBudget, babbleOptions);
}
