import * as fs from "node:fs/promises";
import * as path from "node:path";

import matter from "gray-matter";

import { normalizeAlias, parseList } from "../core/normalize";
import type {
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
      related: parseList(frontMatter.related),
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

    async list(): Promise<SkillRecord[]> {
      try {
        const files = await fs.readdir(storePath);
        const mdFiles = files.filter((file) => file.endsWith(".md"));

        const skills = await Promise.all(
          mdFiles.map((file) => parseSkillFile(path.join(storePath, file))),
        );

        return skills.sort((a, b) => a.alias.localeCompare(b.alias));
      } catch {
        return [];
      }
    },

    async put(record: SkillRecord): Promise<SkillRecord> {
      const normalized = normalizeAlias(record.alias);
      const filePath = path.join(storePath, `${normalized}.md`);

      // Build frontmatter
      const frontMatter: Record<string, string | string[]> = {};
      if (record.description) {
        frontMatter.description = record.description;
      }
      if (record.related && record.related.length > 0) {
        frontMatter.related = record.related.join(", ");
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
  };
}
