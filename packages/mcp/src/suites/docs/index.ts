/**
 * Docs Suite - Documentation services (skill, version, release_notes)
 */
import { BadRequestError } from "@jaypie/errors";
import { fabricService } from "@jaypie/fabric";
import { parseFrontmatter } from "@jaypie/kit";
import {
  createLayeredStore,
  createMarkdownStore,
  createSkillService,
  type LayeredStoreLayer,
} from "@jaypie/tildeskill";
import { existsSync, readdirSync, type Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { gt, rcompare, valid } from "semver";

import {
  getMcpAssetPaths,
  getMcpBuildInfo,
  MCP_ASSET_DIRECTORY,
} from "../../assets.js";
import { RELEASE_NOTES_HELP } from "./help.js";

// Build-time constants
const BUILD_VERSION_STRING = getMcpBuildInfo().versionString;

// =============================================================================
// ASSET PATHS
// =============================================================================

const ENV_BUILTIN_SKILLS_PATH = "MCP_BUILTIN_SKILLS_PATH";
const ENV_RELEASE_NOTES_PATH = "MCP_RELEASE_NOTES_PATH";
const MARKDOWN_EXTENSION = ".md";
const WARNING_PREFIX = "[@jaypie/mcp]";

// A bundler (esbuild) collapses every module into one file, so this module's
// directory is the bundle directory rather than dist/suites/docs/
const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ASSET_PATHS = getMcpAssetPaths();

/**
 * An explicit environment path wins outright. Otherwise the package copy wins,
 * then a copy beside the bundle. Returns the package path when neither exists.
 */
function resolveAssetDirectory({
  bundled,
  envPath,
  packaged,
}: {
  bundled: string;
  envPath?: string;
  packaged: string;
}): string {
  if (envPath) return envPath;
  return (
    [packaged, bundled].find((candidate) => existsSync(candidate)) ?? packaged
  );
}

function hasEntries({
  directory,
  isEntry,
}: {
  directory: string;
  isEntry: (entry: Dirent) => boolean;
}): boolean {
  try {
    return readdirSync(directory, { withFileTypes: true }).some(isEntry);
  } catch {
    return false;
  }
}

/**
 * Warn once, on first use, when an asset directory is missing or empty. Waiting
 * for first use keeps servers that never call the service quiet.
 */
function createAssetCheck({
  directory,
  envName,
  isEntry,
  name,
}: {
  directory: string;
  envName: string;
  isEntry: (entry: Dirent) => boolean;
  name: string;
}): () => void {
  let checked = false;
  return () => {
    if (checked) return;
    checked = true;
    if (hasEntries({ directory, isEntry })) return;
    // stderr keeps the stdio transport's stdout clean and still reaches CloudWatch
    // eslint-disable-next-line no-console
    console.warn(
      `${WARNING_PREFIX} No ${name} found in "${directory}". Copy the ${name} directory from getMcpAssetPaths() in @jaypie/mcp/assets beside the bundle or set ${envName}.`,
    );
  };
}

/** Run `check` before any property of `target` is read */
function withAssetCheck<T extends object>({
  check,
  target,
}: {
  check: () => void;
  target: T;
}): T {
  return new Proxy(target, {
    get(object, property, receiver) {
      check();
      return Reflect.get(object, property, receiver);
    },
  });
}

const RELEASE_NOTES_PATH = resolveAssetDirectory({
  bundled: path.join(MODULE_DIRECTORY, MCP_ASSET_DIRECTORY.RELEASE_NOTES),
  envPath: process.env[ENV_RELEASE_NOTES_PATH],
  packaged: PACKAGE_ASSET_PATHS.releaseNotes,
});

// Bundled Jaypie skills ship inside the @jaypie/mcp package. MCP_BUILTIN_SKILLS_PATH
// relocates them without disabling the built-in layer.
const BUILTIN_SKILLS_PATH = resolveAssetDirectory({
  bundled: path.join(MODULE_DIRECTORY, MCP_ASSET_DIRECTORY.SKILLS),
  envPath: process.env[ENV_BUILTIN_SKILLS_PATH],
  packaged: PACKAGE_ASSET_PATHS.skills,
});

const checkReleaseNoteAssets = createAssetCheck({
  directory: RELEASE_NOTES_PATH,
  envName: ENV_RELEASE_NOTES_PATH,
  isEntry: (entry) => entry.isDirectory(),
  name: MCP_ASSET_DIRECTORY.RELEASE_NOTES,
});

const checkSkillAssets = createAssetCheck({
  directory: BUILTIN_SKILLS_PATH,
  envName: ENV_BUILTIN_SKILLS_PATH,
  isEntry: (entry) => entry.isFile() && entry.name.endsWith(MARKDOWN_EXTENSION),
  name: MCP_ASSET_DIRECTORY.SKILLS,
});

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
  store: withAssetCheck({
    check: checkSkillAssets,
    target: createMarkdownStore({ path: BUILTIN_SKILLS_PATH }),
  }),
});

const skillStore = createLayeredStore({
  layers: skillLayers,
  separator: LAYER_SEPARATOR,
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const CURSOR_ENCODING = "base64url";
const INVALID_CURSOR_MESSAGE =
  'Invalid cursor. Call release_notes("list") to start over.';
const RELEASE_NOTES_LIST_LIMIT = {
  DEFAULT: 50,
  MAXIMUM: 200,
} as const;

interface ReleaseNoteFrontMatter {
  date?: string;
  summary?: string;
  version?: string;
}

interface ReleaseNoteListItem {
  date?: string;
  filename: string;
  packageName: string;
  summary?: string;
  version?: string;
}

/** Decoded form of the opaque `list` cursor */
interface ReleaseNotesListCursor {
  limit?: number;
  offset: number;
  package?: string;
  since_version?: string;
}

function compareText({ a, b }: { a: string; b: string }): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Package ascending, then semver descending. Valid semver sorts before
 * anything else, and filename breaks every remaining tie so the order is total.
 */
function compareReleaseNotes({
  a,
  b,
}: {
  a: ReleaseNoteListItem;
  b: ReleaseNoteListItem;
}): number {
  const byPackage = compareText({ a: a.packageName, b: b.packageName });
  if (byPackage !== 0) return byPackage;

  const aVersion = a.version && valid(a.version);
  const bVersion = b.version && valid(b.version);
  if (aVersion && bVersion) {
    const byVersion = rcompare(aVersion, bVersion);
    if (byVersion !== 0) return byVersion;
  } else if (aVersion) {
    return -1;
  } else if (bVersion) {
    return 1;
  }

  return compareText({ a: b.filename, b: a.filename });
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function encodeListCursor(cursor: ReleaseNotesListCursor): string {
  const ordered: ReleaseNotesListCursor = {
    limit: cursor.limit,
    offset: cursor.offset,
    package: cursor.package,
    since_version: cursor.since_version,
  };
  return Buffer.from(JSON.stringify(ordered)).toString(CURSOR_ENCODING);
}

function decodeListCursor(cursor: unknown): ReleaseNotesListCursor {
  if (typeof cursor !== "string" || cursor.length === 0) {
    throw new BadRequestError(INVALID_CURSOR_MESSAGE);
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(
      Buffer.from(cursor, CURSOR_ENCODING).toString("utf-8"),
    );
  } catch {
    throw new BadRequestError(INVALID_CURSOR_MESSAGE);
  }

  if (typeof decoded !== "object" || decoded === null) {
    throw new BadRequestError(INVALID_CURSOR_MESSAGE);
  }

  const candidate = decoded as Record<string, unknown>;
  const isValid =
    typeof candidate.offset === "number" &&
    Number.isInteger(candidate.offset) &&
    candidate.offset >= 0 &&
    (candidate.limit === undefined ||
      (isPositiveInteger(candidate.limit) &&
        candidate.limit <= RELEASE_NOTES_LIST_LIMIT.MAXIMUM)) &&
    isOptionalString(candidate.package) &&
    isOptionalString(candidate.since_version);

  if (!isValid) {
    throw new BadRequestError(INVALID_CURSOR_MESSAGE);
  }

  return candidate as unknown as ReleaseNotesListCursor;
}

/**
 * Accept a number or numeric string, reject anything below one, and clamp to
 * the maximum
 */
function resolveListLimit(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return RELEASE_NOTES_LIST_LIMIT.DEFAULT;
  }
  const limit = typeof value === "string" ? Number(value) : value;
  if (!isPositiveInteger(limit)) {
    throw new BadRequestError("limit must be a positive integer");
  }
  return Math.min(limit, RELEASE_NOTES_LIST_LIMIT.MAXIMUM);
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
      const frontMatter =
        parseFrontmatter<ReleaseNoteFrontMatter>(content).data;
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

async function getPackageReleaseNotes(
  packageName: string,
): Promise<ReleaseNoteListItem[]> {
  const packageDir = path.join(RELEASE_NOTES_PATH, packageName);
  try {
    const files = await fs.readdir(packageDir);
    const mdFiles = files.filter((file) => file.endsWith(MARKDOWN_EXTENSION));

    return await Promise.all(
      mdFiles.map(async (file) => {
        const parsed = await parseReleaseNoteFile(path.join(packageDir, file));
        return { ...parsed, packageName };
      }),
    );
  } catch {
    return [];
  }
}

function filterReleaseNotesSince(
  notes: ReleaseNoteListItem[],
  sinceVersion: string,
): ReleaseNoteListItem[] {
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

interface ReleaseNotesInput {
  cursor?: string;
  limit?: number | string;
  package?: string;
  since_version?: string;
  version?: string;
}

export const releaseNotesService = fabricService({
  alias: "release_notes",
  description:
    "Browse Jaypie package release notes. Commands: list (paginated), read. Call with no args for help.",
  input: {
    command: {
      description: "Command to execute (omit for help)",
      required: false,
      type: String,
    },
    input: {
      description: `Command parameters. list: package, since_version, limit (default ${RELEASE_NOTES_LIST_LIMIT.DEFAULT}, maximum ${RELEASE_NOTES_LIST_LIMIT.MAXIMUM}), cursor (from the "Next page" footer). read: package, version (both required).`,
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
      return RELEASE_NOTES_HELP;
    }

    checkReleaseNoteAssets();
    const p = params || {};

    switch (command) {
      case "list": {
        const cursor =
          p.cursor === undefined ? undefined : decodeListCursor(p.cursor);
        if (cursor) {
          if (p.package !== undefined && p.package !== cursor.package) {
            throw new BadRequestError(
              "package does not match the cursor. Omit package or start over without a cursor.",
            );
          }
          if (
            p.since_version !== undefined &&
            p.since_version !== cursor.since_version
          ) {
            throw new BadRequestError(
              "since_version does not match the cursor. Omit since_version or start over without a cursor.",
            );
          }
        }

        const limit = resolveListLimit(p.limit ?? cursor?.limit);
        const offset = cursor?.offset ?? 0;
        const packageFilter = cursor ? cursor.package : p.package;
        const sinceVersion = cursor ? cursor.since_version : p.since_version;

        const entries = await fs.readdir(RELEASE_NOTES_PATH, {
          withFileTypes: true,
        });
        const packageDirs = entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name);
        const packagesToList = packageFilter
          ? packageDirs.filter((pkg) => pkg === packageFilter)
          : packageDirs;

        if (packagesToList.length === 0 && packageFilter) {
          return `No release notes found for package "${packageFilter}".`;
        }

        const allNotes = await Promise.all(
          packagesToList.map((pkg) => getPackageReleaseNotes(pkg)),
        );
        let flatNotes = allNotes.flat();

        if (sinceVersion) {
          flatNotes = filterReleaseNotesSince(flatNotes, sinceVersion);
        }

        if (flatNotes.length === 0) {
          const filterDesc = sinceVersion ? ` newer than ${sinceVersion}` : "";
          return `No release notes found${filterDesc}.`;
        }

        if (offset >= flatNotes.length) {
          throw new BadRequestError(INVALID_CURSOR_MESSAGE);
        }

        flatNotes.sort((a, b) => compareReleaseNotes({ a, b }));
        const nextOffset = offset + limit;
        const page = flatNotes
          .slice(offset, nextOffset)
          .map(formatReleaseNoteListItem)
          .join("\n");

        if (nextOffset >= flatNotes.length) {
          return page;
        }

        const nextCursor = encodeListCursor({
          limit,
          offset: nextOffset,
          package: packageFilter,
          since_version: sinceVersion,
        });
        return `${page}\n\nNext page: release_notes("list", { cursor: "${nextCursor}" })`;
      }

      case "read": {
        if (!p.package) throw new BadRequestError("package is required");
        if (!p.version) throw new BadRequestError("version is required");
        const filePath = path.join(
          RELEASE_NOTES_PATH,
          p.package,
          `${p.version}.md`,
        );
        return fs.readFile(filePath, "utf-8");
      }

      default:
        throw new BadRequestError(
          `Unknown command: ${command}. Use release_notes() for help.`,
        );
    }
  },
});
