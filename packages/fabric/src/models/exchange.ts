/**
 * FabricExchange - Canonical `exchange` model: an event entity representing
 * one LLM operate() call.
 *
 * Turn chains reference the parent exchange and store input deltas only —
 * never the resent history. Tool loops are the history delta within one
 * exchange, not separate entities.
 */

import { fabricIndex } from "../index/fabricIndex.js";
import { isModelRegistered, registerModel } from "../index/registry.js";
import type { ModelSchema } from "../index/types.js";
import type { FabricModel } from "./base.js";

// =============================================================================
// Constants
// =============================================================================

export const EXCHANGE_MODEL_NAME = "exchange";

/**
 * Status vocabulary aligned with operate() settlement
 * (LlmResponseStatus in @jaypie/llm)
 */
export const EXCHANGE_STATUS = {
  COMPLETED: "completed",
  IN_PROGRESS: "in_progress",
  INCOMPLETE: "incomplete",
} as const;

export type ExchangeStatus =
  (typeof EXCHANGE_STATUS)[keyof typeof EXCHANGE_STATUS];

/**
 * Canonical registration schema for the exchange model. Every project shares
 * these attributes, status vocabulary, and indexes.
 */
export const EXCHANGE_MODEL: ModelSchema = {
  indexes: [fabricIndex(), fabricIndex("xid")],
  model: EXCHANGE_MODEL_NAME,
  status: [
    EXCHANGE_STATUS.COMPLETED,
    EXCHANGE_STATUS.INCOMPLETE,
    EXCHANGE_STATUS.IN_PROGRESS,
  ],
};

// =============================================================================
// FabricExchange
// =============================================================================

export interface FabricExchange extends FabricModel {
  /** The actual response text or serialized structured output */
  content?: string;

  /** Interpolation parameters passed to the call */
  data?: Record<string, unknown>;

  /** Reference to the parent exchange for turn chains */
  exchange?: string;

  /** Request input; turn chains store the input delta only */
  input?: unknown;

  /** Served LLM model id (e.g., "claude-sonnet-5"); `model` is the entity type */
  llm?: string;

  /** Position in the exchange lifecycle */
  status: ExchangeStatus;

  /** Provider response id */
  xid?: string;
}

// =============================================================================
// Registration
// =============================================================================

/**
 * Idempotently register the canonical exchange model.
 */
export function registerExchangeModel(): void {
  if (isModelRegistered(EXCHANGE_MODEL_NAME)) {
    return;
  }
  registerModel(EXCHANGE_MODEL);
}
