import type { HttpContext } from "../http/types.js";
import type {
  FabricDataListOptions,
  ScopeContext,
  ScopeFunction,
} from "./types.js";
import { DEFAULT_LIMIT, MAX_LIMIT } from "./types.js";

/**
 * Default scope value (APEX)
 */
export const APEX = "@";

/**
 * Extract ID from path parameters
 */
export function extractId(context: HttpContext): string | undefined {
  return context.params.id;
}

/**
 * Extract scope context from HTTP context
 */
export function extractScopeContext(context: HttpContext): ScopeContext {
  return {
    body: context.body,
    params: context.params,
    query: context.query,
  };
}

/**
 * Calculate scope from scope configuration
 */
export async function calculateScopeFromConfig(
  scopeConfig: ScopeFunction | string | undefined,
  context: HttpContext,
): Promise<string> {
  if (scopeConfig === undefined) {
    return APEX;
  }

  if (typeof scopeConfig === "string") {
    return scopeConfig;
  }

  const scopeContext = extractScopeContext(context);
  return scopeConfig(scopeContext);
}

/**
 * Transform HTTP context to create operation input
 * Extracts body fields for entity creation
 */
export function transformCreate(context: HttpContext): Record<string, unknown> {
  const body = context.body as Record<string, unknown> | undefined;
  return { ...body };
}

/**
 * Transform HTTP context to read operation input
 * Extracts ID from path parameters
 */
export function transformRead(context: HttpContext): { id: string } {
  const id = extractId(context);
  if (!id) {
    throw new Error("Missing id parameter");
  }
  return { id };
}

/**
 * Transform HTTP context to update operation input
 * Extracts ID from path and merges with body
 */
export function transformUpdate(
  context: HttpContext,
): { id: string } & Record<string, unknown> {
  const id = extractId(context);
  if (!id) {
    throw new Error("Missing id parameter");
  }
  const body = context.body as Record<string, unknown> | undefined;
  return { id, ...body };
}

/**
 * Transform HTTP context to delete operation input
 * Extracts ID from path parameters
 */
export function transformDelete(context: HttpContext): { id: string } {
  const id = extractId(context);
  if (!id) {
    throw new Error("Missing id parameter");
  }
  return { id };
}

/**
 * Transform HTTP context to archive operation input
 * Extracts ID from path parameters
 */
export function transformArchive(context: HttpContext): { id: string } {
  const id = extractId(context);
  if (!id) {
    throw new Error("Missing id parameter");
  }
  return { id };
}

/**
 * Transform HTTP context to list operation input
 * Extracts pagination options from query string
 */
export function transformList(
  context: HttpContext,
  defaultLimit: number = DEFAULT_LIMIT,
  maxLimit: number = MAX_LIMIT,
): FabricDataListOptions {
  const query = context.query;

  // Parse limit with bounds
  let limit = defaultLimit;
  const limitParam = query.get("limit");
  if (limitParam) {
    const parsed = parseInt(limitParam, 10);
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, maxLimit);
    }
  }

  // Parse cursor
  const startKey = query.get("cursor") ?? query.get("startKey") ?? undefined;

  // Parse sort order
  const ascending =
    query.get("ascending") === "true" || query.get("sort") === "asc";

  // Parse archived/deleted flags
  const archived = query.get("archived") === "true";
  const deleted = query.get("deleted") === "true";

  return {
    archived,
    ascending,
    deleted,
    limit,
    startKey,
  };
}

/**
 * Transform HTTP context to execute operation input
 * Extracts ID from path and merges with body
 */
export function transformExecute(
  context: HttpContext,
): { id: string } & Record<string, unknown> {
  const id = extractId(context);
  if (!id) {
    throw new Error("Missing id parameter");
  }
  const body = context.body as Record<string, unknown> | undefined;
  return { id, ...body };
}

/**
 * Pluralize a model alias for route paths
 * Simple pluralization: adds 's' unless already ends in 's'
 */
export function pluralize(alias: string): string {
  if (alias.endsWith("s")) {
    return alias;
  }
  // Handle common irregular plurals
  if (alias.endsWith("y")) {
    return alias.slice(0, -1) + "ies";
  }
  if (alias.endsWith("x") || alias.endsWith("ch") || alias.endsWith("sh")) {
    return alias + "es";
  }
  return alias + "s";
}

/**
 * Capitalize first letter of string
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Encode pagination cursor for client response
 */
export function encodeCursor(
  lastEvaluatedKey: Record<string, unknown> | undefined,
): string | undefined {
  if (!lastEvaluatedKey) {
    return undefined;
  }
  return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString("base64");
}

/**
 * Decode pagination cursor from client request
 */
export function decodeCursor(
  cursor: string | undefined,
): Record<string, unknown> | undefined {
  if (!cursor) {
    return undefined;
  }
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf-8");
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
