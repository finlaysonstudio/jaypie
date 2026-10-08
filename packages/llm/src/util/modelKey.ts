import { MODEL, PROVIDER } from "../constants.js";

//
//
// Constants
//

/** The key a per-model map falls back to when nothing more specific matches */
export const MODEL_KEY_DEFAULT = "default";

/** Map keys that name a provider by another word */
const PROVIDER_ALIAS: Record<string, string> = {
  gemini: PROVIDER.GOOGLE.NAME,
};

/**
 * How specifically a per-model map key matched an attempt, least to most
 * specific. Order matters: first-wins maps (effort) take the highest rank,
 * merging maps (modelOptions) apply ranks in ascending order.
 */
export const MODEL_KEY_RANK = {
  DEFAULT: 0,
  PROVIDER: 1,
  CATALOG: 2,
  EXACT: 3,
} as const;

export type ModelKeyRank = (typeof MODEL_KEY_RANK)[keyof typeof MODEL_KEY_RANK];

//
//
// Helpers
//

function normalizeCatalogKey(key: string): string {
  return key
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
}

/**
 * Normalized `MODEL` catalog key -> model ids. Nested entries register under
 * the leaf key (`GLM`) and the path (`FIREWORKS_GLM`), so a leaf shared by
 * two subtrees resolves by whichever id the attempt actually runs.
 */
function buildCatalogIndex(): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  const add = (key: string, id: string) => {
    const normalized = normalizeCatalogKey(key);
    if (!index.has(normalized)) index.set(normalized, new Set());
    index.get(normalized)!.add(id);
  };
  const walk = (node: Record<string, unknown>, path: string[]) => {
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "string") {
        add(key, value);
        if (path.length) add([...path, key].join("_"), value);
      } else if (value && typeof value === "object") {
        walk(value as Record<string, unknown>, [...path, key]);
      }
    }
  };
  walk(MODEL as Record<string, unknown>, []);
  return index;
}

let catalogIndex: Map<string, Set<string>> | undefined;

function catalogKeyMatches(key: string, model: string): boolean {
  catalogIndex ??= buildCatalogIndex();
  return catalogIndex.get(normalizeCatalogKey(key))?.has(model) ?? false;
}

//
//
// Main
//

/**
 * Rank how a per-model map key applies to one attempt: exact model id,
 * `MODEL` catalog key whose value is exactly the model, provider name (or
 * alias), or `default`. Returns `undefined` when the key does not apply.
 */
export function rankModelKey(
  key: string,
  { model, provider }: { model?: string; provider?: string } = {},
): ModelKeyRank | undefined {
  if (key === MODEL_KEY_DEFAULT) return MODEL_KEY_RANK.DEFAULT;
  if (model) {
    if (key === model) return MODEL_KEY_RANK.EXACT;
    if (catalogKeyMatches(key, model)) return MODEL_KEY_RANK.CATALOG;
  }
  if (provider) {
    const lower = key.toLowerCase();
    const target = provider.toLowerCase();
    if (lower === target || PROVIDER_ALIAS[lower] === target) {
      return MODEL_KEY_RANK.PROVIDER;
    }
  }
  return undefined;
}

/**
 * The keys of a per-model map that apply to one attempt, least to most
 * specific. Keys of equal rank keep their declared order.
 */
export function matchModelKeys(
  keys: string[],
  { model, provider }: { model?: string; provider?: string } = {},
): string[] {
  return keys
    .map((key, index) => ({
      index,
      key,
      rank: rankModelKey(key, { model, provider }),
    }))
    .filter(
      (entry): entry is { index: number; key: string; rank: ModelKeyRank } =>
        entry.rank !== undefined,
    )
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.key);
}
