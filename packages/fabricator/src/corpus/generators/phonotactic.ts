/**
 * Phonotactic generator. Builds pronounceable nonsense words by sampling
 * onset + nucleus + coda pools and concatenating syllables.
 *
 * Produces strings like: "Trena volsin kadorp. Melth brana oosht..."
 */

import { toRng } from "../rng.js";
import type { Seed, Rng } from "../rng.js";

const DEFAULT_ONSETS: readonly string[] = [
  "",
  "b",
  "c",
  "d",
  "f",
  "g",
  "h",
  "j",
  "k",
  "l",
  "m",
  "n",
  "p",
  "r",
  "s",
  "t",
  "v",
  "w",
  "y",
  "z",
  "bl",
  "br",
  "cl",
  "cr",
  "dr",
  "fl",
  "fr",
  "gl",
  "gr",
  "pl",
  "pr",
  "sc",
  "sk",
  "sl",
  "sm",
  "sn",
  "sp",
  "st",
  "sw",
  "tr",
  "tw",
  "ch",
  "sh",
  "th",
  "wh",
  "ph",
];

const DEFAULT_NUCLEI: readonly string[] = [
  "a",
  "e",
  "i",
  "o",
  "u",
  "ai",
  "au",
  "ay",
  "ea",
  "ee",
  "ei",
  "ie",
  "oa",
  "oi",
  "oo",
  "ou",
  "oy",
  "ue",
];

const DEFAULT_CODAS: readonly string[] = [
  "",
  "b",
  "d",
  "f",
  "g",
  "k",
  "l",
  "m",
  "n",
  "p",
  "r",
  "s",
  "t",
  "x",
  "y",
  "ng",
  "nk",
  "nd",
  "nt",
  "st",
  "sh",
  "th",
  "ch",
  "ld",
  "lk",
  "lm",
  "lp",
  "lt",
  "mp",
  "rb",
  "rd",
  "rk",
  "rl",
  "rm",
  "rn",
  "rp",
  "rs",
  "rt",
];

export interface PhonotacticOptions {
  onsets?: readonly string[];
  nuclei?: readonly string[];
  codas?: readonly string[];
  /** Minimum syllables per word (default 1). */
  minSyllables?: number;
  /** Maximum syllables per word, inclusive (default 4). */
  maxSyllables?: number;
  /** Emit sentence-style capitalization and punctuation (default true). */
  sentences?: boolean;
}

interface ResolvedOptions {
  onsets: readonly string[];
  nuclei: readonly string[];
  codas: readonly string[];
  minSyllables: number;
  maxSyllables: number;
  sentences: boolean;
}

function resolve(options: PhonotacticOptions): ResolvedOptions {
  return {
    onsets: options.onsets ?? DEFAULT_ONSETS,
    nuclei: options.nuclei ?? DEFAULT_NUCLEI,
    codas: options.codas ?? DEFAULT_CODAS,
    minSyllables: options.minSyllables ?? 1,
    maxSyllables: options.maxSyllables ?? 4,
    sentences: options.sentences ?? true,
  };
}

function syllable(rng: Rng, opts: ResolvedOptions): string {
  return rng.pick(opts.onsets) + rng.pick(opts.nuclei) + rng.pick(opts.codas);
}

function word(rng: Rng, opts: ResolvedOptions): string {
  const n = rng.int(opts.minSyllables, opts.maxSyllables + 1);
  let w = "";
  for (let i = 0; i < n; i++) w += syllable(rng, opts);
  return w;
}

/**
 * Generate a single phonotactic word using an existing Rng. Useful when
 * composing phonotactic invention into other generators.
 */
export function phonotacticWord(
  rng: Rng,
  options: PhonotacticOptions = {},
): string {
  return word(rng, resolve(options));
}

export function phonotactic(
  seed: Seed,
  length: number,
  options: PhonotacticOptions = {},
): string {
  const rng = toRng(seed);
  const opts = resolve(options);

  const parts: string[] = [];
  let total = 0;
  let wordsInSentence = 0;
  let sentenceLen = rng.int(4, 15);
  let capitalizeNext = true;

  while (total < length) {
    let w = word(rng, opts);
    if (!w) continue; // all three parts could theoretically be empty
    if (opts.sentences && capitalizeNext) {
      w = w.charAt(0).toUpperCase() + w.slice(1);
      capitalizeNext = false;
    }
    parts.push(w);
    total += w.length + 1;
    wordsInSentence++;

    if (opts.sentences && wordsInSentence >= sentenceLen) {
      const punct = rng.weighted([
        [".", 0.75],
        ["!", 0.1],
        ["?", 0.1],
        [";", 0.05],
      ]);
      parts[parts.length - 1] += punct;
      total += 1;
      wordsInSentence = 0;
      sentenceLen = rng.int(4, 15);
      capitalizeNext = true;
    }
  }

  const effectiveLimit = opts.sentences ? length - 1 : length;
  let result = parts.join(" ");
  if (result.length > effectiveLimit) {
    const truncated = result.slice(0, effectiveLimit);
    const lastSpace = truncated.lastIndexOf(" ");
    result = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
  }
  if (opts.sentences) {
    result = result.replace(/[.!?;,]+\s*$/, "") + ".";
  }
  return result;
}
