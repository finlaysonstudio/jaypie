import * as fs from "node:fs/promises";
import * as path from "node:path";

import { parseFrontmatter, stringifyFrontmatter } from "@jaypie/kit";

import { normalizeAlias, parseList } from "../core/normalize";
import {
  filterByNickname,
  filterSkills,
  findWithFallback,
  searchSkills,
} from "../core/records";
import { validateAlias } from "../core/validate";
import type {
  ListFilter,
  MarkdownStoreOptions,
  SkillFrontMatter,
  SkillRecord,
  SkillStore,
} from "../types";

/**
 * Parse a markdown file into a SkillRecord
 */
async function parseSkillFile(filePath: string): Promise<SkillRecord> {
  const content = await fs.readFile(filePath, "utf-8");
  const alias = normalizeAlias(path.basename(filePath, ".md"));

  if (content.startsWith("---")) {
    const parsed = parseFrontmatter<SkillFrontMatter>(content);
    const frontMatter = parsed.data;
    return {
      alias,
      content: parsed.content.trim(),
      description: frontMatter.description,
      includes: parseList(frontMatter.includes),
      name: frontMatter.name,
      nicknames: parseList(frontMatter.nicknames),
      related: parseList(frontMatter.related),
      tags: parseList(frontMatter.tags),
    };
  }

  return {
    alias,
    content: content.trim(),
  };
}

const MISSING_FILE_CODE = "ENOENT";

/**
 * Create a markdown file-based skill store.
 *
 * `delete` removes the `<alias>.md` file. It validates the alias first and
 * throws `BadRequestError` for path traversal or invalid characters.
 */
export function createMarkdownStore({
  path: storePath,
}: MarkdownStoreOptions): SkillStore {
  async function get(alias: string): Promise<SkillRecord | null> {
    const filePath = path.join(storePath, `${normalizeAlias(alias)}.md`);
    try {
      return await parseSkillFile(filePath);
    } catch {
      return null;
    }
  }

  async function listAll(): Promise<SkillRecord[]> {
    try {
      const files = await fs.readdir(storePath);
      const mdFiles = files.filter((file) => file.endsWith(".md"));
      return await Promise.all(
        mdFiles.map((file) => parseSkillFile(path.join(storePath, file))),
      );
    } catch {
      return [];
    }
  }

  return {
    async delete(alias: string): Promise<boolean> {
      const normalized = validateAlias(alias);
      try {
        await fs.unlink(path.join(storePath, `${normalized}.md`));
        return true;
      } catch (error) {
        if ((error as { code?: string }).code === MISSING_FILE_CODE) {
          return false;
        }
        throw error;
      }
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
      const normalized = normalizeAlias(record.alias);
      const filePath = path.join(storePath, `${normalized}.md`);

      // Build frontmatter (alphabetized keys)
      const frontMatter: Record<string, string | string[]> = {};
      if (record.description) {
        frontMatter.description = record.description;
      }
      if (record.includes && record.includes.length > 0) {
        frontMatter.includes = record.includes.join(", ");
      }
      if (record.name) {
        frontMatter.name = record.name;
      }
      if (record.nicknames && record.nicknames.length > 0) {
        frontMatter.nicknames = record.nicknames.join(", ");
      }
      if (record.related && record.related.length > 0) {
        frontMatter.related = record.related.join(", ");
      }
      if (record.tags && record.tags.length > 0) {
        frontMatter.tags = record.tags.join(", ");
      }

      // Build file content
      let fileContent: string;
      if (Object.keys(frontMatter).length > 0) {
        fileContent = stringifyFrontmatter(record.content, frontMatter);
      } else {
        fileContent = record.content;
      }

      await fs.writeFile(filePath, fileContent, "utf-8");

      return { ...record, alias: normalized };
    },

    async search(term: string): Promise<SkillRecord[]> {
      return searchSkills({ records: await listAll(), term });
    },
  };
}
