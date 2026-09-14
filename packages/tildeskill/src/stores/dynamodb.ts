import {
  deleteEntity,
  getEntity,
  queryByCategory,
  type StorableEntity,
  updateEntity,
} from "@jaypie/dynamodb";
import { ConfigurationError } from "@jaypie/errors";
import { APEX } from "@jaypie/fabric";

import { normalizeAlias } from "../core/normalize";
import {
  compactSkill,
  filterByNickname,
  filterSkills,
  findWithFallback,
  hashSkill,
  searchSkills,
} from "../core/records";
import { uuidv5 } from "../core/uuidv5";
import { registerSkillModel, SKILL_MODEL_NAME } from "../models/skill";
import type {
  DynamoDbStoreOptions,
  ListFilter,
  SkillRecord,
  SkillStore,
} from "../types";

/**
 * Namespace for deterministic skill ids:
 * `uuidv5("<category>:<alias>", SKILL_NAMESPACE)`. Never change this value;
 * every stored skill id derives from it.
 */
export const SKILL_NAMESPACE = "98937fbc-3f72-4d4d-8b56-44dad0ac7242";

const ID_SEPARATOR = ":";

function optionalList(value: unknown): string[] | undefined {
  return Array.isArray(value) ? (value as string[]) : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function toRecord(entity: StorableEntity): SkillRecord {
  const metadata = (entity.metadata ?? {}) as Record<string, unknown>;
  return compactSkill({
    alias: String(entity.alias),
    content: optionalString(entity.content) ?? "",
    description: optionalString(entity.description),
    includes: optionalList(metadata.includes),
    name: optionalString(entity.name),
    nicknames: optionalList(metadata.nicknames),
    related: optionalList(metadata.related),
    tags: optionalList(entity.tags),
  });
}

/**
 * Create a skill store backed by `@jaypie/dynamodb`.
 *
 * - Records are `skill` entities at APEX scope. `category` is the store's
 *   namespace; `alias` is unqualified.
 * - Ids are deterministic: `uuidv5("<category>:<alias>", SKILL_NAMESPACE)`.
 * - `metadata.hash` holds `hashSkill(record)` for change detection.
 * - `includes`, `nicknames`, and `related` live in `metadata` because
 *   `related` is a reserved attribute for entity references.
 * - `list`, `getByNickname`, and `search` read the category through
 *   `indexModelCategory`; the table must declare that index.
 * - `delete` soft deletes (`deleteEntity`). Reads skip archived and deleted
 *   entities, and a later `put` restores the same id.
 *
 * Call `initClient()` from `@jaypie/dynamodb` before using the store.
 */
export function createDynamoDbStore({
  category: inputCategory,
}: DynamoDbStoreOptions): SkillStore {
  const category = normalizeAlias(inputCategory ?? "");
  if (!category) {
    throw new ConfigurationError("createDynamoDbStore requires a category");
  }

  registerSkillModel();

  function skillId(alias: string): string {
    return uuidv5(`${category}${ID_SEPARATOR}${alias}`, {
      namespace: SKILL_NAMESPACE,
    });
  }

  async function readActive(alias: string): Promise<StorableEntity | null> {
    const entity = await getEntity({ id: skillId(normalizeAlias(alias)) });
    if (
      !entity ||
      entity.model !== SKILL_MODEL_NAME ||
      entity.category !== category ||
      entity.archivedAt ||
      entity.deletedAt
    ) {
      return null;
    }
    return entity;
  }

  async function listAll(): Promise<SkillRecord[]> {
    const records: SkillRecord[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const { items, lastEvaluatedKey } = await queryByCategory({
        category,
        model: SKILL_MODEL_NAME,
        startKey,
      });
      records.push(...items.map(toRecord));
      startKey = lastEvaluatedKey;
    } while (startKey);
    return records;
  }

  async function get(alias: string): Promise<SkillRecord | null> {
    const entity = await readActive(alias);
    return entity ? toRecord(entity) : null;
  }

  return {
    async delete(alias: string): Promise<boolean> {
      const entity = await readActive(alias);
      if (!entity) return false;
      return deleteEntity({ id: entity.id });
    },

    async find(alias: string): Promise<SkillRecord | null> {
      return findWithFallback(alias, { get });
    },

    get,

    async getByNickname(nickname: string): Promise<SkillRecord[]> {
      return filterByNickname({ nickname, records: await listAll() });
    },

    async list(filter?: ListFilter): Promise<SkillRecord[]> {
      return filterSkills({ filter, records: await listAll() });
    },

    async put(record: SkillRecord): Promise<SkillRecord> {
      const alias = normalizeAlias(record.alias);
      const skill = compactSkill({ ...record, alias });
      const id = skillId(alias);
      const existing = await getEntity({ id });

      const metadata: Record<string, unknown> = { hash: hashSkill(skill) };
      if (skill.includes) metadata.includes = skill.includes;
      if (skill.nicknames) metadata.nicknames = skill.nicknames;
      if (skill.related) metadata.related = skill.related;

      const entity: StorableEntity = {
        alias,
        category,
        content: skill.content,
        id,
        metadata,
        model: SKILL_MODEL_NAME,
        scope: APEX,
      };
      if (existing?.createdAt) entity.createdAt = existing.createdAt;
      if (skill.description) entity.description = skill.description;
      if (skill.name) entity.name = skill.name;
      if (skill.tags) entity.tags = skill.tags;

      await updateEntity({ entity });
      return { ...record, alias };
    },

    async search(term: string): Promise<SkillRecord[]> {
      return searchSkills({ records: await listAll(), term });
    },
  };
}
