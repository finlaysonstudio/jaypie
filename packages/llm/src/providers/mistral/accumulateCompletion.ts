import { JsonObject } from "@jaypie/types";

import { MistralHttpError, normalizeResponse } from "./client.js";

//
//
// Constants
//

const STATUS_SERVER_ERROR = 500;

//
//
// Types
//

type ContentPart = Record<string, unknown> & { type?: string };

interface ToolCallState {
  function: { arguments: string; name: string };
  id?: string;
  type: string;
}

interface ChoiceState {
  content: ContentPart[];
  finishReason: string | null;
  index: number;
  sawContent: boolean;
  toolCalls: Map<number, ToolCallState>;
}

interface StreamToolCallDelta {
  function?: { arguments?: string; name?: string };
  id?: string;
  index?: number;
  type?: string;
}

interface StreamChoice {
  delta?: {
    content?: string | ContentPart[] | null;
    tool_calls?: StreamToolCallDelta[];
  };
  finish_reason?: string | null;
  index?: number;
}

interface StreamChunk {
  choices?: StreamChoice[];
  code?: string | null;
  created?: number;
  error?: { code?: string; message?: string; type?: string };
  id?: string;
  message?: unknown;
  model?: string;
  object?: string;
  raw_status_code?: number;
  type?: string;
  usage?: JsonObject;
}

//
//
// Helpers
//

function appendText(parts: ContentPart[], text: string): void {
  if (!text) return;
  const previous = parts[parts.length - 1];
  if (previous?.type === "text") {
    previous.text = `${(previous.text as string | undefined) ?? ""}${text}`;
    return;
  }
  parts.push({ text, type: "text" });
}

/**
 * Merge a streamed `thinking` chunk onto an open thinking block, joining the
 * reasoning text, or start a new block after a closed one or after text.
 */
function appendThinking(parts: ContentPart[], chunk: ContentPart): void {
  const previous = parts[parts.length - 1];
  const thinking = (chunk.thinking as ContentPart[] | undefined) ?? [];
  if (previous?.type === "thinking" && !previous.closed) {
    const target = previous.thinking as ContentPart[];
    for (const item of thinking) {
      const last = target[target.length - 1];
      if (last?.type === "text" && item.type === "text") {
        last.text = `${(last.text as string | undefined) ?? ""}${
          (item.text as string | undefined) ?? ""
        }`;
      } else {
        target.push({ ...item });
      }
    }
    if (chunk.closed !== undefined) previous.closed = chunk.closed;
    return;
  }
  parts.push({
    ...chunk,
    thinking: thinking.map((item) => ({ ...item })),
  });
}

function appendContent(
  state: ChoiceState,
  content: string | ContentPart[] | null | undefined,
): void {
  if (content === null || content === undefined) return;
  state.sawContent = true;
  if (typeof content === "string") {
    appendText(state.content, content);
    return;
  }
  for (const chunk of content) {
    if (chunk.type === "thinking") {
      appendThinking(state.content, chunk);
    } else if (chunk.type === "text") {
      appendText(state.content, (chunk.text as string | undefined) ?? "");
    } else {
      state.content.push({ ...chunk });
    }
  }
}

/**
 * Locate the tool call a delta continues. OpenAI-compatible streams key
 * deltas by `index`; a delta without one continues the call with the same
 * id, or the latest call when it carries no id either.
 */
function toolCallKey(
  calls: Map<number, ToolCallState>,
  delta: StreamToolCallDelta,
): number {
  if (typeof delta.index === "number") return delta.index;
  if (delta.id) {
    for (const [key, call] of calls) {
      if (call.id === delta.id) return key;
    }
    return calls.size;
  }
  return Math.max(calls.size - 1, 0);
}

function appendToolCalls(
  state: ChoiceState,
  deltas: StreamToolCallDelta[] | undefined,
): void {
  for (const delta of deltas ?? []) {
    const key = toolCallKey(state.toolCalls, delta);
    const call = state.toolCalls.get(key) ?? {
      function: { arguments: "", name: "" },
      type: "function",
    };
    if (!state.toolCalls.has(key)) state.toolCalls.set(key, call);
    if (delta.id) call.id = delta.id;
    if (delta.type) call.type = delta.type;
    if (delta.function?.name) call.function.name += delta.function.name;
    if (delta.function?.arguments) {
      call.function.arguments += delta.function.arguments;
    }
  }
}

/**
 * Content as the non-streaming API returns it: a string when only text
 * arrived, an array of chunks when reasoning blocks are present.
 */
function settleContent(state: ChoiceState): string | ContentPart[] | null {
  if (state.content.length === 0) return state.sawContent ? "" : null;
  if (state.content.every((part) => part.type === "text")) {
    return state.content.map((part) => part.text as string).join("");
  }
  return state.content;
}

/**
 * Build the error a streamed error chunk stands for, carrying the status
 * Mistral reports so the adapter's classifier treats it like the equivalent
 * HTTP failure.
 */
export function streamErrorFrom(chunk: StreamChunk): MistralHttpError {
  const status = chunk.raw_status_code ?? STATUS_SERVER_ERROR;
  const message =
    (typeof chunk.message === "string" ? chunk.message : undefined) ??
    chunk.error?.message ??
    `Mistral stream failed with status ${status}`;
  return new MistralHttpError(status, message, {
    code: chunk.code ?? chunk.error?.code ?? undefined,
    type: chunk.type ?? chunk.error?.type,
  });
}

//
//
// Main
//

/**
 * Accumulate a Chat Completions stream into the completion a non-streaming
 * request returns (normalized the same way): content (a string, or chunks
 * when reasoning is engaged), tool calls merged by index with concatenated
 * arguments, finish reason, and the usage the final chunk reports. An error
 * chunk throws. `onActivity` fires on every chunk.
 */
export async function accumulateMistralCompletion(
  stream: AsyncIterable<JsonObject>,
  { onActivity }: { onActivity?: () => void } = {},
): Promise<JsonObject> {
  const choices = new Map<number, ChoiceState>();
  const completion: Record<string, unknown> = {
    object: "chat.completion",
  };
  let received = false;

  for await (const raw of stream) {
    onActivity?.();
    received = true;
    const chunk = raw as StreamChunk;

    if (chunk.error || chunk.object === "error") {
      throw streamErrorFrom(chunk);
    }

    if (chunk.id) completion.id = chunk.id;
    if (chunk.created !== undefined) completion.created = chunk.created;
    if (chunk.model) completion.model = chunk.model;
    if (chunk.usage) completion.usage = chunk.usage;

    for (const [position, choice] of (chunk.choices ?? []).entries()) {
      const index = choice.index ?? position;
      const state = choices.get(index) ?? {
        content: [],
        finishReason: null,
        index,
        sawContent: false,
        toolCalls: new Map(),
      };
      if (!choices.has(index)) choices.set(index, state);
      appendContent(state, choice.delta?.content);
      appendToolCalls(state, choice.delta?.tool_calls);
      if (choice.finish_reason) state.finishReason = choice.finish_reason;
    }
  }

  // A stream that closes without a finish reason was cut off in transit;
  // fail the attempt (retryable) rather than settle a truncated completion
  const settled = [...choices.values()].some(
    (state) => state.finishReason !== null,
  );
  if (!received || !settled) {
    throw new MistralHttpError(
      STATUS_SERVER_ERROR,
      "Mistral stream ended before the completion finished",
    );
  }

  completion.choices = [...choices.values()]
    .sort((a, b) => a.index - b.index)
    .map((state) => {
      const message: Record<string, unknown> = {
        content: settleContent(state),
        role: "assistant",
      };
      if (state.toolCalls.size > 0) {
        message.tool_calls = [...state.toolCalls.entries()]
          .sort(([a], [b]) => a - b)
          .map(([, call]) => call);
      }
      return {
        finish_reason: state.finishReason,
        index: state.index,
        message,
      };
    });

  return normalizeResponse(completion as JsonObject);
}
