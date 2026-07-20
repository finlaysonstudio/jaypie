import { APEX, registerExchangeModel } from "@jaypie/fabric";
import { log } from "@jaypie/logger";

import { isInitialized } from "./client.js";
import { createEntity } from "./entities.js";
import { StorableEntity } from "./types.js";

//
//
// Constants
//

/**
 * Byte budget below the 400KB DynamoDB item limit, leaving headroom for
 * GSI keys and attribute-name overhead added at write time.
 */
const MAX_ITEM_BYTES = 350 * 1024;

const TRUNCATED_MARKER = "[truncated]";

//
//
// Types
//

/**
 * Structural subset of @jaypie/llm's LlmExchangeEnvelope. Declared locally so
 * @jaypie/dynamodb takes no dependency on @jaypie/llm.
 */
export interface StoreExchangeEnvelope {
  ids?: string[];
  request?: {
    data?: Record<string, unknown>;
    input?: unknown;
    model?: string;
    [key: string]: unknown;
  };
  resolution?: {
    fallbackAttempts?: number;
    fallbackUsed?: boolean;
    model?: string;
    provider?: string;
    retries?: number;
    [key: string]: unknown;
  };
  response?: {
    content?: unknown;
    error?: unknown;
    historyDelta?: unknown[];
    reasoning?: string[];
    status?: string;
    stopReason?: string;
    usage?: unknown[];
    usageTotals?: Record<string, unknown>;
    [key: string]: unknown;
  };
  timing?: {
    duration?: number;
    startedAt?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface StoreExchangeOptions {
  /** Parent exchange id for turn chains */
  exchange?: string;
  /** Scope for the entity; defaults to APEX */
  scope?: string;
}

//
//
// Helpers
//

function byteSize(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value) ?? "", "utf8");
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

//
//
// Main
//

/**
 * Persist one operate() exchange envelope as an `exchange` entity.
 *
 * Never throws: warns and returns null when the client is uninitialized or
 * the write fails — exchange persistence must not break the LLM call. Owns
 * 400KB item-limit safety by dropping the history delta, then long content,
 * with an explicit truncation marker in metadata.
 */
export async function storeExchange(
  envelope: StoreExchangeEnvelope,
  { exchange, scope }: StoreExchangeOptions = {},
): Promise<StorableEntity | null> {
  try {
    registerExchangeModel();

    if (!isInitialized()) {
      log.warn(
        "[storeExchange] DynamoDB client is not initialized; call initClient() first. Exchange not persisted.",
      );
      return null;
    }

    const { request, resolution, response, timing } = envelope;

    const content =
      typeof response?.content === "string"
        ? response.content
        : response?.content !== undefined
          ? JSON.stringify(response.content)
          : undefined;

    const entity: StorableEntity = {
      id: crypto.randomUUID(),
      model: "exchange",
      scope: scope ?? APEX,
      ...(exchange && { exchange }),
      ...(content !== undefined && { content }),
      ...(request?.data && { data: request.data }),
      ...(request?.input !== undefined && { input: request.input }),
      ...(resolution?.model && { llm: resolution.model }),
      ...(response?.status && { status: response.status }),
      ...(envelope.ids?.length && {
        xid: envelope.ids[envelope.ids.length - 1],
      }),
      metadata: {
        ...(timing?.duration !== undefined && { duration: timing.duration }),
        ...(timing?.startedAt && { startedAt: timing.startedAt }),
        ...(resolution?.provider && { provider: resolution.provider }),
        ...(resolution?.fallbackUsed !== undefined && {
          fallbackUsed: resolution.fallbackUsed,
        }),
        ...(resolution?.fallbackAttempts !== undefined && {
          fallbackAttempts: resolution.fallbackAttempts,
        }),
        ...(resolution?.retries !== undefined && {
          retries: resolution.retries,
        }),
        ...(response?.stopReason && { stopReason: response.stopReason }),
        ...(response?.error !== undefined && { error: response.error }),
        ...(response?.usageTotals && { usage: response.usageTotals }),
        ...(envelope.ids?.length && { ids: envelope.ids }),
      },
      state: {
        ...(response?.historyDelta?.length && {
          historyDelta: response.historyDelta,
        }),
        ...(response?.reasoning?.length && { reasoning: response.reasoning }),
      },
    };

    // 400KB item-limit safety: drop the largest payloads first, then
    // truncate long fields, marking each drop in metadata.truncated
    if (byteSize(entity) > MAX_ITEM_BYTES) {
      const truncated: string[] = [];
      const state = entity.state as Record<string, unknown>;
      if (state.historyDelta) {
        delete state.historyDelta;
        truncated.push("historyDelta");
      }
      if (byteSize(entity) > MAX_ITEM_BYTES && entity.input !== undefined) {
        entity.input = TRUNCATED_MARKER;
        truncated.push("input");
      }
      if (
        byteSize(entity) > MAX_ITEM_BYTES &&
        typeof entity.content === "string"
      ) {
        entity.content = entity.content.slice(0, 1024) + TRUNCATED_MARKER;
        truncated.push("content");
      }
      (entity.metadata as Record<string, unknown>).truncated = truncated;
      log.warn("[storeExchange] Exchange exceeded item size budget; truncated");
      log.var({ truncated });
    }

    return await createEntity({ entity });
  } catch (error) {
    log.warn("[storeExchange] Failed to persist exchange");
    log.var({ error });
    return null;
  }
}
