import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as https from "node:https";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

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
    "Search Datadog logs using the Datadog Logs Search API. Requires DATADOG_API_KEY or DD_API_KEY environment variable. Optionally uses DD_ENV for environment, DD_SERVICE for service, DD_SOURCE for source (defaults to 'lambda'), and DD_QUERY for additional base query terms.",
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

      // Check for API key
      const apiKey = process.env.DATADOG_API_KEY || process.env.DD_API_KEY;
      if (!apiKey) {
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
      log.info("Datadog API key found");

      // Get environment variables
      const ddEnv = process.env.DD_ENV;
      const ddService = process.env.DD_SERVICE;
      const ddSource = process.env.DD_SOURCE;
      const ddQuery = process.env.DD_QUERY;

      // Build query from environment variables and parameters
      const queryParts: string[] = [];

      // Add source (parameter > env var > default 'lambda')
      const effectiveSource = source || ddSource || "lambda";
      queryParts.push(`source:${effectiveSource}`);

      // Add env (parameter > env var)
      const effectiveEnv = env || ddEnv;
      if (effectiveEnv) {
        queryParts.push(`env:${effectiveEnv}`);
      }

      // Add service (parameter > env var)
      const effectiveService = service || ddService;
      if (effectiveService) {
        queryParts.push(`service:${effectiveService}`);
      }

      // Add base query from DD_QUERY if available
      if (ddQuery) {
        queryParts.push(ddQuery);
      }

      // Add user-provided query terms
      if (query) {
        queryParts.push(query);
      }

      const effectiveQuery = queryParts.join(" ");

      log.info(`Effective query: ${effectiveQuery}`);
      log.info(`Source: ${effectiveSource}`);
      if (effectiveEnv) log.info(`Env: ${effectiveEnv}`);
      if (effectiveService) log.info(`Service: ${effectiveService}`);
      if (ddQuery) log.info(`DD_QUERY: ${ddQuery}`);

      // Set defaults
      const effectiveFrom = from || "now-15m";
      const effectiveTo = to || "now";
      const effectiveLimit = Math.min(limit || 50, 1000);
      const effectiveSort = sort || "-timestamp";

      log.info(
        `Search params: from=${effectiveFrom}, to=${effectiveTo}, limit=${effectiveLimit}, sort=${effectiveSort}`,
      );

      // Build request body
      const requestBody = JSON.stringify({
        filter: {
          query: effectiveQuery,
          from: effectiveFrom,
          to: effectiveTo,
        },
        page: {
          limit: effectiveLimit,
        },
        sort: effectiveSort,
      });

      log.info("Making request to Datadog Logs API...");

      return new Promise((resolve) => {
        const options = {
          hostname: "api.datadoghq.com",
          port: 443,
          path: "/api/v2/logs/events/search",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "DD-API-KEY": apiKey,
            "Content-Length": Buffer.byteLength(requestBody),
          },
        };

        const req = https.request(options, (res) => {
          let data = "";

          res.on("data", (chunk: Buffer) => {
            data += chunk.toString();
          });

          res.on("end", () => {
            log.info(`Response status: ${res.statusCode}`);

            if (res.statusCode !== 200) {
              log.error(`Datadog API error: ${res.statusCode}`);
              resolve({
                content: [
                  {
                    type: "text" as const,
                    text: `Error from Datadog API (${res.statusCode}): ${data}`,
                  },
                ],
              });
              return;
            }

            try {
              const response = JSON.parse(data) as {
                data?: Array<{
                  id: string;
                  attributes?: {
                    timestamp?: string;
                    status?: string;
                    service?: string;
                    message?: string;
                    attributes?: Record<string, unknown>;
                  };
                }>;
                meta?: {
                  page?: {
                    after?: string;
                  };
                };
              };
              const logs = response.data || [];
              log.info(`Retrieved ${logs.length} log entries`);

              if (logs.length === 0) {
                resolve({
                  content: [
                    {
                      type: "text" as const,
                      text: `No logs found for query: ${effectiveQuery}\nTime range: ${effectiveFrom} to ${effectiveTo}`,
                    },
                  ],
                });
                return;
              }

              // Format logs for output
              const formattedLogs = logs.map((log) => {
                const attrs = log.attributes || {};
                return {
                  id: log.id,
                  timestamp: attrs.timestamp,
                  status: attrs.status,
                  service: attrs.service,
                  message: attrs.message,
                  attributes: attrs.attributes,
                };
              });

              const resultText = [
                `Query: ${effectiveQuery}`,
                `Time range: ${effectiveFrom} to ${effectiveTo}`,
                `Found ${logs.length} log entries:`,
                "",
                JSON.stringify(formattedLogs, null, 2),
              ].join("\n");

              resolve({
                content: [
                  {
                    type: "text" as const,
                    text: resultText,
                  },
                ],
              });
            } catch (parseError) {
              log.error("Failed to parse Datadog response:", parseError);
              resolve({
                content: [
                  {
                    type: "text" as const,
                    text: `Error parsing Datadog response: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
                  },
                ],
              });
            }
          });
        });

        req.on("error", (error) => {
          log.error("Request error:", error);
          resolve({
            content: [
              {
                type: "text" as const,
                text: `Error connecting to Datadog API: ${error.message}`,
              },
            ],
          });
        });

        req.write(requestBody);
        req.end();
      });
    },
  );

  log.info("Registered tool: datadog_logs");

  log.info("MCP server configuration complete");

  return server;
}
