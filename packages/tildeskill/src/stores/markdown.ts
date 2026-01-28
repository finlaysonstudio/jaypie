import * as fs from "node:fs/promises";
import * as path from "node:path";

import matter from "gray-matter";

import { normalizeAlias, parseList } from "../core/normalize";
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
    const parsed = matter(content);
    const frontMatter = parsed.data as SkillFrontMatter;
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

/**
 * Create a markdown file-based skill store
 */
export function createMarkdownStore({
  path: storePath,
}: MarkdownStoreOptions): SkillStore {
  return {
    async get(alias: string): Promise<SkillRecord | null> {
      const normalized = normalizeAlias(alias);
      const filePath = path.join(storePath, `${normalized}.md`);

      try {
        return await parseSkillFile(filePath);
      } catch {
        return null;
      }
    },

    async getByNickname(nickname: string): Promise<SkillRecord | null> {
      const normalized = normalizeAlias(nickname);
      const allSkills = await this.list();
      return (
        allSkills.find((record) =>
          record.nicknames?.map(normalizeAlias).includes(normalized),
        ) ?? null
      );
    },

    async list(filter?: ListFilter): Promise<SkillRecord[]> {
      try {
        const files = await fs.readdir(storePath);
        const mdFiles = files.filter((file) => file.endsWith(".md"));

        let skills = await Promise.all(
          mdFiles.map((file) => parseSkillFile(path.join(storePath, file))),
        );

        if (filter?.namespace) {
          // Remove trailing "*" if present for prefix matching
          const prefix = filter.namespace.endsWith("*")
            ? filter.namespace.slice(0, -1)
            : filter.namespace;
          skills = skills.filter((r) => r.alias.startsWith(prefix));
        }

        if (filter?.tag) {
          const normalizedTag = normalizeAlias(filter.tag);
          skills = skills.filter((r) =>
            r.tags?.map(normalizeAlias).includes(normalizedTag),
          );
        }

        return skills.sort((a, b) => a.alias.localeCompare(b.alias));
      } catch {
        return [];
      }
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
        fileContent = matter.stringify(record.content, frontMatter);
      } else {
        fileContent = record.content;
      }

      await fs.writeFile(filePath, fileContent, "utf-8");

      return { ...record, alias: normalized };
    },

    async search(term: string): Promise<SkillRecord[]> {
      const normalizedTerm = term.toLowerCase();
      const allSkills = await this.list();
      const results: SkillRecord[] = [];

      for (const record of allSkills) {
        // Search in alias
        if (record.alias.toLowerCase().includes(normalizedTerm)) {
          results.push(record);
          continue;
        }
        // Search in name
        if (record.name?.toLowerCase().includes(normalizedTerm)) {
          results.push(record);
          continue;
        }
        // Search in description
        if (record.description?.toLowerCase().includes(normalizedTerm)) {
          results.push(record);
          continue;
        }
        // Search in content
        if (record.content.toLowerCase().includes(normalizedTerm)) {
          results.push(record);
          continue;
        }
        // Search in tags
        if (
          record.tags?.some((tag) => tag.toLowerCase().includes(normalizedTerm))
        ) {
          results.push(record);
          continue;
        }
      }

      return results.sort((a, b) => a.alias.localeCompare(b.alias));
    },
  };
}
