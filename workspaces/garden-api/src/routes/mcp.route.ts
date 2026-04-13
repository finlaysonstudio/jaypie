import { loadEnvSecrets } from "@jaypie/aws";
import {
  calculateScope,
  createEntity,
  deleteEntity,
  getEntity,
  initClient,
  queryByCategory,
  queryByScope,
  queryByXid,
  updateEntity,
} from "@jaypie/dynamodb";
import {
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
} from "@jaypie/errors";
import {
  extractToken,
  hasPermission,
  JOURNAL_CATEGORIES,
  JOURNAL_MODEL,
  NOTE_MODEL,
  validateApiKey,
} from "@jaypie/garden-models";
import type {
  JournalCategory,
  JournalEntity,
  NoteEntity,
} from "@jaypie/garden-models";
import { log } from "@jaypie/logger";
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
import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

//
//
// Constants
//

const GARDEN_MCP_VERSION = "0.0.1";
const MCP_REQUIRED_PERMISSION = "garden:*";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// In prod (esbuild), MCP_SKILLS_PATH is set via banner to dist/skills
// In dev (tsx), resolve via symlink: src/routes/ -> ../../skills
const SKILLS_PATH =
  process.env.MCP_SKILLS_PATH || path.join(__dirname, "..", "..", "skills");

const skillStore = createMarkdownStore({ path: SKILLS_PATH });

//
//
// Request Context (safe for single-concurrency Lambda)
//

let requestGarden: string | undefined;

function getRequestGarden(): string {
  if (!requestGarden) {
    throw new BadRequestError(
      "This API key is not associated with a garden. Create a key with a garden to use this tool.",
    );
  }
  return requestGarden;
}

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

    const result = await validateApiKey(token);
    if (!hasPermission(result.permissions, MCP_REQUIRED_PERMISSION)) {
      throw new ForbiddenError();
    }
    requestGarden = result.garden;
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

function buildSkillXid(skillAlias: string): string {
  return `skill:${skillAlias}`;
}

async function findSkillNote(
  scope: string,
  skillAlias: string,
): Promise<NoteEntity | null> {
  const xid = buildSkillXid(skillAlias);
  const result = await queryByXid({ model: NOTE_MODEL, scope, xid });
  return (result as NoteEntity) ?? null;
}

async function handleSkillNote({
  alias,
  note,
  scope,
}: {
  alias: string;
  note: string | false;
  scope: string;
}): Promise<{ deleted: string } | { created: string } | { updated: string }> {
  const xid = buildSkillXid(alias);
  const existing = await findSkillNote(scope, alias);

  if (note === false) {
    if (existing) {
      await deleteEntity({ id: existing.id, model: NOTE_MODEL });
      log.trace("Skill note deleted", { alias, id: existing.id });
      return { deleted: existing.id };
    }
    return { deleted: "none" };
  }

  if (existing) {
    const updated = {
      ...existing,
      content: note,
      updatedAt: new Date().toISOString(),
    };
    await updateEntity({ entity: updated });
    log.trace("Skill note updated", { alias, id: existing.id });
    return { updated: existing.id };
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const entity = {
    content: note,
    createdAt: now,
    id,
    model: NOTE_MODEL,
    name: `skill:${alias}`,
    scope,
    updatedAt: now,
    xid,
  };
  await createEntity({ entity });
  log.trace("Skill note created", { alias, id });
  return { created: id };
}

async function handleSkillRequest({
  alias,
  note,
}: {
  alias?: string;
  note?: string | false;
}): Promise<string> {
  const normalized = normalizeAlias(alias || "index");

  if (!isValidAlias(normalized)) {
    throw new Error(
      `Invalid skill alias "${normalized}". Use alphanumeric characters, hyphens, and underscores only.`,
    );
  }

  // Note operations require a garden scope
  if (note !== undefined) {
    const scope = getGardenScope();
    const result = await handleSkillNote({ alias: normalized, note, scope });
    return JSON.stringify(result, null, 2);
  }

  if (normalized === "index") {
    const allSkills = await skillStore.list();
    const skills = allSkills.filter(
      (s: { alias: string }) => s.alias !== "index",
    );
    const skillList = skills.map(formatSkillListItem).join("\n");
    return `# Index of Skills\n\n${skillList}`;
  }

  const skill = await skillStore.find(normalized);
  const matchedAlias = skill?.alias ?? normalized;

  if (!skill) {
    // No skill found — check for user notes before throwing
    try {
      const scope = getGardenScope();
      const skillNote = await findSkillNote(scope, normalized);
      if (skillNote) {
        return `<UserNotes>\n${skillNote.content}\n</UserNotes>`;
      }
    } catch {
      // No garden context — skip note lookup
    }
    throw new Error(
      `Skill "${normalized}" not found. Use skill("index") to list available skills.`,
    );
  }

  const skillPath = path.join(SKILLS_PATH, `${matchedAlias}.md`);
  let content = await fs.readFile(skillPath, "utf-8");

  if (matchedAlias !== normalized) {
    content = addAliasToFrontmatter(content, matchedAlias);
  }

  // Append user note if one exists for this skill
  try {
    const scope = getGardenScope();
    const skillNote = await findSkillNote(scope, matchedAlias);
    if (skillNote) {
      content += `\n---\n<UserNotes>\n${skillNote.content}\n</UserNotes>`;
    }
  } catch {
    // No garden context — skip note lookup
  }

  return content;
}

//
//
// Journal Helpers
//

const JOURNAL_DEFAULT_CATEGORY: JournalCategory = "note";
const JOURNAL_DEFAULT_LIMIT = 6;
const JOURNAL_LIST_CONTENT_TRUNCATE = 80;
const JOURNAL_MAX_LIMIT = 100;
const JOURNAL_WAKE_LIMIT = 12;
const JOURNAL_WAKE_SESSION_LIMIT = 3;

function getGardenScope(): string {
  const gardenId = getRequestGarden();
  return calculateScope({ id: gardenId, model: "garden" });
}

async function handleJournalRequest(params: {
  action: string;
  category?: string;
  cursor?: string;
  data?: {
    alias?: string;
    category?: string;
    content?: string;
    name?: string;
  };
  id?: string;
  limit?: number;
}): Promise<unknown> {
  const { action } = params;
  const scope = getGardenScope();

  switch (action) {
    case "create": {
      if (!params.data?.content) {
        throw new BadRequestError("data.content is required for create");
      }
      const entryId = crypto.randomUUID();
      const category = (params.data.category ||
        JOURNAL_DEFAULT_CATEGORY) as JournalCategory;
      const alias = params.data.alias || entryId.slice(0, 8);
      const now = new Date().toISOString();
      const entity = {
        alias,
        category,
        content: params.data.content,
        createdAt: now,
        id: entryId,
        model: JOURNAL_MODEL,
        name: params.data.name || params.data.content.slice(0, 50),
        scope,
        updatedAt: now,
      };
      await createEntity({ entity });
      log.trace("Journal entry created", { category, id: entryId });
      return { category, created: entryId, name: entity.name };
    }

    case "read": {
      if (!params.id) {
        throw new BadRequestError("id is required for read");
      }
      const entry = await getEntity({ id: params.id, model: JOURNAL_MODEL });
      if (!entry) {
        throw new BadRequestError(`Journal entry "${params.id}" not found`);
      }
      return entry;
    }

    case "update": {
      if (!params.id) {
        throw new BadRequestError("id is required for update");
      }
      if (!params.data) {
        throw new BadRequestError("data is required for update");
      }
      const existing = await getEntity({ id: params.id, model: JOURNAL_MODEL });
      if (!existing) {
        throw new BadRequestError(`Journal entry "${params.id}" not found`);
      }
      const updates: Record<string, unknown> = {
        ...existing,
        updatedAt: new Date().toISOString(),
      };
      if (params.data.content !== undefined)
        updates.content = params.data.content;
      if (params.data.name !== undefined) updates.name = params.data.name;
      if (params.data.alias !== undefined) updates.alias = params.data.alias;
      if (params.data.category !== undefined)
        updates.category = params.data.category;
      await updateEntity({ entity: updates as unknown as JournalEntity });
      log.trace("Journal entry updated", { id: params.id });
      return { updated: params.id };
    }

    case "delete": {
      if (!params.id) {
        throw new BadRequestError("id is required for delete");
      }
      await deleteEntity({ id: params.id, model: JOURNAL_MODEL });
      log.trace("Journal entry deleted", { id: params.id });
      return { deleted: params.id };
    }

    case "list": {
      const limit = Math.min(
        params.limit || JOURNAL_DEFAULT_LIMIT,
        JOURNAL_MAX_LIMIT,
      );
      const startKey = params.cursor
        ? JSON.parse(Buffer.from(params.cursor, "base64url").toString())
        : undefined;

      let result;
      if (params.category) {
        result = await queryByCategory({
          category: params.category,
          limit,
          model: JOURNAL_MODEL,
          scope,
          startKey,
        });
      } else {
        result = await queryByScope({
          limit,
          model: JOURNAL_MODEL,
          scope,
          startKey,
        });
      }

      const entries = (result.items as JournalEntity[]).map((item) => ({
        category: item.category,
        content:
          item.content.length > JOURNAL_LIST_CONTENT_TRUNCATE
            ? item.content.slice(0, JOURNAL_LIST_CONTENT_TRUNCATE) + "..."
            : item.content,
        createdAt: item.createdAt,
        id: item.id,
        name: item.name,
      }));

      const cursor = result.lastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.lastEvaluatedKey)).toString(
            "base64url",
          )
        : undefined;

      return { cursor, entries };
    }

    case "wake": {
      const [sessions, notes, reviews] = await Promise.all(
        (["session", "note", "review"] as const).map((cat) =>
          queryByCategory({
            category: cat,
            limit: JOURNAL_WAKE_LIMIT,
            model: JOURNAL_MODEL,
            scope,
          }),
        ),
      );

      const toIndex = (items: JournalEntity[]) =>
        items.map((item) => ({
          createdAt: item.createdAt,
          id: item.id,
          name: item.name,
        }));

      return {
        noteIndex: toIndex(notes.items as JournalEntity[]),
        recentSessions: (sessions.items as JournalEntity[]).slice(
          0,
          JOURNAL_WAKE_SESSION_LIMIT,
        ),
        reviewIndex: toIndex(reviews.items as JournalEntity[]),
        sessionIndex: toIndex(sessions.items as JournalEntity[]),
      };
    }

    default:
      throw new BadRequestError(
        `Unknown action: ${action}. Use create, read, update, delete, list, or wake.`,
      );
  }
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
    "journal",
    "Create, read, update, delete, list, or wake journal entries scoped to your garden. Requires a garden-associated API key.",
    {
      action: z
        .enum(["create", "read", "update", "delete", "list", "wake"])
        .describe("Action to perform"),
      category: z
        .enum(JOURNAL_CATEGORIES)
        .optional()
        .describe("Filter by category (list only)"),
      cursor: z
        .string()
        .optional()
        .describe("Pagination cursor from previous list response"),
      data: z
        .object({
          alias: z
            .string()
            .optional()
            .describe("Human-friendly slug for lookup"),
          category: z
            .enum(JOURNAL_CATEGORIES)
            .optional()
            .describe("Entry category (default: note)"),
          content: z.string().optional().describe("Journal entry content"),
          name: z.string().optional().describe("Entry name/title"),
        })
        .optional()
        .describe("Data for create/update"),
      id: z
        .string()
        .uuid()
        .optional()
        .describe("Required for read/update/delete"),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Max entries to return (list only, default 6)"),
    },
    async (params) => {
      const result = await handleJournalRequest(params);
      return {
        content: [
          {
            text:
              typeof result === "string"
                ? result
                : JSON.stringify(result, null, 2),
            type: "text" as const,
          },
        ],
      };
    },
  );

  server.tool(
    "skill",
    "Access Jaypie development documentation. Pass a skill alias (e.g., 'aws', 'tests', 'errors') to get that documentation. Pass 'index' or no argument to list all available skills. Use 'note' to add/update/delete a user note on a skill.",
    {
      alias: z
        .string()
        .optional()
        .describe(
          "Skill alias (e.g., 'aws', 'tests'). Omit or use 'index' to list all skills.",
        ),
      note: z
        .union([z.string(), z.literal(false)])
        .optional()
        .describe(
          "String to create/update a note on the skill, or false to delete an existing note.",
        ),
    },
    async ({ alias, note }) => {
      const text = await handleSkillRequest({ alias, note });
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
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

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
