/**
 * Seeded pseudo-random number generator.
 *
 * Uses sfc32 (Chris Doty-Humphrey's Small Fast Counter) seeded by a cyrb128
 * hash of the input. Both are well-established, fast, and produce high-quality
 * output for non-cryptographic use.
 *
 * Guarantees: the same seed always yields the same sequence.
 */

export type Seed = string | number | Rng;

export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Integer in [minInclusive, maxExclusive). */
  int(minInclusive: number, maxExclusive: number): number;
  /** Pick a uniformly random element. Throws on empty array. */
  pick<T>(arr: readonly T[]): T;
  /** Pick a value weighted by the numeric weight in each entry. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
  /** Biased coin flip. Default p=0.5. */
  bool(pTrue?: number): boolean;
  /** Fisher–Yates shuffle, returning a new array. */
  shuffle<T>(arr: readonly T[]): T[];
}

function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return function () {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function createRng(seed: string | number): Rng {
  const seedStr = typeof seed === "number" ? `n:${seed}` : seed;
  const [a, b, c, d] = cyrb128(seedStr);
  const next = sfc32(a, b, c, d);
  // Warm up to diffuse the seed state before first consumer read.
  for (let i = 0; i < 15; i++) next();

  return {
    next,
    int(minInclusive: number, maxExclusive: number): number {
      return minInclusive + Math.floor(next() * (maxExclusive - minInclusive));
    },
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new Error("rng.pick: empty array");
      return arr[Math.floor(next() * arr.length)]!;
    },
    weighted<T>(entries: readonly (readonly [T, number])[]): T {
      if (entries.length === 0) throw new Error("rng.weighted: empty entries");
      let total = 0;
      for (const [, w] of entries) total += w;
      if (total <= 0) throw new Error("rng.weighted: total weight must be > 0");
      let r = next() * total;
      for (const [item, w] of entries) {
        r -= w;
        if (r <= 0) return item;
      }
      return entries[entries.length - 1]![0];
    },
    bool(pTrue: number = 0.5): boolean {
      return next() < pTrue;
    },
    shuffle<T>(arr: readonly T[]): T[] {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
  };
}

export function isRng(x: unknown): x is Rng {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { next?: unknown }).next === "function"
  );
}

/** Coerce a Seed into an Rng. Strings/numbers create a fresh Rng; Rng passthrough. */
export function toRng(seed: Seed): Rng {
  if (isRng(seed)) return seed;
  return createRng(seed);
}
