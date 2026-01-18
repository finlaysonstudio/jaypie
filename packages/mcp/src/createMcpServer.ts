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

  // LLM Debug Tools
  server.tool(
    "llm_debug_call",
    "Make a debug LLM API call and inspect the raw response. Useful for understanding how each provider formats responses, especially for reasoning/thinking content. Returns full history, raw responses, and extracted reasoning.",
    {
      provider: z
        .enum(["anthropic", "gemini", "openai", "openrouter"])
        .describe("LLM provider to call"),
      model: z
        .string()
        .optional()
        .describe(
          "Model to use. If not provided, uses a sensible default. For reasoning tests, try 'o3-mini' with openai.",
        ),
      message: z
        .string()
        .describe(
          "Message to send to the LLM. For reasoning tests, try something that requires thinking like 'What is 15 * 17? Think step by step.'",
        ),
    },
    async ({ provider, model, message }) => {
      log.info(`Tool called: llm_debug_call (provider: ${provider})`);

      const result = await debugLlmCall(
        { provider: provider as LlmProvider, model, message },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error calling ${provider}: ${result.error}`,
            },
          ],
        };
      }

      const sections = [
        `## LLM Debug Call Result`,
        `Provider: ${result.provider}`,
        `Model: ${result.model}`,
        ``,
        `### Content`,
        result.content || "(no content)",
        ``,
        `### Reasoning (${result.reasoning?.length || 0} items, ${result.reasoningTokens || 0} tokens)`,
        result.reasoning && result.reasoning.length > 0
          ? result.reasoning.map((r, i) => `[${i}] ${r}`).join("\n")
          : "(no reasoning extracted)",
        ``,
        `### Usage`,
        JSON.stringify(result.usage, null, 2),
        ``,
        `### History (${result.history?.length || 0} items)`,
        JSON.stringify(result.history, null, 2),
        ``,
        `### Raw Responses (${result.rawResponses?.length || 0} items)`,
        JSON.stringify(result.rawResponses, null, 2),
      ];

      return {
        content: [
          {
            type: "text" as const,
            text: sections.join("\n"),
          },
        ],
      };
    },
  );

  log.info("Registered tool: llm_debug_call");

  server.tool(
    "llm_list_providers",
    "List available LLM providers with their default and reasoning-capable models.",
    {},
    async () => {
      log.info("Tool called: llm_list_providers");

      const { providers } = listLlmProviders();

      const formatted = providers.map((p) => {
        const reasoningNote =
          p.reasoningModels.length > 0
            ? `Reasoning models: ${p.reasoningModels.join(", ")}`
            : "No known reasoning models";
        return `- ${p.name}: default=${p.defaultModel}, ${reasoningNote}`;
      });

      return {
        content: [
          {
            type: "text" as const,
            text: [
              "## Available LLM Providers",
              "",
              ...formatted,
              "",
              "Use llm_debug_call to test responses from any provider.",
            ].join("\n"),
          },
        ],
      };
    },
  );

  log.info("Registered tool: llm_list_providers");

  // AWS CLI Tools

  // AWS List Profiles
  server.tool(
    "aws_list_profiles",
    "List available AWS profiles from ~/.aws/config and credentials.",
    {},
    async () => {
      log.info("Tool called: aws_list_profiles");

      const result = await listAwsProfiles(log);

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing profiles: ${result.error}`,
            },
          ],
        };
      }

      const profiles = result.data || [];
      if (profiles.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No AWS profiles found. Configure profiles in ~/.aws/config or ~/.aws/credentials.",
            },
          ],
        };
      }

      const formatted = profiles
        .map((p) => `- ${p.name} (${p.source})`)
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Found ${profiles.length} AWS profiles:`,
              "",
              formatted,
              "",
              "Use the 'profile' parameter in other AWS tools to specify which profile to use.",
            ].join("\n"),
          },
        ],
      };
    },
  );

  log.info("Registered tool: aws_list_profiles");

  // Step Functions: List Executions
  server.tool(
    "aws_stepfunctions_list_executions",
    "List Step Function executions for a state machine. Useful for finding stuck or running executions.",
    {
      stateMachineArn: z.string().describe("ARN of the state machine"),
      statusFilter: z
        .enum([
          "RUNNING",
          "SUCCEEDED",
          "FAILED",
          "TIMED_OUT",
          "ABORTED",
          "PENDING_REDRIVE",
        ])
        .optional()
        .describe("Filter by execution status"),
      profile: z.string().optional().describe("AWS profile to use"),
      region: z.string().optional().describe("AWS region"),
      maxResults: z
        .number()
        .optional()
        .describe("Max results (1-1000, default 100)"),
    },
    async ({ stateMachineArn, statusFilter, profile, region, maxResults }) => {
      log.info("Tool called: aws_stepfunctions_list_executions");

      const result = await listStepFunctionExecutions(
        {
          stateMachineArn,
          statusFilter,
          profile,
          region,
          maxResults,
        },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${result.error}`,
            },
          ],
        };
      }

      const executions = result.data?.executions || [];
      if (executions.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No ${statusFilter || ""} executions found for state machine.`,
            },
          ],
        };
      }

      const formatted = executions
        .map((e) => `- ${e.name} (${e.status}) started ${e.startDate}`)
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Found ${executions.length} executions:`,
              "",
              formatted,
              "",
              "Use aws_stepfunctions_stop_execution to stop running executions.",
            ].join("\n"),
          },
        ],
      };
    },
  );

  log.info("Registered tool: aws_stepfunctions_list_executions");

  // Step Functions: Stop Execution
  server.tool(
    "aws_stepfunctions_stop_execution",
    "Stop a running Step Function execution. Use with caution - this will abort the workflow.",
    {
      executionArn: z.string().describe("ARN of the execution to stop"),
      cause: z
        .string()
        .optional()
        .describe("Description of why the execution was stopped"),
      profile: z.string().optional().describe("AWS profile to use"),
      region: z.string().optional().describe("AWS region"),
    },
    async ({ executionArn, cause, profile, region }) => {
      log.info("Tool called: aws_stepfunctions_stop_execution");

      const result = await stopStepFunctionExecution(
        {
          executionArn,
          cause,
          profile,
          region,
        },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error stopping execution: ${result.error}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Execution stopped successfully at ${result.data?.stopDate || "unknown time"}.`,
          },
        ],
      };
    },
  );

  log.info("Registered tool: aws_stepfunctions_stop_execution");

  // Lambda: List Functions
  server.tool(
    "aws_lambda_list_functions",
    "List Lambda functions in the account. Filter by function name prefix.",
    {
      functionNamePrefix: z
        .string()
        .optional()
        .describe("Filter by function name prefix"),
      profile: z.string().optional().describe("AWS profile to use"),
      region: z.string().optional().describe("AWS region"),
      maxResults: z.number().optional().describe("Max results to return"),
    },
    async ({ functionNamePrefix, profile, region, maxResults }) => {
      log.info("Tool called: aws_lambda_list_functions");

      const result = await listLambdaFunctions(
        {
          functionNamePrefix,
          profile,
          region,
          maxResults,
        },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${result.error}`,
            },
          ],
        };
      }

      const functions = result.data?.Functions || [];
      if (functions.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: functionNamePrefix
                ? `No functions found with prefix "${functionNamePrefix}".`
                : "No Lambda functions found in this account/region.",
            },
          ],
        };
      }

      const formatted = functions
        .map(
          (f) =>
            `- ${f.FunctionName} (${f.Runtime || "unknown runtime"}, ${f.MemorySize}MB)`,
        )
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Found ${functions.length} Lambda functions:`,
              "",
              formatted,
              "",
              "Use aws_lambda_get_function for details on a specific function.",
            ].join("\n"),
          },
        ],
      };
    },
  );

  log.info("Registered tool: aws_lambda_list_functions");

  // Lambda: Get Function
  server.tool(
    "aws_lambda_get_function",
    "Get configuration and details for a specific Lambda function.",
    {
      functionName: z.string().describe("Function name or ARN"),
      profile: z.string().optional().describe("AWS profile to use"),
      region: z.string().optional().describe("AWS region"),
    },
    async ({ functionName, profile, region }) => {
      log.info("Tool called: aws_lambda_get_function");

      const result = await getLambdaFunction(
        {
          functionName,
          profile,
          region,
        },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${result.error}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    },
  );

  log.info("Registered tool: aws_lambda_get_function");

  // CloudWatch Logs: Filter Log Events
  server.tool(
    "aws_logs_filter_log_events",
    "Search CloudWatch Logs for a log group. Filter by pattern and time range.",
    {
      logGroupName: z
        .string()
        .describe("Log group name (e.g., /aws/lambda/my-function)"),
      filterPattern: z
        .string()
        .optional()
        .describe(
          'CloudWatch filter pattern (e.g., \'ERROR\', \'{ $.level = "error" }\')',
        ),
      startTime: z
        .string()
        .optional()
        .describe(
          "Start time (ISO 8601 or relative like 'now-1h'). Defaults to 'now-15m'.",
        ),
      endTime: z
        .string()
        .optional()
        .describe("End time (ISO 8601 or 'now'). Defaults to 'now'."),
      profile: z.string().optional().describe("AWS profile to use"),
      region: z.string().optional().describe("AWS region"),
      limit: z
        .number()
        .optional()
        .describe("Max events to return (default 100)"),
    },
    async ({
      logGroupName,
      filterPattern,
      startTime,
      endTime,
      profile,
      region,
      limit,
    }) => {
      log.info("Tool called: aws_logs_filter_log_events");

      const result = await filterLogEvents(
        {
          logGroupName,
          filterPattern,
          startTime: startTime || "now-15m",
          endTime: endTime || "now",
          limit: limit || 100,
          profile,
          region,
        },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${result.error}`,
            },
          ],
        };
      }

      const events = result.data?.events || [];
      if (events.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No log events found matching the filter in ${logGroupName}.`,
            },
          ],
        };
      }

      const formatted = events
        .map((e) => {
          const timestamp = new Date(e.timestamp).toISOString();
          return `[${timestamp}] ${e.message}`;
        })
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Found ${events.length} log events:`,
              "",
              formatted,
            ].join("\n"),
          },
        ],
      };
    },
  );

  log.info("Registered tool: aws_logs_filter_log_events");

  // S3: List Objects
  server.tool(
    "aws_s3_list_objects",
    "List objects in an S3 bucket with optional prefix filtering.",
    {
      bucket: z.string().describe("S3 bucket name"),
      prefix: z.string().optional().describe("Object key prefix filter"),
      profile: z.string().optional().describe("AWS profile to use"),
      region: z.string().optional().describe("AWS region"),
      maxResults: z.number().optional().describe("Max results to return"),
    },
    async ({ bucket, prefix, profile, region, maxResults }) => {
      log.info("Tool called: aws_s3_list_objects");

      const result = await listS3Objects(
        {
          bucket,
          prefix,
          profile,
          region,
          maxResults,
        },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${result.error}`,
            },
          ],
        };
      }

      const objects = result.data?.Contents || [];
      if (objects.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: prefix
                ? `No objects found with prefix "${prefix}" in bucket ${bucket}.`
                : `Bucket ${bucket} is empty.`,
            },
          ],
        };
      }

      const formatted = objects
        .map((o) => {
          const size =
            o.Size < 1024
              ? `${o.Size}B`
              : o.Size < 1024 * 1024
                ? `${(o.Size / 1024).toFixed(1)}KB`
                : `${(o.Size / (1024 * 1024)).toFixed(1)}MB`;
          return `- ${o.Key} (${size}, ${o.LastModified})`;
        })
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Found ${objects.length} objects in ${bucket}:`,
              "",
              formatted,
            ].join("\n"),
          },
        ],
      };
    },
  );

  log.info("Registered tool: aws_s3_list_objects");

  // CloudFormation: Describe Stack
  server.tool(
    "aws_cloudformation_describe_stack",
    "Get details and status of a CloudFormation stack.",
    {
      stackName: z.string().describe("Stack name or ARN"),
      profile: z.string().optional().describe("AWS profile to use"),
      region: z.string().optional().describe("AWS region"),
    },
    async ({ stackName, profile, region }) => {
      log.info("Tool called: aws_cloudformation_describe_stack");

      const result = await describeStack(
        {
          stackName,
          profile,
          region,
        },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${result.error}`,
            },
          ],
        };
      }

      const stack = result.data?.Stacks?.[0];
      if (!stack) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Stack "${stackName}" not found.`,
            },
          ],
        };
      }

      const outputs = stack.Outputs?.map(
        (o) => `  - ${o.OutputKey}: ${o.OutputValue}`,
      ).join("\n");
      const params = stack.Parameters?.map(
        (p) => `  - ${p.ParameterKey}: ${p.ParameterValue}`,
      ).join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Stack: ${stack.StackName}`,
              `Status: ${stack.StackStatus}`,
              stack.StackStatusReason
                ? `Reason: ${stack.StackStatusReason}`
                : null,
              `Created: ${stack.CreationTime}`,
              stack.LastUpdatedTime
                ? `Last Updated: ${stack.LastUpdatedTime}`
                : null,
              stack.Description ? `Description: ${stack.Description}` : null,
              "",
              outputs ? `Outputs:\n${outputs}` : null,
              params ? `Parameters:\n${params}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      };
    },
  );

  log.info("Registered tool: aws_cloudformation_describe_stack");

  // DynamoDB: Describe Table
  server.tool(
    "aws_dynamodb_describe_table",
    "Get metadata about a DynamoDB table including key schema, indexes, and provisioned capacity.",
    {
      tableName: z.string().describe("DynamoDB table name"),
      profile: z.string().optional().describe("AWS profile to use"),
      region: z.string().optional().describe("AWS region"),
    },
    async ({ tableName, profile, region }) => {
      log.info("Tool called: aws_dynamodb_describe_table");

      const result = await describeDynamoDBTable(
        {
          tableName,
          profile,
          region,
        },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${result.error}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.data?.Table, null, 2),
          },
        ],
      };
    },
  );

  log.info("Registered tool: aws_dynamodb_describe_table");

  // DynamoDB: Scan
  server.tool(
    "aws_dynamodb_scan",
    "Scan a DynamoDB table. Use sparingly on large tables - prefer query when possible.",
    {
      tableName: z.string().describe("DynamoDB table name"),
      filterExpression: z
        .string()
        .optional()
        .describe("Filter expression (e.g., 'status = :s')"),
      expressionAttributeValues: z
        .string()
        .optional()
        .describe(
          'JSON object of attribute values (e.g., \'{\\":s\\":{\\"S\\":\\"active\\"}}\')',
        ),
      limit: z.number().optional().describe("Max items to return (default 25)"),
      profile: z.string().optional().describe("AWS profile to use"),
      region: z.string().optional().describe("AWS region"),
    },
    async ({
      tableName,
      filterExpression,
      expressionAttributeValues,
      limit,
      profile,
      region,
    }) => {
      log.info("Tool called: aws_dynamodb_scan");

      const result = await scanDynamoDB(
        {
          tableName,
          filterExpression,
          expressionAttributeValues,
          limit: limit || 25,
          profile,
          region,
        },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${result.error}`,
            },
          ],
        };
      }

      const items = result.data?.Items || [];
      if (items.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No items found in table ${tableName}.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Found ${items.length} items:`,
              "",
              JSON.stringify(items, null, 2),
            ].join("\n"),
          },
        ],
      };
    },
  );

  log.info("Registered tool: aws_dynamodb_scan");

  // DynamoDB: Query
  server.tool(
    "aws_dynamodb_query",
    "Query a DynamoDB table by partition key. More efficient than scan for targeted lookups.",
    {
      tableName: z.string().describe("DynamoDB table name"),
      keyConditionExpression: z
        .string()
        .describe("Key condition (e.g., 'pk = :pk')"),
      expressionAttributeValues: z
        .string()
        .describe("JSON object of attribute values"),
      indexName: z.string().optional().describe("GSI or LSI name to query"),
      filterExpression: z
        .string()
        .optional()
        .describe("Additional filter expression"),
      limit: z.number().optional().describe("Max items to return"),
      scanIndexForward: z
        .boolean()
        .optional()
        .describe("Sort ascending (true) or descending (false)"),
      profile: z.string().optional().describe("AWS profile to use"),
      region: z.string().optional().describe("AWS region"),
    },
    async ({
      tableName,
      keyConditionExpression,
      expressionAttributeValues,
      indexName,
      filterExpression,
      limit,
      scanIndexForward,
      profile,
      region,
    }) => {
      log.info("Tool called: aws_dynamodb_query");

      const result = await queryDynamoDB(
        {
          tableName,
          keyConditionExpression,
          expressionAttributeValues,
          indexName,
          filterExpression,
          limit,
          scanIndexForward,
          profile,
          region,
        },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${result.error}`,
            },
          ],
        };
      }

      const items = result.data?.Items || [];
      if (items.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No items found matching the query.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Found ${items.length} items:`,
              "",
              JSON.stringify(items, null, 2),
            ].join("\n"),
          },
        ],
      };
    },
  );

  log.info("Registered tool: aws_dynamodb_query");

  // DynamoDB: Get Item
  server.tool(
    "aws_dynamodb_get_item",
    "Get a single item from a DynamoDB table by its primary key.",
    {
      tableName: z.string().describe("DynamoDB table name"),
      key: z
        .string()
        .describe(
          'JSON object of the primary key (e.g., \'{\\"pk\\":{\\"S\\":\\"user#123\\"},\\"sk\\":{\\"S\\":\\"profile\\"}}\')',
        ),
      profile: z.string().optional().describe("AWS profile to use"),
      region: z.string().optional().describe("AWS region"),
    },
    async ({ tableName, key, profile, region }) => {
      log.info("Tool called: aws_dynamodb_get_item");

      const result = await getDynamoDBItem(
        {
          tableName,
          key,
          profile,
          region,
        },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${result.error}`,
            },
          ],
        };
      }

      if (!result.data?.Item) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Item not found with the specified key.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.data.Item, null, 2),
          },
        ],
      };
    },
  );

  log.info("Registered tool: aws_dynamodb_get_item");

  // SQS: List Queues
  server.tool(
    "aws_sqs_list_queues",
    "List SQS queues in the account. Filter by queue name prefix.",
    {
      queueNamePrefix: z
        .string()
        .optional()
        .describe("Filter by queue name prefix"),
      profile: z.string().optional().describe("AWS profile to use"),
      region: z.string().optional().describe("AWS region"),
    },
    async ({ queueNamePrefix, profile, region }) => {
      log.info("Tool called: aws_sqs_list_queues");

      const result = await listSQSQueues(
        {
          queueNamePrefix,
          profile,
          region,
        },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${result.error}`,
            },
          ],
        };
      }

      const queues = result.data?.QueueUrls || [];
      if (queues.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: queueNamePrefix
                ? `No queues found with prefix "${queueNamePrefix}".`
                : "No SQS queues found in this account/region.",
            },
          ],
        };
      }

      const formatted = queues.map((url) => `- ${url}`).join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Found ${queues.length} queues:`,
              "",
              formatted,
              "",
              "Use aws_sqs_get_queue_attributes for details on a specific queue.",
            ].join("\n"),
          },
        ],
      };
    },
  );

  log.info("Registered tool: aws_sqs_list_queues");

  // SQS: Get Queue Attributes
  server.tool(
    "aws_sqs_get_queue_attributes",
    "Get attributes for an SQS queue including approximate message count, visibility timeout, and dead-letter config.",
    {
      queueUrl: z.string().describe("SQS queue URL"),
      profile: z.string().optional().describe("AWS profile to use"),
      region: z.string().optional().describe("AWS region"),
    },
    async ({ queueUrl, profile, region }) => {
      log.info("Tool called: aws_sqs_get_queue_attributes");

      const result = await getSQSQueueAttributes(
        {
          queueUrl,
          profile,
          region,
        },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${result.error}`,
            },
          ],
        };
      }

      const attrs = result.data?.Attributes;
      if (!attrs) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No attributes found for queue.`,
            },
          ],
        };
      }

      const formatted = Object.entries(attrs)
        .map(([key, value]) => `- ${key}: ${value}`)
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: [`Queue Attributes:`, "", formatted].join("\n"),
          },
        ],
      };
    },
  );

  log.info("Registered tool: aws_sqs_get_queue_attributes");

  // SQS: Receive Message
  server.tool(
    "aws_sqs_receive_message",
    "Receive messages from an SQS queue for inspection. Messages are returned to the queue after visibility timeout.",
    {
      queueUrl: z.string().describe("SQS queue URL"),
      maxNumberOfMessages: z
        .number()
        .optional()
        .describe("Max messages to receive (1-10, default 1)"),
      visibilityTimeout: z
        .number()
        .optional()
        .describe("Seconds to hide message (default 30)"),
      profile: z.string().optional().describe("AWS profile to use"),
      region: z.string().optional().describe("AWS region"),
    },
    async ({
      queueUrl,
      maxNumberOfMessages,
      visibilityTimeout,
      profile,
      region,
    }) => {
      log.info("Tool called: aws_sqs_receive_message");

      const result = await receiveSQSMessage(
        {
          queueUrl,
          maxNumberOfMessages: maxNumberOfMessages || 1,
          visibilityTimeout: visibilityTimeout || 30,
          profile,
          region,
        },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${result.error}`,
            },
          ],
        };
      }

      const messages = result.data?.Messages || [];
      if (messages.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No messages available in the queue.`,
            },
          ],
        };
      }

      const formatted = messages
        .map((m, i) => {
          return [
            `Message ${i + 1}:`,
            `  ID: ${m.MessageId}`,
            `  Body: ${m.Body}`,
            m.Attributes
              ? `  Attributes: ${JSON.stringify(m.Attributes)}`
              : null,
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n\n");

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Received ${messages.length} messages (will be returned to queue after visibility timeout):`,
              "",
              formatted,
            ].join("\n"),
          },
        ],
      };
    },
  );

  log.info("Registered tool: aws_sqs_receive_message");

  // SQS: Purge Queue
  server.tool(
    "aws_sqs_purge_queue",
    "Delete all messages from an SQS queue. Use with caution - this is irreversible.",
    {
      queueUrl: z.string().describe("SQS queue URL"),
      profile: z.string().optional().describe("AWS profile to use"),
      region: z.string().optional().describe("AWS region"),
    },
    async ({ queueUrl, profile, region }) => {
      log.info("Tool called: aws_sqs_purge_queue");

      const result = await purgeSQSQueue(
        {
          queueUrl,
          profile,
          region,
        },
        log,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${result.error}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Queue purged successfully. All messages have been deleted.`,
          },
        ],
      };
    },
  );

  log.info("Registered tool: aws_sqs_purge_queue");

  log.info("MCP server configuration complete");

  return server;
}
