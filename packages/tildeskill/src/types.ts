/**
 * A skill record containing content and metadata
 */
export interface SkillRecord {
  /** Lookup key (normalized lowercase) */
  alias: string;
  /** Markdown body content */
  content: string;
  /** Brief description from frontmatter */
  description?: string;
  /** Related skill aliases */
  related?: string[];
}

/**
 * Storage interface for skill records
 */
export interface SkillStore {
  /** Retrieve a skill by alias, returns null if not found */
  get(alias: string): Promise<SkillRecord | null>;
  /** List all skills in the store */
  list(): Promise<SkillRecord[]>;
  /** Store or update a skill record */
  put(record: SkillRecord): Promise<SkillRecord>;
}

/**
 * Options for creating a markdown store
 */
export interface MarkdownStoreOptions {
  /** Path to directory containing .md files */
  path: string;
}

/**
 * Frontmatter structure in skill markdown files
 */
export interface SkillFrontMatter {
  /** Brief description shown in listings */
  description?: string;
  /** Comma-separated or array of related skill aliases */
  related?: string | string[];
}
