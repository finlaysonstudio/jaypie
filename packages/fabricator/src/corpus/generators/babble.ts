/**
 * Babble generator. Three-way mixture of statistical draws:
 *
 *   1. Real English words, weighted by frequency from the Google Web
 *      Trillion Word Corpus (via Peter Norvig's count_1w data). Top ~2500
 *      words, Zipf-distributed.
 *   2. Common English misspellings and keyboard-slip typos ("teh", "recieve",
 *      "thier", "alot"), also weighted.
 *   3. Phonotactic invention — pronounceable made-up words generated on the
 *      fly from syllable pools.
 *
 * Plus periods, commas, and newlines, as in wordbag.
 *
 * The three streams are gated by top-level rates (typoRate, phonotacticRate);
 * within each stream, items are drawn by weighted random sampling. Same seed +
 * same length → same output, as always.
 */

import { toRng } from "../rng.js";
import type { Seed } from "../rng.js";
import { phonotacticWord } from "./phonotactic.js";
import type { PhonotacticOptions } from "./phonotactic.js";
import { ENGLISH_WORDS } from "../data/english-corpus.js";
import { ENGLISH_TYPOS } from "../data/english-typos.js";

export interface BabbleOptions {
  /** Word pool with weights. Defaults to top ~2500 English words (Zipf). */
  words?: ReadonlyArray<readonly [string, number]>;
  /** Corpus to derive word frequencies from. Ignored if `words` is set. */
  corpus?: string;
  /** Typo pool with weights. Defaults to ~130 common misspellings and typos. */
  typos?: ReadonlyArray<readonly [string, number]>;
  /** Options for phonotactic invention. */
  phonotactic?: PhonotacticOptions;

  /** Fraction of content draws that should be typos (default 0.06). */
  typoRate?: number;
  /** Fraction of content draws that should be invented words (default 0.03). */
  phonotacticRate?: number;

  /** Average words between periods (default 17). Pass Infinity to disable. */
  wordsPerPeriod?: number;
  /** Average words between commas (default 22). Pass Infinity to disable. */
  wordsPerComma?: number;
  /**
   * How many plain periods occur per line-break period, on average. The bag
   * holds two period tokens: a plain "." and a "." followed by a newline,
   * with the plain one `periodsPerBreak` times more likely. Default 5.
   * Pass Infinity to disable line breaks entirely; pass 0 to break after
   * every sentence.
   */
  periodsPerBreak?: number;
  /** Capitalize the first word of each sentence/paragraph (default true). */
  sentences?: boolean;
}

type Category = "word" | "typo" | "phono" | "period" | "comma" | "break";

type Token =
  | { kind: "word"; text: string }
  | { kind: "period" }
  | { kind: "comma" }
  /** Period followed by a newline — ends a sentence and starts a new line. */
  | { kind: "break" };

function wordsFromCorpus(
  corpus: string,
): ReadonlyArray<readonly [string, number]> {
  const counts = new Map<string, number>();
  for (const match of corpus.toLowerCase().matchAll(/[a-z][a-z']*/g)) {
    const w = match[0];
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return Array.from(counts.entries());
}

export function babble(
  seed: Seed,
  length: number,
  options: BabbleOptions = {},
): string {
  const rng = toRng(seed);

  const words: ReadonlyArray<readonly [string, number]> = options.words
    ? options.words
    : options.corpus
      ? wordsFromCorpus(options.corpus)
      : ENGLISH_WORDS;
  if (words.length === 0) throw new Error("babble: empty word pool");

  const typos = options.typos ?? ENGLISH_TYPOS;
  const phonoOpts = options.phonotactic ?? { minSyllables: 1, maxSyllables: 3 };

  const typoRate = options.typoRate ?? 0.06;
  const phonoRate = options.phonotacticRate ?? 0.03;
  if (typoRate < 0 || phonoRate < 0 || typoRate + phonoRate >= 1) {
    throw new Error("babble: typoRate + phonotacticRate must be in [0, 1)");
  }
  const wordRate = 1 - typoRate - phonoRate;

  const wordsPerPeriod = options.wordsPerPeriod ?? 17;
  const wordsPerComma = options.wordsPerComma ?? 22;
  const periodsPerBreak = options.periodsPerBreak ?? 5;
  const sentences = options.sentences ?? true;

  if (periodsPerBreak < 0) {
    throw new Error("babble: periodsPerBreak must be >= 0");
  }

  // Build the category-selection pool. Weights are chosen so that on average,
  // `rate` of content draws hit each content category and punctuation density
  // matches `wordsPer*` (relative to 1 total content weight).
  const categoryPool: [Category, number][] = [
    ["word", wordRate],
    ["typo", typos.length > 0 ? typoRate : 0],
    ["phono", phonoRate],
  ];
  if (Number.isFinite(wordsPerPeriod) && wordsPerPeriod > 0) {
    const totalPeriodWeight = 1 / wordsPerPeriod;
    if (!Number.isFinite(periodsPerBreak)) {
      categoryPool.push(["period", totalPeriodWeight]);
    } else if (periodsPerBreak === 0) {
      categoryPool.push(["break", totalPeriodWeight]);
    } else {
      const plainShare = periodsPerBreak / (periodsPerBreak + 1);
      const breakShare = 1 / (periodsPerBreak + 1);
      categoryPool.push(["period", totalPeriodWeight * plainShare]);
      categoryPool.push(["break", totalPeriodWeight * breakShare]);
    }
  }
  if (Number.isFinite(wordsPerComma) && wordsPerComma > 0) {
    categoryPool.push(["comma", 1 / wordsPerComma]);
  }

  // --- draw tokens ---
  const emitted: Token[] = [];
  let approxLength = 0;
  let canPunctuate = false;
  let lastKind: "word" | "punct" | null = null;

  while (approxLength < length) {
    const category = rng.weighted(categoryPool);

    if (category === "word") {
      const text = rng.weighted(words);
      emitted.push({ kind: "word", text });
      approxLength += text.length + 1;
      canPunctuate = true;
      lastKind = "word";
      continue;
    }
    if (category === "typo") {
      const text = rng.weighted(typos);
      emitted.push({ kind: "word", text });
      approxLength += text.length + 1;
      canPunctuate = true;
      lastKind = "word";
      continue;
    }
    if (category === "phono") {
      const text = phonotacticWord(rng, phonoOpts);
      if (!text) continue;
      emitted.push({ kind: "word", text });
      approxLength += text.length + 1;
      canPunctuate = true;
      lastKind = "word";
      continue;
    }
    if (category === "period") {
      if (!canPunctuate || lastKind === "punct") continue;
      emitted.push({ kind: "period" });
      approxLength += 1;
      canPunctuate = false;
      lastKind = "punct";
      continue;
    }
    if (category === "comma") {
      if (!canPunctuate || lastKind === "punct") continue;
      emitted.push({ kind: "comma" });
      approxLength += 1;
      lastKind = "punct";
      continue;
    }
    if (category === "break") {
      if (!canPunctuate || lastKind === "punct") continue;
      emitted.push({ kind: "break" });
      approxLength += 2; // period + newline
      canPunctuate = false;
      lastKind = "punct";
      continue;
    }
  }

  // --- stringify ---
  let result = "";
  let capitalizeNext = true;
  for (let i = 0; i < emitted.length; i++) {
    const t = emitted[i]!;
    if (t.kind === "word") {
      const prev = emitted[i - 1];
      const needsSpace = i > 0 && prev?.kind !== "break";
      let w = t.text;
      if (sentences && capitalizeNext) {
        w = w.charAt(0).toUpperCase() + w.slice(1);
      }
      result += (needsSpace ? " " : "") + w;
      capitalizeNext = false;
    } else if (t.kind === "period") {
      result += ".";
      capitalizeNext = true;
    } else if (t.kind === "comma") {
      result += ",";
    } else if (t.kind === "break") {
      result += ".\n";
      capitalizeNext = true;
    }
  }

  // --- final length trim and terminator ---
  if (result.length > length) {
    const cut = result.slice(0, length);
    const lastBreak = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("\n"));
    result = lastBreak > 0 ? cut.slice(0, lastBreak) : cut;
  }
  if (sentences) {
    const trimmed = result.replace(/[\s.,]+$/, "");
    if (trimmed.length + 1 <= length) {
      result = trimmed + ".";
    } else {
      result = trimmed;
    }
  }

  return result;
}

export { ENGLISH_WORDS, ENGLISH_TYPOS };
