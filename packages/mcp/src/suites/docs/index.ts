/**
 * Docs Suite - Documentation services (skill, version, release_notes)
 */
import { fabricService } from "@jaypie/fabric";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { gt } from "semver";

// Build-time constants
declare const __BUILD_VERSION_STRING__: string;
const BUILD_VERSION_STRING =
  typeof __BUILD_VERSION_STRING__ !== "undefined"
    ? __BUILD_VERSION_STRING__
    : "@jaypie/mcp@0.0.0";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// From dist/suites/docs/, go up 3 levels to package root where skills/ and release-notes/ live
const RELEASE_NOTES_PATH = path.join(__dirname, "..", "..", "..", "release-notes");
const SKILLS_PATH = path.join(__dirname, "..", "..", "..", "skills");

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

interface ReleaseNoteFrontMatter {
  date?: string;
  summary?: string;
  version?: string;
}

interface SkillFrontMatter {
  description?: string;
}

function isValidSkillAlias(alias: string): boolean {
  const normalized = alias.toLowerCase().trim();
  if (
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized.includes("..")
  ) {
    return false;
  }
  return /^[a-z0-9_-]+$/.test(normalized);
}

async function parseReleaseNoteFile(filePath: string): Promise<{
  date?: string;
  filename: string;
  summary?: string;
  version?: string;
}> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const filename = path.basename(filePath, ".md");

    if (content.startsWith("---")) {
      const parsed = matter(content);
      const frontMatter = parsed.data as ReleaseNoteFrontMatter;
      return {
        date: frontMatter.date,
        filename,
        summary: frontMatter.summary,
        version: frontMatter.version || filename,
      };
    }

    return { filename, version: filename };
  } catch {
    return { filename: path.basename(filePath, ".md") };
  }
}

function formatReleaseNoteListItem(note: {
  date?: string;
  filename: string;
  packageName: string;
  summary?: string;
  version?: string;
}): string {
  const { date, packageName, summary, version } = note;
  const parts = [`* ${packageName}@${version}`];

  if (date) {
    parts.push(`(${date})`);
  }

  if (summary) {
    parts.push(`- ${summary}`);
  }

  return parts.join(" ");
}

async function parseSkillFile(filePath: string): Promise<{
  alias: string;
  description?: string;
}> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const alias = path.basename(filePath, ".md");

    if (content.startsWith("---")) {
      const parsed = matter(content);
      const frontMatter = parsed.data as SkillFrontMatter;
      return {
        alias,
        description: frontMatter.description,
      };
    }

    return { alias };
  } catch {
    return { alias: path.basename(filePath, ".md") };
  }
}

function formatSkillListItem(skill: {
  alias: string;
  description?: string;
}): string {
  const { alias, description } = skill;
  if (description) {
    return `* ${alias} - ${description}`;
  }
  return `* ${alias}`;
}

async function getPackageReleaseNotes(packageName: string): Promise<
  Array<{
    date?: string;
    filename: string;
    packageName: string;
    summary?: string;
    version?: string;
  }>
> {
  const packageDir = path.join(RELEASE_NOTES_PATH, packageName);
  try {
    const files = await fs.readdir(packageDir);
    const mdFiles = files.filter((file) => file.endsWith(".md"));

    const notes = await Promise.all(
      mdFiles.map(async (file) => {
        const parsed = await parseReleaseNoteFile(path.join(packageDir, file));
        return { ...parsed, packageName };
      }),
    );

    return notes.sort((a, b) => {
      if (!a.version || !b.version) return 0;
      try {
        return gt(a.version, b.version) ? -1 : 1;
      } catch {
        return b.version.localeCompare(a.version);
      }
    });
  } catch {
    return [];
  }
}

function filterReleaseNotesSince(
  notes: Array<{
    date?: string;
    filename: string;
    packageName: string;
    summary?: string;
    version?: string;
  }>,
  sinceVersion: string,
): Array<{
  date?: string;
  filename: string;
  packageName: string;
  summary?: string;
  version?: string;
}> {
  return notes.filter((note) => {
    if (!note.version) return false;
    try {
      return gt(note.version, sinceVersion);
    } catch {
      return false;
    }
  });
}

// =============================================================================
// SKILL SERVICE
// =============================================================================

export const skillService = fabricService({
  alias: "skill",
  description:
    "Access Jaypie development documentation. Pass a skill alias (e.g., 'aws', 'tests', 'errors') to get that documentation. Pass 'index' or no argument to list all available skills.",
  input: {
    alias: {
      description:
        "Skill alias (e.g., 'aws', 'tests'). Omit or use 'index' to list all skills.",
      required: false,
      type: String,
    },
  },
  service: async ({ alias: inputAlias }: { alias?: string }) => {
    const alias = (inputAlias || "index").toLowerCase().trim();

    if (!isValidSkillAlias(alias)) {
      throw new Error(
        `Invalid skill alias "${alias}". Use alphanumeric characters, hyphens, and underscores only.`,
      );
    }

    if (alias === "index") {
      const indexPath = path.join(SKILLS_PATH, "index.md");
      let indexContent = "";

      try {
        indexContent = await fs.readFile(indexPath, "utf-8");
        if (indexContent.startsWith("---")) {
          const parsed = matter(indexContent);
          indexContent = parsed.content.trim();
        }
      } catch {
        // Index file doesn't exist, will just show skill list
      }

      const files = await fs.readdir(SKILLS_PATH);
      const mdFiles = files.filter(
        (file) => file.endsWith(".md") && file !== "index.md",
      );

      const skills = await Promise.all(
        mdFiles.map((file) => parseSkillFile(path.join(SKILLS_PATH, file))),
      );

      skills.sort((a, b) => a.alias.localeCompare(b.alias));

      const skillList = skills.map(formatSkillListItem).join("\n");

      if (indexContent) {
        return `${indexContent}\n\n## Available Skills\n\n${skillList}`;
      }
      return `# Jaypie Skills\n\n## Available Skills\n\n${skillList}`;
    }

    const skillPath = path.join(SKILLS_PATH, `${alias}.md`);
    try {
      return await fs.readFile(skillPath, "utf-8");
    } catch {
      throw new Error(
        `Skill "${alias}" not found. Use skill("index") to list available skills.`,
      );
    }
  },
});

// =============================================================================
// VERSION SERVICE
// =============================================================================

export const versionService = fabricService({
  alias: "version",
  description: `Prints the current version and hash, \`${BUILD_VERSION_STRING}\``,
  input: {},
  service: async () => BUILD_VERSION_STRING,
});

// =============================================================================
// RELEASE NOTES SERVICE
// =============================================================================

async function getReleaseNotesHelp(): Promise<string> {
  return fs.readFile(
    path.join(__dirname, "release-notes", "help.md"),
    "utf-8",
  );
}

interface ReleaseNotesInput {
  package?: string;
  since_version?: string;
  version?: string;
}

export const releaseNotesService = fabricService({
  alias: "release_notes",
  description:
    "Browse Jaypie package release notes. Commands: list, read. Call with no args for help.",
  input: {
    command: {
      description: "Command to execute (omit for help)",
      required: false,
      type: String,
    },
    input: {
      description: "Command parameters",
      required: false,
      type: Object,
    },
  },
  service: async ({
    command,
    input: params,
  }: {
    command?: string;
    input?: ReleaseNotesInput;
  }) => {
    if (!command || command === "help") {
      return getReleaseNotesHelp();
    }

    const p = params || {};

    switch (command) {
      case "list": {
        const entries = await fs.readdir(RELEASE_NOTES_PATH, {
          withFileTypes: true,
        });
        const packageDirs = entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name);
        const packagesToList = p.package
          ? packageDirs.filter((pkg) => pkg === p.package)
          : packageDirs;

        if (packagesToList.length === 0 && p.package) {
          return `No release notes found for package "${p.package}".`;
        }

        const allNotes = await Promise.all(
          packagesToList.map((pkg) => getPackageReleaseNotes(pkg)),
        );
        let flatNotes = allNotes.flat();

        if (p.since_version) {
          flatNotes = filterReleaseNotesSince(flatNotes, p.since_version);
        }

        if (flatNotes.length === 0) {
          const filterDesc = p.since_version
            ? ` newer than ${p.since_version}`
            : "";
          return `No release notes found${filterDesc}.`;
        }

        return flatNotes.map(formatReleaseNoteListItem).join("\n");
      }

      case "read": {
        if (!p.package) throw new Error("package is required");
        if (!p.version) throw new Error("version is required");
        const filePath = path.join(
          RELEASE_NOTES_PATH,
          p.package,
          `${p.version}.md`,
        );
        return fs.readFile(filePath, "utf-8");
      }

      default:
        throw new Error(
          `Unknown command: ${command}. Use release_notes() for help.`,
        );
    }
  },
});
