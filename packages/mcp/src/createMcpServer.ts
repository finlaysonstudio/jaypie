import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

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

  server.registerTool(
    "read_prompt",
    {
      description: "Returns the contents of a specified prompt file",
      inputSchema: {
        filename: z
          .string()
          .describe(
            "The name of the prompt file to read (e.g., example_prompt.md)",
          ),
      },
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
  log.info("MCP server configuration complete");

  return server;
}
