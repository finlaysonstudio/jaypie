import { ConfigurationError } from "@jaypie/errors";

import { normalizeAlias } from "../core/normalize";
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
 *   - `get` / `find` walk layers top-to-bottom and return the first match.
 *     A namespaced input (e.g., `jaypie:aws`) is routed directly to the
 *     matching layer.
 *   - `getByNickname` aggregates across every layer because a nickname may
 *     have several valid owners (e.g., "sparticus" in multiple packs).
 *   - `list` and `search` aggregate from every layer, since namespace
 *     prefixes already make aliases distinct.
 *   - `put` requires a namespace-qualified alias and delegates to the
 *     matching layer; unqualified writes throw `ConfigurationError`.
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
    async find(alias: string): Promise<SkillRecord | null> {
      const { layer, inner } = splitAlias(alias);
      if (layer) {
        const hit = await layer.store.find(inner);
        return hit ? qualify(layer.namespace, hit) : null;
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

      let filtered = all;
      if (filter?.namespace) {
        const prefix = filter.namespace.endsWith("*")
          ? filter.namespace.slice(0, -1)
          : filter.namespace;
        filtered = filtered.filter((r) => r.alias.startsWith(prefix));
      }
      if (filter?.tag) {
        const normalizedTag = normalizeAlias(filter.tag);
        filtered = filtered.filter((r) =>
          r.tags?.map(normalizeAlias).includes(normalizedTag),
        );
      }

      return filtered.sort((a, b) => a.alias.localeCompare(b.alias));
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
