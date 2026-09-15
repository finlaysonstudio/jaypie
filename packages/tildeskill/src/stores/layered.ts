import { ConfigurationError } from "@jaypie/errors";

import { normalizeAlias } from "../core/normalize";
import { filterSkills } from "../core/records";
import type {
  LayeredStoreLayer,
  LayeredStoreOptions,
  ListFilter,
  SkillRecord,
  SkillStore,
} from "../types";

const DEFAULT_SEPARATOR = ":";

interface ResolvedLayer {
  namespace: string;
  store: SkillStore;
}

/**
 * Create a layered skill store that composes multiple child stores.
 *
 * Each layer carries a namespace prefix (e.g., "local", "jaypie"). Records
 * surfaced from the layered store are returned with their alias namespaced
 * as `${namespace}${separator}${record.alias}`, letting callers see which
 * layer served the record.
 *
 * Lookup order:
 *   - `get` walks layers top-to-bottom and returns the first exact match.
 *   - `find` first walks every layer for an exact match, then walks every
 *     layer again with plural/singular fallback. An exact alias in a later
 *     layer wins over a spelling alternative in an earlier layer.
 *   - A namespaced input (e.g., `jaypie:aws`) routes `get` / `find` directly
 *     to the matching layer.
 *   - `getByNickname` aggregates across every layer because a nickname may
 *     have several valid owners (e.g., "sparticus" in multiple packs).
 *   - `list` and `search` aggregate from every layer, since namespace
 *     prefixes already make aliases distinct.
 *   - `put` and `delete` require a namespace-qualified alias and delegate to
 *     the matching layer; unqualified writes throw `ConfigurationError`.
 *     `delete` never walks layers, so it cannot remove a record from a layer
 *     the caller did not name.
 */
export function createLayeredStore({
  layers,
  separator = DEFAULT_SEPARATOR,
}: LayeredStoreOptions): SkillStore {
  if (!layers || layers.length === 0) {
    throw new ConfigurationError(
      "createLayeredStore requires at least one layer",
    );
  }
  if (!separator) {
    throw new ConfigurationError(
      "createLayeredStore separator must be non-empty",
    );
  }

  const resolved: ResolvedLayer[] = layers.map((layer: LayeredStoreLayer) => {
    const namespace = normalizeAlias(layer.namespace ?? "");
    if (!namespace) {
      throw new ConfigurationError(
        "createLayeredStore layer namespace must be non-empty",
      );
    }
    return { namespace, store: layer.store };
  });

  const seenNamespaces = new Set<string>();
  for (const layer of resolved) {
    if (seenNamespaces.has(layer.namespace)) {
      throw new ConfigurationError(
        `createLayeredStore layer namespaces must be unique (duplicate: "${layer.namespace}")`,
      );
    }
    seenNamespaces.add(layer.namespace);
  }

  function qualify(namespace: string, record: SkillRecord): SkillRecord {
    return { ...record, alias: `${namespace}${separator}${record.alias}` };
  }

  function qualifyAll(
    namespace: string,
    records: SkillRecord[],
  ): SkillRecord[] {
    return records.map((r) => qualify(namespace, r));
  }

  function splitAlias(alias: string): {
    layer: ResolvedLayer | null;
    inner: string;
  } {
    const normalized = normalizeAlias(alias);
    const idx = normalized.indexOf(separator);
    if (idx === -1) return { layer: null, inner: normalized };
    const prefix = normalized.slice(0, idx);
    const inner = normalized.slice(idx + separator.length);
    const match = resolved.find((l) => l.namespace === prefix) ?? null;
    return match ? { layer: match, inner } : { layer: null, inner: normalized };
  }

  return {
    async delete(alias: string): Promise<boolean> {
      const { layer, inner } = splitAlias(alias);
      if (!layer) {
        throw new ConfigurationError(
          "createLayeredStore delete() requires a namespace-qualified alias",
        );
      }
      return layer.store.delete(inner);
    },

    async find(alias: string): Promise<SkillRecord | null> {
      const { layer, inner } = splitAlias(alias);
      if (layer) {
        const hit = await layer.store.find(inner);
        return hit ? qualify(layer.namespace, hit) : null;
      }
      // An exact alias in any layer beats a spelling alternative in any layer
      for (const l of resolved) {
        const hit = await l.store.get(inner);
        if (hit) return qualify(l.namespace, hit);
      }
      for (const l of resolved) {
        const hit = await l.store.find(inner);
        if (hit) return qualify(l.namespace, hit);
      }
      return null;
    },

    async get(alias: string): Promise<SkillRecord | null> {
      const { layer, inner } = splitAlias(alias);
      if (layer) {
        const hit = await layer.store.get(inner);
        return hit ? qualify(layer.namespace, hit) : null;
      }
      for (const l of resolved) {
        const hit = await l.store.get(inner);
        if (hit) return qualify(l.namespace, hit);
      }
      return null;
    },

    async getByNickname(nickname: string): Promise<SkillRecord[]> {
      const results: SkillRecord[] = [];
      for (const l of resolved) {
        const hits = await l.store.getByNickname(nickname);
        results.push(...qualifyAll(l.namespace, hits));
      }
      return results.sort((a, b) => a.alias.localeCompare(b.alias));
    },

    async list(filter?: ListFilter): Promise<SkillRecord[]> {
      const all: SkillRecord[] = [];
      for (const l of resolved) {
        const records = await l.store.list();
        all.push(...qualifyAll(l.namespace, records));
      }

      return filterSkills({ filter, records: all });
    },

    async put(record: SkillRecord): Promise<SkillRecord> {
      const { layer, inner } = splitAlias(record.alias);
      if (!layer) {
        throw new ConfigurationError(
          "createLayeredStore put() requires a namespace-qualified alias",
        );
      }
      const stored = await layer.store.put({ ...record, alias: inner });
      return qualify(layer.namespace, stored);
    },

    async search(term: string): Promise<SkillRecord[]> {
      const all: SkillRecord[] = [];
      for (const l of resolved) {
        const records = await l.store.search(term);
        all.push(...qualifyAll(l.namespace, records));
      }
      return all.sort((a, b) => a.alias.localeCompare(b.alias));
    },
  };
}
