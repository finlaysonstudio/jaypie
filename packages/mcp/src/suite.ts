// ServiceSuite for @jaypie/mcp
// Provides metadata and direct execution for Jaypie MCP services

import { createServiceSuite, fabricService } from "@jaypie/fabric";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { gt } from "semver";

import {
  aggregateDatadogLogs,
  getDatadogCredentials,
  getDatadogSyntheticResults,
  listDatadogMonitors,
  listDatadogSynthetics,
  queryDatadogMetrics,
  searchDatadogLogs,
  searchDatadogRum,
} from "./datadog.js";
import { debugLlmCall, listLlmProviders, type LlmProvider } from "./llm.js";
import {
  describeDynamoDBTable,
  describeStack,
  filterLogEvents,
  getDynamoDBItem,
  getLambdaFunction,
  getSQSQueueAttributes,
  listAwsProfiles,
  listLambdaFunctions,
  listS3Objects,
  listSQSQueues,
  listStepFunctionExecutions,
  purgeSQSQueue,
  queryDynamoDB,
  receiveSQSMessage,
  scanDynamoDB,
  stopStepFunctionExecution,
} from "./aws.js";

// Build-time constants
declare const __BUILD_VERSION_STRING__: string;
const BUILD_VERSION_STRING =
  typeof __BUILD_VERSION_STRING__ !== "undefined"
    ? __BUILD_VERSION_STRING__
    : "@jaypie/mcp@0.0.0";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROMPTS_PATH = path.join(__dirname, "..", "prompts");
const RELEASE_NOTES_PATH = path.join(__dirname, "..", "release-notes");
const SKILLS_PATH = path.join(__dirname, "..", "skills");

// Silent logger for direct execution
const log = {
  info: () => {},
  error: () => {},
};

// Helper functions from createMcpServer.ts
interface FrontMatter {
  description?: string;
  include?: string;
  globs?: string;
}

interface ReleaseNoteFrontMatter {
  date?: string;
  summary?: string;
  version?: string;
}

async function parseMarkdownFile(filePath: string): Promise<{
  filename: string;
  description?: string;
  include?: string;
}> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const filename = path.basename(filePath);

    if (content.startsWith("---")) {
      const parsed = matter(content);
      const frontMatter = parsed.data as FrontMatter;
      return {
        filename,
        description: frontMatter.description,
        include: frontMatter.include || frontMatter.globs,
      };
    }

    return { filename };
  } catch {
    return { filename: path.basename(filePath) };
  }
}

function formatPromptListItem(prompt: {
  filename: string;
  description?: string;
  include?: string;
}): string {
  const { filename, description, include } = prompt;

  if (description && include) {
    return `* ${filename}: ${description} - Required for ${include}`;
  } else if (description) {
    return `* ${filename}: ${description}`;
  } else if (include) {
    return `* ${filename} - Required for ${include}`;
  } else {
    return `* ${filename}`;
  }
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

// Skill helper functions
interface SkillFrontMatter {
  description?: string;
}

function isValidSkillAlias(alias: string): boolean {
  const normalized = alias.toLowerCase().trim();
  // Reject if contains path separators or traversal
  if (
    normalized.includes("/") ||
    normalized.includes("\\") ||
    normalized.includes("..")
  ) {
    return false;
  }
  // Only allow alphanumeric, hyphens, underscores
  return /^[a-z0-9_-]+$/.test(normalized);
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
// DOCS SERVICES
// =============================================================================

const version = fabricService({
  alias: "version",
  description: `Prints the current version and hash, \`${BUILD_VERSION_STRING}\``,
  input: {},
  service: async () => BUILD_VERSION_STRING,
});

const skill = fabricService({
  alias: "skill",
  description:
    "Access Jaypie development documentation. Pass a skill alias (e.g., 'aws', 'tests', 'errors') to get that documentation. Pass 'index' or no argument to list all available skills.",
  input: {
    alias: {
      type: String,
      required: false,
      description:
        "Skill alias (e.g., 'aws', 'tests'). Omit or use 'index' to list all skills.",
    },
  },
  service: async ({ alias: inputAlias }: { alias?: string }) => {
    const alias = (inputAlias || "index").toLowerCase().trim();

    // Security: validate alias to prevent path traversal
    if (!isValidSkillAlias(alias)) {
      throw new Error(
        `Invalid skill alias "${alias}". Use alphanumeric characters, hyphens, and underscores only.`,
      );
    }

    // If requesting index, return list of all skills with descriptions
    if (alias === "index") {
      const indexPath = path.join(SKILLS_PATH, "index.md");
      let indexContent = "";

      try {
        indexContent = await fs.readFile(indexPath, "utf-8");
        // Strip frontmatter for display
        if (indexContent.startsWith("---")) {
          const parsed = matter(indexContent);
          indexContent = parsed.content.trim();
        }
      } catch {
        // Index file doesn't exist, will just show skill list
      }

      // Get all skill files
      const files = await fs.readdir(SKILLS_PATH);
      const mdFiles = files.filter(
        (file) => file.endsWith(".md") && file !== "index.md",
      );

      const skills = await Promise.all(
        mdFiles.map((file) => parseSkillFile(path.join(SKILLS_PATH, file))),
      );

      // Sort alphabetically
      skills.sort((a, b) => a.alias.localeCompare(b.alias));

      const skillList = skills.map(formatSkillListItem).join("\n");

      if (indexContent) {
        return `${indexContent}\n\n## Available Skills\n\n${skillList}`;
      }
      return `# Jaypie Skills\n\n## Available Skills\n\n${skillList}`;
    }

    // Read specific skill file
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

const listPrompts = fabricService({
  alias: "list_prompts",
  description:
    "[DEPRECATED: Use skill('index') instead] List available Jaypie development prompts and guides. Use this FIRST when starting work on a Jaypie project to discover relevant documentation. Returns filenames, descriptions, and which file patterns each prompt applies to (e.g., 'Required for packages/express/**').",
  input: {},
  service: async () => {
    const files = await fs.readdir(PROMPTS_PATH);
    const mdFiles = files.filter((file) => file.endsWith(".md"));
    const prompts = await Promise.all(
      mdFiles.map((file) => parseMarkdownFile(path.join(PROMPTS_PATH, file))),
    );
    return (
      prompts.map(formatPromptListItem).join("\n") ||
      "No .md files found in the prompts directory."
    );
  },
});

const readPrompt = fabricService({
  alias: "read_prompt",
  description:
    "[DEPRECATED: Use skill(alias) instead] Read a Jaypie prompt/guide by filename. Call list_prompts first to see available prompts. These contain best practices, templates, code patterns, and step-by-step guides for Jaypie development tasks.",
  input: {
    filename: {
      type: String,
      required: true,
      description:
        "The prompt filename from list_prompts (e.g., 'Jaypie_Express_Package.md', 'Development_Process.md')",
    },
  },
  service: async ({ filename }: { filename: string }) => {
    const filePath = path.join(PROMPTS_PATH, filename);
    return fs.readFile(filePath, "utf-8");
  },
});

const listReleaseNotes = fabricService({
  alias: "list_release_notes",
  description:
    "List available release notes for Jaypie packages. Filter by package name and/or get only versions newer than a specified version.",
  input: {
    package: {
      type: String,
      required: false,
      description:
        "Filter by package name (e.g., 'jaypie', 'mcp'). If not provided, lists release notes for all packages.",
    },
    since_version: {
      type: String,
      required: false,
      description:
        "Only show versions newer than this (e.g., '1.0.0'). Uses semver comparison.",
    },
  },
  service: async ({
    package: packageFilter,
    since_version: sinceVersion,
  }: {
    package?: string;
    since_version?: string;
  }) => {
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

    return flatNotes.map(formatReleaseNoteListItem).join("\n");
  },
});

const readReleaseNote = fabricService({
  alias: "read_release_note",
  description:
    "Read the full content of a specific release note. Call list_release_notes first to see available versions.",
  input: {
    package: {
      type: String,
      required: true,
      description: "Package name (e.g., 'jaypie', 'mcp')",
    },
    version: {
      type: String,
      required: true,
      description: "Version number (e.g., '1.2.3')",
    },
  },
  service: async ({
    package: packageName,
    version: ver,
  }: {
    package: string;
    version: string;
  }) => {
    const filePath = path.join(RELEASE_NOTES_PATH, packageName, `${ver}.md`);
    return fs.readFile(filePath, "utf-8");
  },
});

// =============================================================================
// DATADOG SERVICES
// =============================================================================

const datadogLogs = fabricService({
  alias: "datadog_logs",
  description:
    "Search and retrieve individual Datadog log entries. Use this to view actual log messages and details. For aggregated counts/statistics (e.g., 'how many errors by service?'), use datadog_log_analytics instead. Requires DATADOG_API_KEY and DATADOG_APP_KEY environment variables.",
  input: {
    query: {
      type: String,
      required: false,
      description:
        "Search query to filter logs. Examples: 'status:error', '@http.status_code:500', '*timeout*', '@requestId:abc123'. Combined with DD_ENV, DD_SERVICE, DD_SOURCE env vars if set.",
    },
    source: {
      type: String,
      required: false,
      description:
        "Override the log source (e.g., 'lambda', 'auth0', 'nginx'). If not provided, uses DD_SOURCE env var or defaults to 'lambda'.",
    },
    env: {
      type: String,
      required: false,
      description:
        "Override the environment (e.g., 'sandbox', 'kitchen', 'lab', 'studio', 'production'). If not provided, uses DD_ENV env var.",
    },
    service: {
      type: String,
      required: false,
      description:
        "Override the service name. If not provided, uses DD_SERVICE env var.",
    },
    from: {
      type: String,
      required: false,
      description:
        "Start time. Formats: relative ('now-15m', 'now-1h', 'now-1d'), ISO 8601 ('2024-01-15T10:00:00Z'). Defaults to 'now-15m'.",
    },
    to: {
      type: String,
      required: false,
      description:
        "End time. Formats: 'now', relative ('now-5m'), or ISO 8601. Defaults to 'now'.",
    },
    limit: {
      type: Number,
      required: false,
      description: "Max logs to return (1-1000). Defaults to 50.",
    },
    sort: {
      type: ["timestamp", "-timestamp"] as const,
      required: false,
      description:
        "Sort order: 'timestamp' (oldest first) or '-timestamp' (newest first, default).",
    },
  },
  service: async (input: {
    query?: string;
    source?: string;
    env?: string;
    service?: string;
    from?: string;
    to?: string;
    limit?: number;
    sort?: "timestamp" | "-timestamp";
  }) => {
    const credentials = getDatadogCredentials();
    if (!credentials) {
      throw new Error(
        "Datadog credentials not found. Set DATADOG_API_KEY and DATADOG_APP_KEY.",
      );
    }
    const result = await searchDatadogLogs(credentials, input, log);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result;
  },
});

const datadogLogAnalytics = fabricService({
  alias: "datadog_log_analytics",
  description:
    "Aggregate and analyze Datadog logs by grouping them by fields. Use this for statistics and counts (e.g., 'errors by service', 'requests by status code'). For viewing individual log entries, use datadog_logs instead.",
  input: {
    groupBy: {
      type: [String],
      required: true,
      description:
        "Fields to group by. Examples: ['source'], ['service', 'status'], ['@http.status_code']. Common facets: source, service, status, host, @http.status_code, @env.",
    },
    query: {
      type: String,
      required: false,
      description:
        "Filter query. Examples: 'status:error', '*timeout*', '@http.method:POST'. Use '*' for all logs.",
    },
    source: {
      type: String,
      required: false,
      description:
        "Override the log source filter. Use '*' to include all sources. If not provided, uses DD_SOURCE env var or defaults to 'lambda'.",
    },
    env: {
      type: String,
      required: false,
      description:
        "Override the environment filter. If not provided, uses DD_ENV env var.",
    },
    service: {
      type: String,
      required: false,
      description:
        "Override the service name filter. If not provided, uses DD_SERVICE env var.",
    },
    from: {
      type: String,
      required: false,
      description:
        "Start time. Formats: relative ('now-15m', 'now-1h', 'now-1d'), ISO 8601 ('2024-01-15T10:00:00Z'). Defaults to 'now-15m'.",
    },
    to: {
      type: String,
      required: false,
      description:
        "End time. Formats: 'now', relative ('now-5m'), or ISO 8601. Defaults to 'now'.",
    },
    aggregation: {
      type: ["count", "avg", "sum", "min", "max", "cardinality"] as const,
      required: false,
      description:
        "Aggregation type. 'count' counts logs, others require a metric field. Defaults to 'count'.",
    },
    metric: {
      type: String,
      required: false,
      description:
        "Metric field to aggregate when using avg, sum, min, max, or cardinality. E.g., '@duration', '@http.response_time'.",
    },
  },
  service: async (input: {
    groupBy: string[];
    query?: string;
    source?: string;
    env?: string;
    service?: string;
    from?: string;
    to?: string;
    aggregation?: "count" | "avg" | "sum" | "min" | "max" | "cardinality";
    metric?: string;
  }) => {
    const credentials = getDatadogCredentials();
    if (!credentials) {
      throw new Error(
        "Datadog credentials not found. Set DATADOG_API_KEY and DATADOG_APP_KEY.",
      );
    }
    const compute = input.aggregation
      ? [{ aggregation: input.aggregation, metric: input.metric }]
      : [{ aggregation: "count" as const }];
    const result = await aggregateDatadogLogs(
      credentials,
      { ...input, compute },
      log,
    );
    if (!result.success) {
      throw new Error(result.error);
    }
    return result;
  },
});

const datadogMonitors = fabricService({
  alias: "datadog_monitors",
  description:
    "List and check Datadog monitors. Shows monitor status (Alert, Warn, No Data, OK), name, type, and tags. Useful for quickly checking if any monitors are alerting.",
  input: {
    status: {
      type: Array,
      required: false,
      description:
        "Filter monitors by status. E.g., ['Alert', 'Warn'] to see only alerting monitors.",
    },
    tags: {
      type: Array,
      required: false,
      description:
        "Filter monitors by resource tags (tags on the monitored resources).",
    },
    monitorTags: {
      type: Array,
      required: false,
      description:
        "Filter monitors by monitor tags (tags on the monitor itself).",
    },
    name: {
      type: String,
      required: false,
      description: "Filter monitors by name (partial match supported).",
    },
  },
  service: async (input: {
    status?: ("Alert" | "Warn" | "No Data" | "OK")[];
    tags?: string[];
    monitorTags?: string[];
    name?: string;
  }) => {
    const credentials = getDatadogCredentials();
    if (!credentials) {
      throw new Error(
        "Datadog credentials not found. Set DATADOG_API_KEY and DATADOG_APP_KEY.",
      );
    }
    const result = await listDatadogMonitors(credentials, input, log);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result;
  },
});

const datadogSynthetics = fabricService({
  alias: "datadog_synthetics",
  description:
    "List Datadog Synthetic tests and optionally get recent results for a specific test. Shows test status, type (api/browser), and locations.",
  input: {
    type: {
      type: ["api", "browser"] as const,
      required: false,
      description: "Filter tests by type: 'api' or 'browser'.",
    },
    tags: {
      type: Array,
      required: false,
      description: "Filter tests by tags.",
    },
    testId: {
      type: String,
      required: false,
      description:
        "If provided, fetches recent results for this specific test (public_id). Otherwise lists all tests.",
    },
  },
  service: async (input: {
    type?: "api" | "browser";
    tags?: string[];
    testId?: string;
  }) => {
    const credentials = getDatadogCredentials();
    if (!credentials) {
      throw new Error(
        "Datadog credentials not found. Set DATADOG_API_KEY and DATADOG_APP_KEY.",
      );
    }
    if (input.testId) {
      const result = await getDatadogSyntheticResults(
        credentials,
        input.testId,
        log,
      );
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    }
    const result = await listDatadogSynthetics(credentials, input, log);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result;
  },
});

const datadogMetrics = fabricService({
  alias: "datadog_metrics",
  description:
    "Query Datadog metrics. Returns timeseries data for the specified metric query. Useful for checking specific metric values.",
  input: {
    query: {
      type: String,
      required: true,
      description:
        "Metric query. Format: 'aggregation:metric.name{tags}'. Examples: 'avg:system.cpu.user{*}', 'sum:aws.lambda.invocations{function:my-func}.as_count()', 'max:aws.lambda.duration{env:production}'.",
    },
    from: {
      type: String,
      required: false,
      description:
        "Start time. Formats: relative ('1h', '30m', '1d'), or Unix timestamp. Defaults to '1h'.",
    },
    to: {
      type: String,
      required: false,
      description:
        "End time. Formats: 'now' or Unix timestamp. Defaults to 'now'.",
    },
  },
  service: async (input: { query: string; from?: string; to?: string }) => {
    const credentials = getDatadogCredentials();
    if (!credentials) {
      throw new Error(
        "Datadog credentials not found. Set DATADOG_API_KEY and DATADOG_APP_KEY.",
      );
    }
    const now = Math.floor(Date.now() / 1000);
    const fromStr = input.from || "1h";
    let fromTs: number;
    if (fromStr.match(/^\d+$/)) {
      fromTs = parseInt(fromStr, 10);
    } else if (fromStr.match(/^(\d+)h$/)) {
      const hours = parseInt(fromStr.match(/^(\d+)h$/)![1], 10);
      fromTs = now - hours * 3600;
    } else if (fromStr.match(/^(\d+)m$/)) {
      const minutes = parseInt(fromStr.match(/^(\d+)m$/)![1], 10);
      fromTs = now - minutes * 60;
    } else if (fromStr.match(/^(\d+)d$/)) {
      const days = parseInt(fromStr.match(/^(\d+)d$/)![1], 10);
      fromTs = now - days * 86400;
    } else {
      fromTs = now - 3600;
    }
    const toStr = input.to || "now";
    const toTs = toStr === "now" ? now : parseInt(toStr, 10);
    const result = await queryDatadogMetrics(
      credentials,
      { query: input.query, from: fromTs, to: toTs },
      log,
    );
    if (!result.success) {
      throw new Error(result.error);
    }
    return result;
  },
});

const datadogRum = fabricService({
  alias: "datadog_rum",
  description:
    "Search Datadog RUM (Real User Monitoring) events. Find user sessions, page views, errors, and actions. Useful for debugging frontend issues and understanding user behavior.",
  input: {
    query: {
      type: String,
      required: false,
      description:
        "RUM search query. E.g., '@type:error', '@session.id:abc123', '@view.url:*checkout*'. Defaults to '*' (all events).",
    },
    from: {
      type: String,
      required: false,
      description:
        "Start time. Formats: relative ('now-15m', 'now-1h', 'now-1d'), ISO 8601 ('2024-01-15T10:00:00Z'). Defaults to 'now-15m'.",
    },
    to: {
      type: String,
      required: false,
      description:
        "End time. Formats: 'now', relative ('now-5m'), or ISO 8601. Defaults to 'now'.",
    },
    limit: {
      type: Number,
      required: false,
      description: "Max events to return (1-1000). Defaults to 50.",
    },
  },
  service: async (input: {
    query?: string;
    from?: string;
    to?: string;
    limit?: number;
  }) => {
    const credentials = getDatadogCredentials();
    if (!credentials) {
      throw new Error(
        "Datadog credentials not found. Set DATADOG_API_KEY and DATADOG_APP_KEY.",
      );
    }
    const result = await searchDatadogRum(credentials, input, log);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result;
  },
});

// =============================================================================
// LLM SERVICES
// =============================================================================

const llmDebugCall = fabricService({
  alias: "llm_debug_call",
  description:
    "Make a debug LLM API call and inspect the raw response. Useful for understanding how each provider formats responses, especially for reasoning/thinking content. Returns full history, raw responses, and extracted reasoning.",
  input: {
    provider: {
      type: ["anthropic", "gemini", "openai", "openrouter"] as const,
      required: true,
      description: "LLM provider to call",
    },
    model: {
      type: String,
      required: false,
      description:
        "Model to use. If not provided, uses a sensible default. For reasoning tests, try 'o3-mini' with openai.",
    },
    message: {
      type: String,
      required: true,
      description:
        "Message to send to the LLM. For reasoning tests, try something that requires thinking like 'What is 15 * 17? Think step by step.'",
    },
  },
  service: async (input: {
    provider: "anthropic" | "gemini" | "openai" | "openrouter";
    model?: string;
    message: string;
  }) => {
    const result = await debugLlmCall(
      {
        provider: input.provider as LlmProvider,
        model: input.model,
        message: input.message,
      },
      log,
    );
    if (!result.success) {
      throw new Error(result.error);
    }
    return result;
  },
});

const llmListProviders = fabricService({
  alias: "llm_list_providers",
  description:
    "List available LLM providers with their default and reasoning-capable models.",
  input: {},
  service: async () => listLlmProviders(),
});

// =============================================================================
// AWS SERVICES
// =============================================================================

const awsListProfiles = fabricService({
  alias: "aws_list_profiles",
  description:
    "List available AWS profiles from ~/.aws/config and credentials.",
  input: {},
  service: async () => {
    const result = await listAwsProfiles(log);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },
});

const awsStepfunctionsListExecutions = fabricService({
  alias: "aws_stepfunctions_list_executions",
  description:
    "List Step Function executions for a state machine. Useful for finding stuck or running executions.",
  input: {
    stateMachineArn: {
      type: String,
      required: true,
      description: "ARN of the state machine",
    },
    statusFilter: {
      type: [
        "RUNNING",
        "SUCCEEDED",
        "FAILED",
        "TIMED_OUT",
        "ABORTED",
        "PENDING_REDRIVE",
      ] as const,
      required: false,
      description: "Filter by execution status",
    },
    profile: {
      type: String,
      required: false,
      description: "AWS profile to use",
    },
    region: {
      type: String,
      required: false,
      description: "AWS region",
    },
    maxResults: {
      type: Number,
      required: false,
      description: "Max results (1-1000, default 100)",
    },
  },
  service: async (input: {
    stateMachineArn: string;
    statusFilter?:
      | "RUNNING"
      | "SUCCEEDED"
      | "FAILED"
      | "TIMED_OUT"
      | "ABORTED"
      | "PENDING_REDRIVE";
    profile?: string;
    region?: string;
    maxResults?: number;
  }) => {
    const result = await listStepFunctionExecutions(input, log);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },
});

const awsStepfunctionsStopExecution = fabricService({
  alias: "aws_stepfunctions_stop_execution",
  description:
    "Stop a running Step Function execution. Use with caution - this will abort the workflow.",
  input: {
    executionArn: {
      type: String,
      required: true,
      description: "ARN of the execution to stop",
    },
    cause: {
      type: String,
      required: false,
      description: "Description of why the execution was stopped",
    },
    profile: {
      type: String,
      required: false,
      description: "AWS profile to use",
    },
    region: {
      type: String,
      required: false,
      description: "AWS region",
    },
  },
  service: async (input: {
    executionArn: string;
    cause?: string;
    profile?: string;
    region?: string;
  }) => {
    const result = await stopStepFunctionExecution(input, log);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },
});

const awsLambdaListFunctions = fabricService({
  alias: "aws_lambda_list_functions",
  description:
    "List Lambda functions in the account. Filter by function name prefix.",
  input: {
    functionNamePrefix: {
      type: String,
      required: false,
      description: "Filter by function name prefix",
    },
    profile: {
      type: String,
      required: false,
      description: "AWS profile to use",
    },
    region: {
      type: String,
      required: false,
      description: "AWS region",
    },
    maxResults: {
      type: Number,
      required: false,
      description: "Max results to return",
    },
  },
  service: async (input: {
    functionNamePrefix?: string;
    profile?: string;
    region?: string;
    maxResults?: number;
  }) => {
    const result = await listLambdaFunctions(input, log);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },
});

const awsLambdaGetFunction = fabricService({
  alias: "aws_lambda_get_function",
  description: "Get configuration and details for a specific Lambda function.",
  input: {
    functionName: {
      type: String,
      required: true,
      description: "Function name or ARN",
    },
    profile: {
      type: String,
      required: false,
      description: "AWS profile to use",
    },
    region: {
      type: String,
      required: false,
      description: "AWS region",
    },
  },
  service: async (input: {
    functionName: string;
    profile?: string;
    region?: string;
  }) => {
    const result = await getLambdaFunction(input, log);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },
});

const awsLogsFilterLogEvents = fabricService({
  alias: "aws_logs_filter_log_events",
  description:
    "Search CloudWatch Logs for a log group. Filter by pattern and time range.",
  input: {
    logGroupName: {
      type: String,
      required: true,
      description: "Log group name (e.g., /aws/lambda/my-function)",
    },
    filterPattern: {
      type: String,
      required: false,
      description:
        "CloudWatch filter pattern (e.g., 'ERROR', '{ $.level = \"error\" }')",
    },
    startTime: {
      type: String,
      required: false,
      description:
        "Start time (ISO 8601 or relative like 'now-1h'). Defaults to 'now-15m'.",
    },
    endTime: {
      type: String,
      required: false,
      description: "End time (ISO 8601 or 'now'). Defaults to 'now'.",
    },
    profile: {
      type: String,
      required: false,
      description: "AWS profile to use",
    },
    region: {
      type: String,
      required: false,
      description: "AWS region",
    },
    limit: {
      type: Number,
      required: false,
      description: "Max events to return (default 100)",
    },
  },
  service: async (input: {
    logGroupName: string;
    filterPattern?: string;
    startTime?: string;
    endTime?: string;
    profile?: string;
    region?: string;
    limit?: number;
  }) => {
    const result = await filterLogEvents(
      {
        ...input,
        startTime: input.startTime || "now-15m",
        endTime: input.endTime || "now",
        limit: input.limit || 100,
      },
      log,
    );
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },
});

const awsS3ListObjects = fabricService({
  alias: "aws_s3_list_objects",
  description: "List objects in an S3 bucket with optional prefix filtering.",
  input: {
    bucket: {
      type: String,
      required: true,
      description: "S3 bucket name",
    },
    prefix: {
      type: String,
      required: false,
      description: "Object key prefix filter",
    },
    profile: {
      type: String,
      required: false,
      description: "AWS profile to use",
    },
    region: {
      type: String,
      required: false,
      description: "AWS region",
    },
    maxResults: {
      type: Number,
      required: false,
      description: "Max results to return",
    },
  },
  service: async (input: {
    bucket: string;
    prefix?: string;
    profile?: string;
    region?: string;
    maxResults?: number;
  }) => {
    const result = await listS3Objects(input, log);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },
});

const awsCloudformationDescribeStack = fabricService({
  alias: "aws_cloudformation_describe_stack",
  description: "Get details and status of a CloudFormation stack.",
  input: {
    stackName: {
      type: String,
      required: true,
      description: "Stack name or ARN",
    },
    profile: {
      type: String,
      required: false,
      description: "AWS profile to use",
    },
    region: {
      type: String,
      required: false,
      description: "AWS region",
    },
  },
  service: async (input: {
    stackName: string;
    profile?: string;
    region?: string;
  }) => {
    const result = await describeStack(input, log);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },
});

const awsDynamodbDescribeTable = fabricService({
  alias: "aws_dynamodb_describe_table",
  description:
    "Get metadata about a DynamoDB table including key schema, indexes, and provisioned capacity.",
  input: {
    tableName: {
      type: String,
      required: true,
      description: "DynamoDB table name",
    },
    profile: {
      type: String,
      required: false,
      description: "AWS profile to use",
    },
    region: {
      type: String,
      required: false,
      description: "AWS region",
    },
  },
  service: async (input: {
    tableName: string;
    profile?: string;
    region?: string;
  }) => {
    const result = await describeDynamoDBTable(input, log);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },
});

const awsDynamodbScan = fabricService({
  alias: "aws_dynamodb_scan",
  description:
    "Scan a DynamoDB table. Use sparingly on large tables - prefer query when possible.",
  input: {
    tableName: {
      type: String,
      required: true,
      description: "DynamoDB table name",
    },
    filterExpression: {
      type: String,
      required: false,
      description: "Filter expression (e.g., 'status = :s')",
    },
    expressionAttributeValues: {
      type: String,
      required: false,
      description:
        'JSON object of attribute values (e.g., \'{\\":s\\":{\\"S\\":\\"active\\"}}\')',
    },
    limit: {
      type: Number,
      required: false,
      description: "Max items to return (default 25)",
    },
    profile: {
      type: String,
      required: false,
      description: "AWS profile to use",
    },
    region: {
      type: String,
      required: false,
      description: "AWS region",
    },
  },
  service: async (input: {
    tableName: string;
    filterExpression?: string;
    expressionAttributeValues?: string;
    limit?: number;
    profile?: string;
    region?: string;
  }) => {
    const result = await scanDynamoDB(
      { ...input, limit: input.limit || 25 },
      log,
    );
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },
});

const awsDynamodbQuery = fabricService({
  alias: "aws_dynamodb_query",
  description:
    "Query a DynamoDB table by partition key. More efficient than scan for targeted lookups.",
  input: {
    tableName: {
      type: String,
      required: true,
      description: "DynamoDB table name",
    },
    keyConditionExpression: {
      type: String,
      required: true,
      description: "Key condition (e.g., 'pk = :pk')",
    },
    expressionAttributeValues: {
      type: String,
      required: true,
      description: "JSON object of attribute values",
    },
    indexName: {
      type: String,
      required: false,
      description: "GSI or LSI name to query",
    },
    filterExpression: {
      type: String,
      required: false,
      description: "Additional filter expression",
    },
    limit: {
      type: Number,
      required: false,
      description: "Max items to return",
    },
    scanIndexForward: {
      type: Boolean,
      required: false,
      description: "Sort ascending (true) or descending (false)",
    },
    profile: {
      type: String,
      required: false,
      description: "AWS profile to use",
    },
    region: {
      type: String,
      required: false,
      description: "AWS region",
    },
  },
  service: async (input: {
    tableName: string;
    keyConditionExpression: string;
    expressionAttributeValues: string;
    indexName?: string;
    filterExpression?: string;
    limit?: number;
    scanIndexForward?: boolean;
    profile?: string;
    region?: string;
  }) => {
    const result = await queryDynamoDB(input, log);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },
});

const awsDynamodbGetItem = fabricService({
  alias: "aws_dynamodb_get_item",
  description: "Get a single item from a DynamoDB table by its primary key.",
  input: {
    tableName: {
      type: String,
      required: true,
      description: "DynamoDB table name",
    },
    key: {
      type: String,
      required: true,
      description:
        'JSON object of the primary key (e.g., \'{\\"pk\\":{\\"S\\":\\"user#123\\"},\\"sk\\":{\\"S\\":\\"profile\\"}}\')',
    },
    profile: {
      type: String,
      required: false,
      description: "AWS profile to use",
    },
    region: {
      type: String,
      required: false,
      description: "AWS region",
    },
  },
  service: async (input: {
    tableName: string;
    key: string;
    profile?: string;
    region?: string;
  }) => {
    const result = await getDynamoDBItem(input, log);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },
});

const awsSqsListQueues = fabricService({
  alias: "aws_sqs_list_queues",
  description: "List SQS queues in the account. Filter by queue name prefix.",
  input: {
    queueNamePrefix: {
      type: String,
      required: false,
      description: "Filter by queue name prefix",
    },
    profile: {
      type: String,
      required: false,
      description: "AWS profile to use",
    },
    region: {
      type: String,
      required: false,
      description: "AWS region",
    },
  },
  service: async (input: {
    queueNamePrefix?: string;
    profile?: string;
    region?: string;
  }) => {
    const result = await listSQSQueues(input, log);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },
});

const awsSqsGetQueueAttributes = fabricService({
  alias: "aws_sqs_get_queue_attributes",
  description:
    "Get attributes for an SQS queue including approximate message count, visibility timeout, and dead-letter config.",
  input: {
    queueUrl: {
      type: String,
      required: true,
      description: "SQS queue URL",
    },
    profile: {
      type: String,
      required: false,
      description: "AWS profile to use",
    },
    region: {
      type: String,
      required: false,
      description: "AWS region",
    },
  },
  service: async (input: {
    queueUrl: string;
    profile?: string;
    region?: string;
  }) => {
    const result = await getSQSQueueAttributes(input, log);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },
});

const awsSqsReceiveMessage = fabricService({
  alias: "aws_sqs_receive_message",
  description:
    "Receive messages from an SQS queue for inspection. Messages are returned to the queue after visibility timeout.",
  input: {
    queueUrl: {
      type: String,
      required: true,
      description: "SQS queue URL",
    },
    maxNumberOfMessages: {
      type: Number,
      required: false,
      description: "Max messages to receive (1-10, default 1)",
    },
    visibilityTimeout: {
      type: Number,
      required: false,
      description: "Seconds to hide message (default 30)",
    },
    profile: {
      type: String,
      required: false,
      description: "AWS profile to use",
    },
    region: {
      type: String,
      required: false,
      description: "AWS region",
    },
  },
  service: async (input: {
    queueUrl: string;
    maxNumberOfMessages?: number;
    visibilityTimeout?: number;
    profile?: string;
    region?: string;
  }) => {
    const result = await receiveSQSMessage(
      {
        ...input,
        maxNumberOfMessages: input.maxNumberOfMessages || 1,
        visibilityTimeout: input.visibilityTimeout || 30,
      },
      log,
    );
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  },
});

const awsSqsPurgeQueue = fabricService({
  alias: "aws_sqs_purge_queue",
  description:
    "Delete all messages from an SQS queue. Use with caution - this is irreversible.",
  input: {
    queueUrl: {
      type: String,
      required: true,
      description: "SQS queue URL",
    },
    profile: {
      type: String,
      required: false,
      description: "AWS profile to use",
    },
    region: {
      type: String,
      required: false,
      description: "AWS region",
    },
  },
  service: async (input: {
    queueUrl: string;
    profile?: string;
    region?: string;
  }) => {
    const result = await purgeSQSQueue(input, log);
    if (!result.success) {
      throw new Error(result.error);
    }
    return { success: true };
  },
});

// =============================================================================
// SUITE CREATION
// =============================================================================

const VERSION = "0.3.4";

export const suite = createServiceSuite({
  name: "jaypie",
  version: VERSION,
});

// Register docs services
suite.register(skill, "docs");
suite.register(version, "docs");
suite.register(listPrompts, "docs");
suite.register(readPrompt, "docs");
suite.register(listReleaseNotes, "docs");
suite.register(readReleaseNote, "docs");

// Register Datadog services
suite.register(datadogLogs, "datadog");
suite.register(datadogLogAnalytics, "datadog");
suite.register(datadogMonitors, "datadog");
suite.register(datadogSynthetics, "datadog");
suite.register(datadogMetrics, "datadog");
suite.register(datadogRum, "datadog");

// Register LLM services
suite.register(llmDebugCall, "llm");
suite.register(llmListProviders, "llm");

// Register AWS services
suite.register(awsListProfiles, "aws");
suite.register(awsStepfunctionsListExecutions, "aws");
suite.register(awsStepfunctionsStopExecution, "aws");
suite.register(awsLambdaListFunctions, "aws");
suite.register(awsLambdaGetFunction, "aws");
suite.register(awsLogsFilterLogEvents, "aws");
suite.register(awsS3ListObjects, "aws");
suite.register(awsCloudformationDescribeStack, "aws");
suite.register(awsDynamodbDescribeTable, "aws");
suite.register(awsDynamodbScan, "aws");
suite.register(awsDynamodbQuery, "aws");
suite.register(awsDynamodbGetItem, "aws");
suite.register(awsSqsListQueues, "aws");
suite.register(awsSqsGetQueueAttributes, "aws");
suite.register(awsSqsReceiveMessage, "aws");
suite.register(awsSqsPurgeQueue, "aws");
