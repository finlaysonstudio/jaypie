import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

import {
  aggregateDatadogLogs,
  getDatadogCredentials,
  searchDatadogLogs,
} from "./datadog.js";

// Build-time constants injected by rollup
declare const __BUILD_VERSION_STRING__: string;
const BUILD_VERSION_STRING =
  typeof __BUILD_VERSION_STRING__ !== "undefined"
    ? __BUILD_VERSION_STRING__
    : "@jaypie/mcp@0.0.0";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROMPTS_PATH = path.join(__dirname, "..", "prompts");

export interface CreateMcpServerOptions {
  version?: string;
  verbose?: boolean;
}

// Logger utility
function createLogger(verbose: boolean) {
  return {
    info: (message: string, ...args: unknown[]) => {
      if (verbose) {
        console.error(`[jaypie-mcp] ${message}`, ...args);
      }
    },
    error: (message: string, ...args: unknown[]) => {
      console.error(`[jaypie-mcp ERROR] ${message}`, ...args);
    },
  };
}

interface FrontMatter {
  description?: string;
  include?: string;
  globs?: string;
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

/**
 * Creates and configures an MCP server instance with Jaypie tools
 * @param options - Configuration options (or legacy version string)
 * @returns Configured MCP server instance
 */
export function createMcpServer(
  options: CreateMcpServerOptions | string = {},
): McpServer {
  // Support legacy signature: createMcpServer(version: string)
  const config: CreateMcpServerOptions =
    typeof options === "string" ? { version: options } : options;

  const { version = "0.0.0", verbose = false } = config;

  const log = createLogger(verbose);

  log.info("Creating MCP server instance");
  log.info(`Prompts directory: ${PROMPTS_PATH}`);

  const server = new McpServer(
    {
      name: "jaypie",
      version,
    },
    {
      capabilities: {},
    },
  );

  log.info("Registering tools...");

  server.tool(
    "list_prompts",
    "Returns a bulleted list of all .md files in the prompts directory with their descriptions and requirements",
    {},
    async () => {
      log.info("Tool called: list_prompts");
      log.info(`Reading directory: ${PROMPTS_PATH}`);

      try {
        const files = await fs.readdir(PROMPTS_PATH);
        const mdFiles = files.filter((file) => file.endsWith(".md"));

        log.info(`Found ${mdFiles.length} .md files`);

        const prompts = await Promise.all(
          mdFiles.map((file) =>
            parseMarkdownFile(path.join(PROMPTS_PATH, file)),
          ),
        );

        const formattedList = prompts.map(formatPromptListItem).join("\n");

        log.info("Successfully listed prompts");

        return {
          content: [
            {
              type: "text" as const,
              text:
                formattedList || "No .md files found in the prompts directory.",
            },
          ],
        };
      } catch (error) {
        log.error("Error listing prompts:", error);

        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing prompts: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
        };
      }
    },
  );

  log.info("Registered tool: list_prompts");

  server.tool(
    "read_prompt",
    "Returns the contents of a specified prompt file",
    {
      filename: z
        .string()
        .describe(
          "The name of the prompt file to read (e.g., example_prompt.md)",
        ),
    },
    async ({ filename }) => {
      log.info(`Tool called: read_prompt (filename: ${filename})`);

      try {
        const filePath = path.join(PROMPTS_PATH, filename);

        log.info(`Reading file: ${filePath}`);

        const content = await fs.readFile(filePath, "utf-8");

        log.info(`Successfully read ${filename} (${content.length} bytes)`);

        return {
          content: [
            {
              type: "text" as const,
              text: content,
            },
          ],
        };
      } catch (error) {
        if ((error as { code?: string }).code === "ENOENT") {
          log.error(`File not found: ${filename}`);

          return {
            content: [
              {
                type: "text" as const,
                text: `Error: Prompt file "${filename}" not found in prompts directory`,
              },
            ],
          };
        }

        log.error("Error reading prompt file:", error);

        return {
          content: [
            {
              type: "text" as const,
              text: `Error reading prompt file: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
        };
      }
    },
  );

  log.info("Registered tool: read_prompt");

  server.tool(
    "version",
    `Prints the current version and hash, \`${BUILD_VERSION_STRING}\``,
    {},
    async () => {
      log.info("Tool called: version");

      return {
        content: [
          {
            type: "text" as const,
            text: BUILD_VERSION_STRING,
          },
        ],
      };
    },
  );

  log.info("Registered tool: version");

  // Datadog Logs Tool
  server.tool(
    "datadog_logs",
    "Search Datadog logs using the Datadog Logs Search API. Requires DATADOG_API_KEY (or DD_API_KEY) and DATADOG_APP_KEY (or DD_APP_KEY) environment variables. Optionally uses DD_ENV for environment, DD_SERVICE for service, DD_SOURCE for source (defaults to 'lambda'), and DD_QUERY for additional base query terms.",
    {
      query: z
        .string()
        .optional()
        .describe(
          "Additional search query terms to append to the base query. The base query is built from DD_ENV, DD_SERVICE, DD_SOURCE (or 'lambda'), and DD_QUERY environment variables. Use this to add specific filters like error messages or request IDs.",
        ),
      source: z
        .string()
        .optional()
        .describe(
          "Override the log source (e.g., 'lambda', 'auth0', 'nginx'). If not provided, uses DD_SOURCE env var or defaults to 'lambda'.",
        ),
      env: z
        .string()
        .optional()
        .describe(
          "Override the environment (e.g., 'sandbox', 'kitchen', 'lab', 'studio', 'production'). If not provided, uses DD_ENV env var.",
        ),
      service: z
        .string()
        .optional()
        .describe(
          "Override the service name. If not provided, uses DD_SERVICE env var.",
        ),
      from: z
        .string()
        .optional()
        .describe(
          "Start time for the search. ISO 8601 format or relative time like 'now-15m'. Defaults to 'now-15m'.",
        ),
      to: z
        .string()
        .optional()
        .describe(
          "End time for the search. ISO 8601 format or 'now'. Defaults to 'now'.",
        ),
      limit: z
        .number()
        .optional()
        .describe(
          "Maximum number of logs to return. Defaults to 50, max 1000.",
        ),
      sort: z
        .enum(["timestamp", "-timestamp"])
        .optional()
        .describe(
          "Sort order. 'timestamp' for oldest first, '-timestamp' for newest first. Defaults to '-timestamp'.",
        ),
    },
    async ({ query, source, env, service, from, to, limit, sort }) => {
      log.info("Tool called: datadog_logs");

      const credentials = getDatadogCredentials();
      if (!credentials) {
        const missingApiKey =
          !process.env.DATADOG_API_KEY && !process.env.DD_API_KEY;
        const missingAppKey =
          !process.env.DATADOG_APP_KEY &&
          !process.env.DATADOG_APPLICATION_KEY &&
          !process.env.DD_APP_KEY &&
          !process.env.DD_APPLICATION_KEY;

        if (missingApiKey) {
          log.error("No Datadog API key found in environment");
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: No Datadog API key found. Please set DATADOG_API_KEY or DD_API_KEY environment variable.",
              },
            ],
          };
        }
        if (missingAppKey) {
          log.error("No Datadog Application key found in environment");
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: No Datadog Application key found. Please set DATADOG_APP_KEY or DD_APP_KEY environment variable. The Logs Search API requires both an API key and an Application key.",
              },
            ],
          };
        }
      }

      // credentials is guaranteed to be non-null here
      const result = await searchDatadogLogs(
        credentials!,
        {
          query,
          source,
          env,
          service,
          from,
          to,
          limit,
          sort,
        },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error from Datadog API: ${result.error}`,
            },
          ],
        };
      }

      if (result.logs.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No logs found for query: ${result.query}\nTime range: ${result.timeRange.from} to ${result.timeRange.to}`,
            },
          ],
        };
      }

      const resultText = [
        `Query: ${result.query}`,
        `Time range: ${result.timeRange.from} to ${result.timeRange.to}`,
        `Found ${result.logs.length} log entries:`,
        "",
        JSON.stringify(result.logs, null, 2),
      ].join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: resultText,
          },
        ],
      };
    },
  );

  log.info("Registered tool: datadog_logs");

  // Datadog Log Analytics Tool
  server.tool(
    "datadog_log_analytics",
    "Aggregate and analyze Datadog logs by grouping them by specified fields (e.g., source, service, status, host). Returns counts grouped by the specified facets. Useful for getting an overview of log distribution without fetching individual log entries.",
    {
      groupBy: z
        .array(z.string())
        .describe(
          "Fields to group logs by. Common facets: 'source', 'service', 'status', 'host', '@http.status_code', '@env'. Use Datadog facet names.",
        ),
      query: z
        .string()
        .optional()
        .describe(
          "Additional search query terms. Use '*' for all logs. The base query is built from DD_ENV, DD_SERVICE, DD_SOURCE environment variables.",
        ),
      source: z
        .string()
        .optional()
        .describe(
          "Override the log source filter. Use '*' to include all sources. If not provided, uses DD_SOURCE env var or defaults to 'lambda'.",
        ),
      env: z
        .string()
        .optional()
        .describe(
          "Override the environment filter. If not provided, uses DD_ENV env var.",
        ),
      service: z
        .string()
        .optional()
        .describe(
          "Override the service name filter. If not provided, uses DD_SERVICE env var.",
        ),
      from: z
        .string()
        .optional()
        .describe(
          "Start time for the search. ISO 8601 format or relative time like 'now-1h'. Defaults to 'now-15m'.",
        ),
      to: z
        .string()
        .optional()
        .describe(
          "End time for the search. ISO 8601 format or 'now'. Defaults to 'now'.",
        ),
      aggregation: z
        .enum(["count", "avg", "sum", "min", "max", "cardinality"])
        .optional()
        .describe(
          "Aggregation type. 'count' counts logs, others require a metric field. Defaults to 'count'.",
        ),
      metric: z
        .string()
        .optional()
        .describe(
          "Metric field to aggregate when using avg, sum, min, max, or cardinality. E.g., '@duration', '@http.response_time'.",
        ),
    },
    async ({
      groupBy,
      query,
      source,
      env,
      service,
      from,
      to,
      aggregation,
      metric,
    }) => {
      log.info("Tool called: datadog_log_analytics");

      const credentials = getDatadogCredentials();
      if (!credentials) {
        const missingApiKey =
          !process.env.DATADOG_API_KEY && !process.env.DD_API_KEY;
        const missingAppKey =
          !process.env.DATADOG_APP_KEY &&
          !process.env.DATADOG_APPLICATION_KEY &&
          !process.env.DD_APP_KEY &&
          !process.env.DD_APPLICATION_KEY;

        if (missingApiKey) {
          log.error("No Datadog API key found in environment");
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: No Datadog API key found. Please set DATADOG_API_KEY or DD_API_KEY environment variable.",
              },
            ],
          };
        }
        if (missingAppKey) {
          log.error("No Datadog Application key found in environment");
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: No Datadog Application key found. Please set DATADOG_APP_KEY or DD_APP_KEY environment variable.",
              },
            ],
          };
        }
      }

      const compute = aggregation
        ? [{ aggregation, metric }]
        : [{ aggregation: "count" as const }];

      const result = await aggregateDatadogLogs(
        credentials!,
        {
          query,
          source,
          env,
          service,
          from,
          to,
          groupBy,
          compute,
        },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error from Datadog Analytics API: ${result.error}`,
            },
          ],
        };
      }

      if (result.buckets.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No data found for query: ${result.query}\nTime range: ${result.timeRange.from} to ${result.timeRange.to}\nGrouped by: ${result.groupBy.join(", ")}`,
            },
          ],
        };
      }

      // Format buckets as a readable table
      const formattedBuckets = result.buckets.map((bucket) => {
        const byParts = Object.entries(bucket.by)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ");
        const computeParts = Object.entries(bucket.computes)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ");
        return `  ${byParts} => ${computeParts}`;
      });

      const resultText = [
        `Query: ${result.query}`,
        `Time range: ${result.timeRange.from} to ${result.timeRange.to}`,
        `Grouped by: ${result.groupBy.join(", ")}`,
        `Found ${result.buckets.length} groups:`,
        "",
        ...formattedBuckets,
      ].join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: resultText,
          },
        ],
      };
    },
  );

  log.info("Registered tool: datadog_log_analytics");

  log.info("MCP server configuration complete");

  return server;
}
