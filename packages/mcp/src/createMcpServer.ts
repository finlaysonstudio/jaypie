import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROMPTS_PATH = path.join(__dirname, "..", "prompts");

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
 * @param version - The version string for the server
 * @returns Configured MCP server instance
 */
export function createMcpServer(version: string = "0.0.0"): McpServer {
  const server = new McpServer(
    {
      name: "jaypie",
      version,
    },
    {
      capabilities: {},
    },
  );

  server.tool(
    "list_prompts",
    "Returns a bulleted list of all .md files in the prompts directory with their descriptions and requirements",
    {},
    async () => {
      try {
        const files = await fs.readdir(PROMPTS_PATH);
        const mdFiles = files.filter((file) => file.endsWith(".md"));

        const prompts = await Promise.all(
          mdFiles.map((file) =>
            parseMarkdownFile(path.join(PROMPTS_PATH, file)),
          ),
        );

        const formattedList = prompts.map(formatPromptListItem).join("\n");

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
      try {
        const filePath = path.join(PROMPTS_PATH, filename);
        const content = await fs.readFile(filePath, "utf-8");

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
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: Prompt file "${filename}" not found in prompts directory`,
              },
            ],
          };
        }

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

  return server;
}
