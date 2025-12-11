import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

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
    "List available Jaypie development prompts and guides. Use this FIRST when starting work on a Jaypie project to discover relevant documentation. Returns filenames, descriptions, and which file patterns each prompt applies to (e.g., 'Required for packages/express/**').",
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
    "Read a Jaypie prompt/guide by filename. Call list_prompts first to see available prompts. These contain best practices, templates, code patterns, and step-by-step guides for Jaypie development tasks.",
    {
      filename: z
        .string()
        .describe(
          "The prompt filename from list_prompts (e.g., 'Jaypie_Express_Package.md', 'Development_Process.md')",
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
    "Search and retrieve individual Datadog log entries. Use this to view actual log messages and details. For aggregated counts/statistics (e.g., 'how many errors by service?'), use datadog_log_analytics instead. Requires DATADOG_API_KEY and DATADOG_APP_KEY environment variables.",
    {
      query: z
        .string()
        .optional()
        .describe(
          "Search query to filter logs. Examples: 'status:error', '@http.status_code:500', '*timeout*', '@requestId:abc123'. Combined with DD_ENV, DD_SERVICE, DD_SOURCE env vars if set.",
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
          "Start time. Formats: relative ('now-15m', 'now-1h', 'now-1d'), ISO 8601 ('2024-01-15T10:00:00Z'). Defaults to 'now-15m'.",
        ),
      to: z
        .string()
        .optional()
        .describe(
          "End time. Formats: 'now', relative ('now-5m'), or ISO 8601. Defaults to 'now'.",
        ),
      limit: z
        .number()
        .optional()
        .describe("Max logs to return (1-1000). Defaults to 50."),
      sort: z
        .enum(["timestamp", "-timestamp"])
        .optional()
        .describe(
          "Sort order: 'timestamp' (oldest first) or '-timestamp' (newest first, default).",
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
    "Aggregate and analyze Datadog logs by grouping them by fields. Use this for statistics and counts (e.g., 'errors by service', 'requests by status code'). For viewing individual log entries, use datadog_logs instead.",
    {
      groupBy: z
        .array(z.string())
        .describe(
          "Fields to group by. Examples: ['source'], ['service', 'status'], ['@http.status_code']. Common facets: source, service, status, host, @http.status_code, @env.",
        ),
      query: z
        .string()
        .optional()
        .describe(
          "Filter query. Examples: 'status:error', '*timeout*', '@http.method:POST'. Use '*' for all logs.",
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
          "Start time. Formats: relative ('now-15m', 'now-1h', 'now-1d'), ISO 8601 ('2024-01-15T10:00:00Z'). Defaults to 'now-15m'.",
        ),
      to: z
        .string()
        .optional()
        .describe(
          "End time. Formats: 'now', relative ('now-5m'), or ISO 8601. Defaults to 'now'.",
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

  // Datadog Monitors Tool
  server.tool(
    "datadog_monitors",
    "List and check Datadog monitors. Shows monitor status (Alert, Warn, No Data, OK), name, type, and tags. Useful for quickly checking if any monitors are alerting.",
    {
      status: z
        .array(z.enum(["Alert", "Warn", "No Data", "OK"]))
        .optional()
        .describe(
          "Filter monitors by status. E.g., ['Alert', 'Warn'] to see only alerting monitors.",
        ),
      tags: z
        .array(z.string())
        .optional()
        .describe(
          "Filter monitors by resource tags (tags on the monitored resources).",
        ),
      monitorTags: z
        .array(z.string())
        .optional()
        .describe(
          "Filter monitors by monitor tags (tags on the monitor itself).",
        ),
      name: z
        .string()
        .optional()
        .describe("Filter monitors by name (partial match supported)."),
    },
    async ({ status, tags, monitorTags, name }) => {
      log.info("Tool called: datadog_monitors");

      const credentials = getDatadogCredentials();
      if (!credentials) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Datadog credentials not found. Please set DATADOG_API_KEY and DATADOG_APP_KEY environment variables.",
            },
          ],
        };
      }

      const result = await listDatadogMonitors(
        credentials,
        { status, tags, monitorTags, name },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error from Datadog Monitors API: ${result.error}`,
            },
          ],
        };
      }

      if (result.monitors.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No monitors found matching the specified criteria.",
            },
          ],
        };
      }

      // Group monitors by status for better readability
      const byStatus: Record<string, typeof result.monitors> = {};
      for (const monitor of result.monitors) {
        const status = monitor.status;
        if (!byStatus[status]) {
          byStatus[status] = [];
        }
        byStatus[status].push(monitor);
      }

      const statusOrder = ["Alert", "Warn", "No Data", "OK", "Unknown"];
      const formattedMonitors: string[] = [];

      for (const status of statusOrder) {
        const monitors = byStatus[status];
        if (monitors && monitors.length > 0) {
          formattedMonitors.push(`\n## ${status} (${monitors.length})`);
          for (const m of monitors) {
            formattedMonitors.push(`  - [${m.id}] ${m.name} (${m.type})`);
          }
        }
      }

      const resultText = [
        `Found ${result.monitors.length} monitors:`,
        ...formattedMonitors,
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

  log.info("Registered tool: datadog_monitors");

  // Datadog Synthetics Tool
  server.tool(
    "datadog_synthetics",
    "List Datadog Synthetic tests and optionally get recent results for a specific test. Shows test status, type (api/browser), and locations.",
    {
      type: z
        .enum(["api", "browser"])
        .optional()
        .describe("Filter tests by type: 'api' or 'browser'."),
      tags: z.array(z.string()).optional().describe("Filter tests by tags."),
      testId: z
        .string()
        .optional()
        .describe(
          "If provided, fetches recent results for this specific test (public_id). Otherwise lists all tests.",
        ),
    },
    async ({ type, tags, testId }) => {
      log.info("Tool called: datadog_synthetics");

      const credentials = getDatadogCredentials();
      if (!credentials) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Datadog credentials not found. Please set DATADOG_API_KEY and DATADOG_APP_KEY environment variables.",
            },
          ],
        };
      }

      // If testId is provided, get results for that specific test
      if (testId) {
        const result = await getDatadogSyntheticResults(
          credentials,
          testId,
          log,
        );

        if (!result.success) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error from Datadog Synthetics API: ${result.error}`,
              },
            ],
          };
        }

        if (result.results.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No recent results found for test: ${testId}`,
              },
            ],
          };
        }

        const passedCount = result.results.filter((r) => r.passed).length;
        const failedCount = result.results.length - passedCount;

        const formattedResults = result.results.slice(0, 10).map((r) => {
          const date = new Date(r.checkTime * 1000).toISOString();
          const status = r.passed ? "✓ PASSED" : "✗ FAILED";
          return `  ${date} - ${status}`;
        });

        const resultText = [
          `Results for test: ${testId}`,
          `Recent: ${passedCount} passed, ${failedCount} failed (showing last ${Math.min(10, result.results.length)})`,
          "",
          ...formattedResults,
        ].join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: resultText,
            },
          ],
        };
      }

      // Otherwise list all tests
      const result = await listDatadogSynthetics(
        credentials,
        { type, tags },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error from Datadog Synthetics API: ${result.error}`,
            },
          ],
        };
      }

      if (result.tests.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No synthetic tests found matching the specified criteria.",
            },
          ],
        };
      }

      // Group by status
      const byStatus: Record<string, typeof result.tests> = {};
      for (const test of result.tests) {
        const status = test.status;
        if (!byStatus[status]) {
          byStatus[status] = [];
        }
        byStatus[status].push(test);
      }

      const formattedTests: string[] = [];
      for (const [status, tests] of Object.entries(byStatus)) {
        formattedTests.push(`\n## ${status} (${tests.length})`);
        for (const t of tests) {
          formattedTests.push(`  - [${t.publicId}] ${t.name} (${t.type})`);
        }
      }

      const resultText = [
        `Found ${result.tests.length} synthetic tests:`,
        ...formattedTests,
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

  log.info("Registered tool: datadog_synthetics");

  // Datadog Metrics Tool
  server.tool(
    "datadog_metrics",
    "Query Datadog metrics. Returns timeseries data for the specified metric query. Useful for checking specific metric values.",
    {
      query: z
        .string()
        .describe(
          "Metric query. Format: 'aggregation:metric.name{tags}'. Examples: 'avg:system.cpu.user{*}', 'sum:aws.lambda.invocations{function:my-func}.as_count()', 'max:aws.lambda.duration{env:production}'.",
        ),
      from: z
        .string()
        .optional()
        .describe(
          "Start time. Formats: relative ('1h', '30m', '1d'), or Unix timestamp. Defaults to '1h'.",
        ),
      to: z
        .string()
        .optional()
        .describe(
          "End time. Formats: 'now' or Unix timestamp. Defaults to 'now'.",
        ),
    },
    async ({ query, from, to }) => {
      log.info("Tool called: datadog_metrics");

      const credentials = getDatadogCredentials();
      if (!credentials) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Datadog credentials not found. Please set DATADOG_API_KEY and DATADOG_APP_KEY environment variables.",
            },
          ],
        };
      }

      // Parse time parameters
      const now = Math.floor(Date.now() / 1000);
      let fromTs: number;
      let toTs: number;

      // Parse 'from' parameter
      const fromStr = from || "1h";
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
        fromTs = now - 3600; // Default 1 hour
      }

      // Parse 'to' parameter
      const toStr = to || "now";
      if (toStr === "now") {
        toTs = now;
      } else if (toStr.match(/^\d+$/)) {
        toTs = parseInt(toStr, 10);
      } else {
        toTs = now;
      }

      const result = await queryDatadogMetrics(
        credentials,
        { query, from: fromTs, to: toTs },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error from Datadog Metrics API: ${result.error}`,
            },
          ],
        };
      }

      if (result.series.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No data found for query: ${query}\nTime range: ${new Date(fromTs * 1000).toISOString()} to ${new Date(toTs * 1000).toISOString()}`,
            },
          ],
        };
      }

      const formattedSeries = result.series.map((s) => {
        const points = s.pointlist.slice(-5); // Last 5 points
        const formattedPoints = points
          .map(([ts, val]) => {
            const date = new Date(ts).toISOString();
            return `    ${date}: ${val !== null ? val.toFixed(4) : "null"}`;
          })
          .join("\n");
        return `\n  ${s.metric} (${s.scope})${s.unit ? ` [${s.unit}]` : ""}:\n${formattedPoints}`;
      });

      const resultText = [
        `Query: ${query}`,
        `Time range: ${new Date(fromTs * 1000).toISOString()} to ${new Date(toTs * 1000).toISOString()}`,
        `Found ${result.series.length} series (showing last 5 points each):`,
        ...formattedSeries,
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

  log.info("Registered tool: datadog_metrics");

  // Datadog RUM Tool
  server.tool(
    "datadog_rum",
    "Search Datadog RUM (Real User Monitoring) events. Find user sessions, page views, errors, and actions. Useful for debugging frontend issues and understanding user behavior.",
    {
      query: z
        .string()
        .optional()
        .describe(
          "RUM search query. E.g., '@type:error', '@session.id:abc123', '@view.url:*checkout*'. Defaults to '*' (all events).",
        ),
      from: z
        .string()
        .optional()
        .describe(
          "Start time. Formats: relative ('now-15m', 'now-1h', 'now-1d'), ISO 8601 ('2024-01-15T10:00:00Z'). Defaults to 'now-15m'.",
        ),
      to: z
        .string()
        .optional()
        .describe(
          "End time. Formats: 'now', relative ('now-5m'), or ISO 8601. Defaults to 'now'.",
        ),
      limit: z
        .number()
        .optional()
        .describe("Max events to return (1-1000). Defaults to 50."),
    },
    async ({ query, from, to, limit }) => {
      log.info("Tool called: datadog_rum");

      const credentials = getDatadogCredentials();
      if (!credentials) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Datadog credentials not found. Please set DATADOG_API_KEY and DATADOG_APP_KEY environment variables.",
            },
          ],
        };
      }

      const result = await searchDatadogRum(
        credentials,
        { query, from, to, limit },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error from Datadog RUM API: ${result.error}`,
            },
          ],
        };
      }

      if (result.events.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No RUM events found for query: ${result.query}\nTime range: ${result.timeRange.from} to ${result.timeRange.to}`,
            },
          ],
        };
      }

      // Group events by type for better readability
      const byType: Record<string, typeof result.events> = {};
      for (const event of result.events) {
        const type = event.type;
        if (!byType[type]) {
          byType[type] = [];
        }
        byType[type].push(event);
      }

      const formattedEvents: string[] = [];
      for (const [type, events] of Object.entries(byType)) {
        formattedEvents.push(`\n## ${type} (${events.length})`);
        for (const e of events.slice(0, 10)) {
          // Limit per type
          const parts = [e.timestamp];
          if (e.viewName || e.viewUrl) {
            parts.push(e.viewName || e.viewUrl || "");
          }
          if (e.errorMessage) {
            parts.push(`Error: ${e.errorMessage}`);
          }
          if (e.sessionId) {
            parts.push(`Session: ${e.sessionId.substring(0, 8)}...`);
          }
          formattedEvents.push(`  - ${parts.join(" | ")}`);
        }
      }

      const resultText = [
        `Query: ${result.query}`,
        `Time range: ${result.timeRange.from} to ${result.timeRange.to}`,
        `Found ${result.events.length} RUM events:`,
        ...formattedEvents,
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

  log.info("Registered tool: datadog_rum");

  log.info("MCP server configuration complete");

  return server;
}
