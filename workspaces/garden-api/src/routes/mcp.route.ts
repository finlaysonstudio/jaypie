import { loadEnvSecrets } from "@jaypie/aws";
import { initClient } from "@jaypie/dynamodb";
import { ForbiddenError, UnauthorizedError } from "@jaypie/errors";
import {
  createMarkdownStore,
  isValidAlias,
  normalizeAlias,
  type SkillRecord,
} from "@jaypie/tildeskill";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import type { NextFunction, Request, Response } from "express";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { extractToken, validateApiKey } from "@jaypie/garden-models";

//
//
// Constants
//

const GARDEN_MCP_VERSION = "0.0.1";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// In prod (esbuild), MCP_SKILLS_PATH is set via banner to dist/skills
// In dev (tsx), resolve via symlink: src/routes/ -> ../../skills
const SKILLS_PATH =
  process.env.MCP_SKILLS_PATH || path.join(__dirname, "..", "..", "skills");

const skillStore = createMarkdownStore({ path: SKILLS_PATH });

//
//
// Auth Middleware
//

let initialized = false;

async function ensureInitialized(): Promise<void> {
  if (!initialized) {
    await loadEnvSecrets("PROJECT_SALT");
    initClient({ endpoint: process.env.DYNAMODB_ENDPOINT });
    initialized = true;
  }
}

async function mcpAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractToken(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedError();
    }

    await ensureInitialized();

    await validateApiKey(token);
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      res.status(401).json({ error: "Unauthorized" });
    } else if (error instanceof ForbiddenError) {
      res.status(403).json({ error: "Forbidden" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

//
//
// Skill Helpers
//

function getAlternativeSpellings(alias: string): string[] {
  const alternatives: string[] = [];
  if (alias.endsWith("es")) {
    alternatives.push(alias.slice(0, -1));
    alternatives.push(alias.slice(0, -2));
  } else if (alias.endsWith("s")) {
    alternatives.push(alias.slice(0, -1));
  } else {
    alternatives.push(alias + "s");
    alternatives.push(alias + "es");
  }
  return alternatives;
}

function addAliasToFrontmatter(content: string, matchedAlias: string): string {
  if (content.startsWith("---")) {
    const endIndex = content.indexOf("---", 3);
    if (endIndex !== -1) {
      const beforeClose = content.slice(0, endIndex);
      const afterClose = content.slice(endIndex);
      return `${beforeClose}alias: ${matchedAlias}\n${afterClose}`;
    }
  }
  return `---\nalias: ${matchedAlias}\n---\n\n${content}`;
}

function formatSkillListItem(skill: SkillRecord): string {
  const { alias, description } = skill;
  return description ? `* ${alias} - ${description}` : `* ${alias}`;
}

async function handleSkillRequest(alias?: string): Promise<string> {
  const normalized = normalizeAlias(alias || "index");

  if (!isValidAlias(normalized)) {
    throw new Error(
      `Invalid skill alias "${normalized}". Use alphanumeric characters, hyphens, and underscores only.`,
    );
  }

  if (normalized === "index") {
    const indexRecord = await skillStore.get("index");
    const indexContent = indexRecord?.content || "";
    const allSkills = await skillStore.list();
    const skills = allSkills.filter(
      (s: { alias: string }) => s.alias !== "index",
    );
    const skillList = skills.map(formatSkillListItem).join("\n");
    if (indexContent) {
      return `${indexContent}\n\n## Available Skills\n\n${skillList}`;
    }
    return `# Jaypie Skills\n\n## Available Skills\n\n${skillList}`;
  }

  let skill = await skillStore.get(normalized);
  let matchedAlias = normalized;

  if (!skill) {
    const alternatives = getAlternativeSpellings(normalized);
    for (const alt of alternatives) {
      skill = await skillStore.get(alt);
      if (skill) {
        matchedAlias = alt;
        break;
      }
    }
  }

  if (!skill) {
    throw new Error(
      `Skill "${normalized}" not found. Use skill("index") to list available skills.`,
    );
  }

  const skillPath = path.join(SKILLS_PATH, `${matchedAlias}.md`);
  let content = await fs.readFile(skillPath, "utf-8");

  if (matchedAlias !== normalized) {
    content = addAliasToFrontmatter(content, matchedAlias);
  }

  return content;
}

//
//
// Garden MCP Server
//

function createGardenMcpServer(): McpServer {
  const server = new McpServer({
    name: "garden",
    version: GARDEN_MCP_VERSION,
  });

  server.tool(
    "skill",
    "Access Jaypie development documentation. Pass a skill alias (e.g., 'aws', 'tests', 'errors') to get that documentation. Pass 'index' or no argument to list all available skills.",
    { alias: z.string().optional().describe("Skill alias (e.g., 'aws', 'tests'). Omit or use 'index' to list all skills.") },
    async ({ alias }) => {
      const text = await handleSkillRequest(alias);
      return { content: [{ text, type: "text" as const }] };
    },
  );

  server.tool(
    "version",
    "Prints the current version and hash",
    {},
    async () => {
      const commit = (process.env.PROJECT_COMMIT || "unknown").slice(0, 8);
      return {
        content: [
          {
            text: `@jaypie/garden-api@${GARDEN_MCP_VERSION} (${commit})`,
            type: "text",
          },
        ],
      };
    },
  );

  return server;
}

//
//
// MCP Handler
//

// Use InMemoryTransport to bridge JSON-RPC messages to the McpServer.
// StreamableHTTPServerTransport uses Hono's getRequestListener which is
// incompatible with Lambda's custom LambdaResponseStreaming adapter.
async function createMcpHandler(): Promise<
  (req: Request, res: Response) => Promise<void>
> {
  const server = createGardenMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);

  return async (req: Request, res: Response): Promise<void> => {
    try {
      // Collect body from Lambda request stream
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const message: JSONRPCMessage = JSON.parse(rawBody);

      // Collect response from server
      const responsePromise = new Promise<JSONRPCMessage>((resolve) => {
        const originalOnMessage = clientTransport.onmessage;
        clientTransport.onmessage = (response: JSONRPCMessage) => {
          // Restore original handler
          clientTransport.onmessage = originalOnMessage;
          resolve(response);
        };
      });

      // Send message and wait for response
      await clientTransport.send(message);
      const response = await responsePromise;

      res.setHeader("Content-Type", "application/json");
      res.status(200).json(response);
    } catch (error) {
      if (!res.headersSent) {
        res.status(400).json({
          error: {
            code: -32700,
            message: "Parse error",
            data: error instanceof Error ? error.message : String(error),
          },
          id: null,
          jsonrpc: "2.0",
        });
      }
    }
  };
}

//
//
// Export
//

export { createMcpHandler, mcpAuthMiddleware };
