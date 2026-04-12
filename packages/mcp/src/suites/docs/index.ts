/**
 * Docs Suite - Documentation services (skill, version, release_notes)
 */
import { fabricService } from "@jaypie/fabric";
import {
  createLayeredStore,
  createMarkdownStore,
  createSkillService,
  type LayeredStoreLayer,
} from "@jaypie/tildeskill";
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
// Environment variables allow overriding paths when bundled (e.g., esbuild Lambda)
const RELEASE_NOTES_PATH =
  process.env.MCP_RELEASE_NOTES_PATH ||
  path.join(__dirname, "..", "..", "..", "release-notes");

// Bundled Jaypie skills ship inside the @jaypie/mcp package. MCP_BUILTIN_SKILLS_PATH
// lets bundlers (esbuild, Lambda) relocate them without disabling the built-in layer.
const BUILTIN_SKILLS_PATH =
  process.env.MCP_BUILTIN_SKILLS_PATH ||
  path.join(__dirname, "..", "..", "..", "skills");

const LOCAL_SKILLS_NAMESPACE = "local";
const JAYPIE_SKILLS_NAMESPACE = "jaypie";
const LAYER_SEPARATOR = ":";

// Skill layers resolved in order: a client's MCP_SKILLS_PATH layers on top of
// the built-in Jaypie skill pack so `skill("aws")` prefers the client's copy
// while still exposing bundled Jaypie docs under the `jaypie:` namespace.
const skillLayers: LayeredStoreLayer[] = [];

if (process.env.MCP_SKILLS_PATH) {
  skillLayers.push({
    namespace: LOCAL_SKILLS_NAMESPACE,
    store: createMarkdownStore({ path: process.env.MCP_SKILLS_PATH }),
  });
}

skillLayers.push({
  namespace: JAYPIE_SKILLS_NAMESPACE,
  store: createMarkdownStore({ path: BUILTIN_SKILLS_PATH }),
});

const skillStore = createLayeredStore({
  layers: skillLayers,
  separator: LAYER_SEPARATOR,
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

interface ReleaseNoteFrontMatter {
  date?: string;
  summary?: string;
  version?: string;
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

export const skillService = createSkillService(skillStore);

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
  return fs.readFile(path.join(__dirname, "release-notes", "help.md"), "utf-8");
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
