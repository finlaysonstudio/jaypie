import { ConfigurationError } from "@jaypie/errors";

import { hashSkill } from "./core/records";
import type { SkillRecord, SyncSkillsOptions, SyncSkillsResult } from "./types";

/**
 * Copy every record from one store into another.
 *
 * - Records missing from `to` are put (`added`).
 * - Records whose `hashSkill` differs are put (`updated`).
 * - Records whose `hashSkill` matches are not written (`unchanged`).
 * - Records in `to` that are missing from `from` are deleted (`removed`).
 *
 * An empty `from` with a non-empty `to` throws `ConfigurationError` before
 * writing, since a misconfigured source (for example, a markdown store pointed
 * at a missing directory) would otherwise remove every record. Pass
 * `allowEmptySource: true` to empty `to` on purpose.
 *
 * Aliases are compared exactly as each store's `list()` surfaces them. Each
 * result list is sorted by alias.
 */
export async function syncSkills({
  allowEmptySource = false,
  from,
  to,
}: SyncSkillsOptions): Promise<SyncSkillsResult> {
  const [source, target] = await Promise.all([from.list(), to.list()]);

  if (!allowEmptySource && source.length === 0 && target.length > 0) {
    throw new ConfigurationError(
      `syncSkills source is empty and would remove all ${target.length} destination records; pass allowEmptySource: true to proceed`,
    );
  }

  const result: SyncSkillsResult = {
    added: [],
    removed: [],
    unchanged: [],
    updated: [],
  };
  const sourceAliases = new Set<string>();
  const targetByAlias = new Map<string, SkillRecord>(
    target.map((record) => [record.alias, record]),
  );

  for (const record of source) {
    sourceAliases.add(record.alias);
    const existing = targetByAlias.get(record.alias);
    if (!existing) {
      await to.put(record);
      result.added.push(record.alias);
    } else if (hashSkill(existing) === hashSkill(record)) {
      result.unchanged.push(record.alias);
    } else {
      await to.put(record);
      result.updated.push(record.alias);
    }
  }

  for (const record of target) {
    if (!sourceAliases.has(record.alias)) {
      await to.delete(record.alias);
      result.removed.push(record.alias);
    }
  }

  for (const list of Object.values(result)) {
    list.sort((a: string, b: string) => a.localeCompare(b));
  }
  return result;
}
