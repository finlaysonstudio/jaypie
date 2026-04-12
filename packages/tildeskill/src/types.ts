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
  /** Auto-expand these skill aliases on lookup */
  includes?: string[];
  /** Display title for the skill */
  name?: string;
  /** Alternate lookup keys for getByNickname (multiple records may share a nickname) */
  nicknames?: string[];
  /** Related skill aliases */
  related?: string[];
  /** Categorization tags */
  tags?: string[];
}

/**
 * Filter options for listing skills
 */
export interface ListFilter {
  /** Namespace prefix matching (e.g., "kit:*") */
  namespace?: string;
  /** Filter by tag */
  tag?: string;
}

/**
 * Storage interface for skill records
 */
export interface SkillStore {
  /**
   * Retrieve a skill by alias, trying alternative plural/singular spellings
   * when an exact match is not found. Returns null if nothing resolves.
   */
  find(alias: string): Promise<SkillRecord | null>;
  /** Retrieve a skill by alias, returns null if not found */
  get(alias: string): Promise<SkillRecord | null>;
  /**
   * Retrieve all skills whose nicknames include the given value.
   * Returns an empty array when nothing matches. Multiple records may share
   * a nickname (e.g., "sparticus" hitting several layers).
   */
  getByNickname(nickname: string): Promise<SkillRecord[]>;
  /** List all skills in the store, optionally filtered */
  list(filter?: ListFilter): Promise<SkillRecord[]>;
  /** Store or update a skill record */
  put(record: SkillRecord): Promise<SkillRecord>;
  /** Search skills by term in alias, name, description, content, and tags */
  search(term: string): Promise<SkillRecord[]>;
}

/**
 * Options for creating a markdown store
 */
export interface MarkdownStoreOptions {
  /** Path to directory containing .md files */
  path: string;
}

/**
 * A single layer in a layered skill store
 */
export interface LayeredStoreLayer {
  /** Namespace prefix applied to records surfaced from this layer (e.g., "local", "jaypie") */
  namespace: string;
  /** Underlying store that backs this layer */
  store: SkillStore;
}

/**
 * Options for creating a layered skill store
 */
export interface LayeredStoreOptions {
  /** Ordered list of layers; earlier layers win for single-result lookups */
  layers: LayeredStoreLayer[];
  /** Separator between namespace and inner alias; defaults to ":" */
  separator?: string;
}

/**
 * Frontmatter structure in skill markdown files
 */
export interface SkillFrontMatter {
  /** Brief description shown in listings */
  description?: string;
  /** Comma-separated or array of skill aliases to auto-expand */
  includes?: string | string[];
  /** Display title for the skill */
  name?: string;
  /** Comma-separated or array of alternate lookup keys */
  nicknames?: string | string[];
  /** Comma-separated or array of related skill aliases */
  related?: string | string[];
  /** Comma-separated or array of categorization tags */
  tags?: string | string[];
}
