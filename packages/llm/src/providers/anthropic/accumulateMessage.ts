import { JsonObject } from "@jaypie/types";

import { errorForStatus } from "./client.js";
import { Anthropic } from "./types.js";

//
//
// Constants
//

// Status the client would have raised for each streamed error type, so a
// mid-stream error classifies exactly like the HTTP error it stands in for
const STREAM_ERROR_STATUS: Record<string, number> = {
  api_error: 500,
  authentication_error: 401,
  invalid_request_error: 400,
  not_found_error: 404,
  overloaded_error: 529,
  permission_error: 403,
  rate_limit_error: 429,
  request_too_large: 413,
};
const STREAM_ERROR_STATUS_DEFAULT = 500;

//
//
// Types
//

type BlockRecord = Record<string, unknown>;

interface BlockState {
  block: BlockRecord;
  partialJson: string;
}

//
//
// Helpers
//

/**
 * Overlay the fields a later report sets, keeping earlier ones. Anthropic's
 * `message_delta` usage repeats some counts as null.
 */
export function mergeDefinedFields<T extends object>(
  base: T,
  next: Partial<T> | undefined,
): T {
  const merged = { ...base };
  for (const [key, value] of Object.entries(next ?? {})) {
    if (value !== null && value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

function parseToolInput(partialJson: string): unknown {
  if (partialJson.trim() === "") return {};
  try {
    return JSON.parse(partialJson) as JsonObject;
  } catch {
    // A tool call cut off mid-arguments (max_tokens) carries invalid JSON;
    // keep the raw text so nothing is lost
    return partialJson;
  }
}

function applyDelta(state: BlockState, delta: BlockRecord): void {
  const { block } = state;
  switch (delta.type) {
    case "citations_delta":
      block.citations = [
        ...((block.citations as unknown[] | undefined) ?? []),
        delta.citation,
      ];
      break;
    case "input_json_delta":
      state.partialJson += (delta.partial_json as string | undefined) ?? "";
      break;
    case "signature_delta":
      block.signature = delta.signature;
      break;
    case "text_delta":
      block.text = `${(block.text as string | undefined) ?? ""}${
        (delta.text as string | undefined) ?? ""
      }`;
      break;
    case "thinking_delta":
      block.thinking = `${(block.thinking as string | undefined) ?? ""}${
        (delta.thinking as string | undefined) ?? ""
      }`;
      break;
    default:
      break;
  }
}

function finishBlock(state: BlockState): BlockRecord {
  const { block } = state;
  if ("input" in block) {
    // tool_use (and server tool) inputs stream as JSON fragments; the start
    // event carries an empty placeholder object
    if (state.partialJson !== "") {
      block.input = parseToolInput(state.partialJson);
    } else if (block.input === undefined || block.input === null) {
      block.input = {};
    }
  }
  return block;
}

/**
 * Build the error a streamed `error` event stands for, typed by status so
 * the adapter's classifier treats it like the equivalent HTTP failure.
 */
export function streamErrorFrom(event: {
  error?: { message?: string; type?: string };
}): Error {
  const type = event.error?.type ?? "api_error";
  const status = STREAM_ERROR_STATUS[type] ?? STREAM_ERROR_STATUS_DEFAULT;
  const message =
    event.error?.message ?? `Anthropic stream failed with ${type}`;
  return errorForStatus(status, message, { message });
}

//
//
// Main
//

/**
 * Accumulate an Anthropic Messages stream into the `Message` a non-streaming
 * request returns: content blocks (text, thinking with signature,
 * redacted_thinking, tool_use with parsed input, citations), stop reason,
 * stop sequence, and usage merged from `message_start` and `message_delta`.
 * A streamed `error` event throws. `onActivity` fires on every event.
 */
export async function accumulateAnthropicMessage(
  stream: AsyncIterable<Anthropic.MessageStreamEvent>,
  { onActivity }: { onActivity?: () => void } = {},
): Promise<Anthropic.Message> {
  let message: Anthropic.Message | undefined;
  let stopped = false;
  const blocks = new Map<number, BlockState>();

  for await (const event of stream) {
    onActivity?.();
    switch (event.type) {
      case "message_start":
        message = {
          ...event.message,
          content: [],
          usage: { ...event.message.usage },
        };
        break;
      case "content_block_start":
        blocks.set(event.index, {
          block: { ...(event.content_block as unknown as BlockRecord) },
          partialJson: "",
        });
        break;
      case "content_block_delta": {
        const state = blocks.get(event.index);
        if (state) {
          applyDelta(state, event.delta as unknown as BlockRecord);
        }
        break;
      }
      case "message_delta":
        if (message) {
          const delta = event.delta as {
            stop_reason?: string | null;
            stop_sequence?: string | null;
          };
          if (delta.stop_reason !== undefined) {
            message.stop_reason = delta.stop_reason;
          }
          if (delta.stop_sequence !== undefined) {
            message.stop_sequence = delta.stop_sequence;
          }
          message.usage = mergeDefinedFields(message.usage, event.usage);
        }
        break;
      case "message_stop":
        stopped = true;
        break;
      case "error":
        throw streamErrorFrom(event);
      default:
        break;
    }
  }

  // A stream that closes without message_stop was cut off in transit; fail
  // the attempt (retryable) rather than settle a silently truncated message
  if (!message || !stopped) {
    throw errorForStatus(
      STREAM_ERROR_STATUS_DEFAULT,
      "Anthropic stream ended before message_stop",
    );
  }

  message.content = [...blocks.entries()]
    .sort(([a], [b]) => a - b)
    .map(
      ([, state]) => finishBlock(state) as unknown as Anthropic.ContentBlock,
    );
  return message;
}
