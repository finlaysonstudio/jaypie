import type { Message, MessageLevel, ServiceContext } from "../types.js";

import type {
  HttpContext,
  HttpStreamEvent,
  HttpStreamEventComplete,
  HttpStreamEventData,
  HttpStreamEventError,
  HttpStreamEventMessage,
  HttpStreamEventNoop,
  HttpStreamEventText,
  HttpStreamEventToolCall,
  HttpStreamEventToolResult,
  StreamConfig,
  StreamOption,
} from "./types.js";
import { HttpStreamEventType } from "./types.js";

// #region Constants

/**
 * Default stream configuration
 */
export const DEFAULT_STREAM_CONFIG: StreamConfig = {
  format: "ndjson",
  heartbeat: 15000,
  includeTools: true,
};

// #endregion

// #region Stream Config

/**
 * Normalize stream option to StreamConfig
 * - true → default config (NDJSON format, tools included)
 * - false/undefined → disabled (returns undefined)
 */
export function normalizeStreamConfig(
  option: StreamOption | undefined,
): StreamConfig | undefined {
  if (option === true) {
    return { ...DEFAULT_STREAM_CONFIG };
  }
  return undefined;
}

/**
 * Check if streaming is enabled
 */
export function isStreamingEnabled(option: StreamOption | undefined): boolean {
  return option === true;
}

// #endregion

// #region Event Formatting

/**
 * Format a stream event as SSE (Server-Sent Events)
 *
 * SSE format:
 * event: <type>
 * data: <json>
 *
 */
export function formatSseEvent(event: HttpStreamEvent): string {
  const eventType = event.stream;
  const data = JSON.stringify(event);
  return `event: ${eventType}\ndata: ${data}\n\n`;
}

/**
 * Format a stream event as NDJSON (Newline-Delimited JSON)
 */
export function formatNdjsonEvent(event: HttpStreamEvent): string {
  return JSON.stringify(event) + "\n";
}

/**
 * Format a stream event based on config
 */
export function formatStreamEvent(
  event: HttpStreamEvent,
  config: StreamConfig,
): string {
  if (config.format === "ndjson") {
    return formatNdjsonEvent(event);
  }
  return formatSseEvent(event);
}

/**
 * Get content-type header for stream format
 */
export function getStreamContentType(config: StreamConfig): string {
  if (config.format === "ndjson") {
    return "application/x-ndjson";
  }
  return "text/event-stream";
}

// #endregion

// #region Event Creators

/**
 * Create a message event (progress update)
 */
export function createMessageEvent(
  content: string,
  level?: MessageLevel,
): HttpStreamEventMessage {
  const event: HttpStreamEventMessage = {
    stream: HttpStreamEventType.Message,
    content,
  };
  if (level !== undefined) {
    event.level = level;
  }
  return event;
}

/**
 * Create a text event (LLM text chunk)
 */
export function createTextEvent(content: string): HttpStreamEventText {
  return {
    stream: HttpStreamEventType.Text,
    content,
  };
}

/**
 * Create a tool call event
 */
export function createToolCallEvent(toolCall: {
  id: string;
  name: string;
  arguments: string;
}): HttpStreamEventToolCall {
  return {
    stream: HttpStreamEventType.ToolCall,
    toolCall,
  };
}

/**
 * Create a tool result event
 */
export function createToolResultEvent(toolResult: {
  id: string;
  name: string;
  result: unknown;
}): HttpStreamEventToolResult {
  return {
    stream: HttpStreamEventType.ToolResult,
    toolResult,
  };
}

/**
 * Create a data event (final response)
 */
export function createDataEvent<T>(data: T): HttpStreamEventData<T> {
  return {
    stream: HttpStreamEventType.Data,
    data,
  };
}

/**
 * Create an error event
 */
export function createErrorEvent(error: {
  status: number | string;
  title: string;
  detail?: string;
}): HttpStreamEventError {
  return {
    stream: HttpStreamEventType.Error,
    error,
  };
}

/**
 * Create a complete event
 */
export function createCompleteEvent(): HttpStreamEventComplete {
  return {
    stream: HttpStreamEventType.Complete,
  };
}

/**
 * Create a noop event (keep-alive signal)
 */
export function createNoopEvent(): HttpStreamEventNoop {
  return {
    stream: HttpStreamEventType.Noop,
  };
}

// #endregion

// #region Stream Context

/**
 * Callback type for writing stream events
 */
export type StreamWriter = (event: HttpStreamEvent) => void | Promise<void>;

/**
 * Extended service context with streaming capabilities
 */
export interface HttpStreamContext<TAuth = unknown> extends ServiceContext {
  /** Authorization result (returned from authorization function) */
  auth?: TAuth;
  /** HTTP context for advanced use cases */
  http?: HttpContext;
  /** Stream text content to client */
  streamText: (content: string) => void;
  /** Stream a structured event to client */
  streamEvent: (event: HttpStreamEvent) => void;
}

/**
 * Create a stream context with streaming capabilities
 *
 * @param writer - Function to write stream events
 * @param baseContext - Base service context to extend
 * @returns Extended context with stream methods
 */
export function createStreamContext<TAuth = unknown>(
  writer: StreamWriter,
  baseContext?: Partial<HttpStreamContext<TAuth>>,
): HttpStreamContext<TAuth> {
  const streamEvent = (event: HttpStreamEvent): void => {
    try {
      writer(event);
    } catch {
      // Swallow errors in stream writer (connection may be closed)
    }
  };

  const streamText = (content: string): void => {
    streamEvent(createTextEvent(content));
  };

  // Create sendMessage that streams as message events
  const sendMessage = (message: Message): void => {
    try {
      const event = createMessageEvent(message.content, message.level);
      writer(event);
    } catch {
      // Swallow errors
    }
  };

  return {
    ...baseContext,
    sendMessage,
    streamEvent,
    streamText,
  };
}

// #endregion

// #region Async Generator Utilities

/**
 * Check if a value is an async iterable
 */
export function isAsyncIterable<T>(value: unknown): value is AsyncIterable<T> {
  return (
    value !== null && typeof value === "object" && Symbol.asyncIterator in value
  );
}

/**
 * Collect all events from an async iterable into an array
 * Useful for testing
 */
export async function collectStreamEvents(
  stream: AsyncIterable<HttpStreamEvent>,
): Promise<HttpStreamEvent[]> {
  const events: HttpStreamEvent[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  return events;
}

/**
 * Create an async generator that yields events and returns final data
 */
export async function* wrapServiceForStreaming<TOutput>(
  serviceResult: TOutput | AsyncIterable<HttpStreamEvent>,
): AsyncIterable<HttpStreamEvent> {
  // If result is already an async iterable, pass through
  if (isAsyncIterable<HttpStreamEvent>(serviceResult)) {
    yield* serviceResult;
    return;
  }

  // Otherwise, wrap single result as data event
  yield createDataEvent(serviceResult);
  yield createCompleteEvent();
}

// #endregion

// #region LLM Stream Integration

/**
 * LLM stream chunk types (matches @jaypie/llm LlmStreamChunkType)
 * Defined locally to avoid hard dependency on @jaypie/llm
 */
const LLM_CHUNK_TYPES = {
  Done: "done",
  Error: "error",
  Text: "text",
  ToolCall: "tool_call",
  ToolResult: "tool_result",
} as const;

/**
 * LLM stream chunk interface (compatible with @jaypie/llm LlmStreamChunk)
 * Defined locally to avoid hard dependency on @jaypie/llm
 */
export interface LlmStreamChunk {
  type: string;
  content?: string;
  error?: {
    detail?: string;
    status: number | string;
    title: string;
  };
  toolCall?: {
    arguments: string;
    id: string;
    name: string;
  };
  toolResult?: {
    id: string;
    name: string;
    result: unknown;
  };
  usage?: unknown;
}

/**
 * Options for piping LLM streams
 */
export interface PipeLlmStreamOptions {
  /** Include tool call and tool result events (default: false) */
  includeTools?: boolean;
}

/**
 * Convert an LLM stream chunk to HTTP stream event
 * Returns undefined for chunks that should be filtered out
 */
export function llmChunkToHttpEvent(
  chunk: LlmStreamChunk,
  options?: PipeLlmStreamOptions,
): HttpStreamEvent | undefined {
  const { includeTools = false } = options ?? {};

  switch (chunk.type) {
    case LLM_CHUNK_TYPES.Text:
      if (chunk.content !== undefined) {
        return createTextEvent(chunk.content);
      }
      return undefined;

    case LLM_CHUNK_TYPES.ToolCall:
      if (!includeTools) return undefined;
      if (chunk.toolCall) {
        return createToolCallEvent(chunk.toolCall);
      }
      return undefined;

    case LLM_CHUNK_TYPES.ToolResult:
      if (!includeTools) return undefined;
      if (chunk.toolResult) {
        return createToolResultEvent(chunk.toolResult);
      }
      return undefined;

    case LLM_CHUNK_TYPES.Error:
      if (chunk.error) {
        return createErrorEvent(chunk.error);
      }
      return undefined;

    case LLM_CHUNK_TYPES.Done:
      return createCompleteEvent();

    default:
      // Unknown chunk type - skip
      return undefined;
  }
}

/**
 * Pipe an LLM stream (from @jaypie/llm Llm.stream()) to HTTP stream events
 *
 * @example
 * ```typescript
 * import Llm from "@jaypie/llm";
 * import { pipeLlmStream } from "@jaypie/fabric/http";
 *
 * const llmStream = Llm.stream("Tell me a story");
 * for await (const event of pipeLlmStream(llmStream)) {
 *   yield event; // or writer(event)
 * }
 * ```
 */
export async function* pipeLlmStream(
  llmStream: AsyncIterable<LlmStreamChunk>,
  options?: PipeLlmStreamOptions,
): AsyncIterable<HttpStreamEvent> {
  for await (const chunk of llmStream) {
    const event = llmChunkToHttpEvent(chunk, options);
    if (event !== undefined) {
      yield event;
    }
  }
}

/**
 * Pipe an LLM stream to a stream writer function
 *
 * @example
 * ```typescript
 * import Llm from "@jaypie/llm";
 * import { pipeLlmStreamToWriter } from "@jaypie/fabric/http";
 *
 * const llmStream = Llm.stream("Tell me a story");
 * await pipeLlmStreamToWriter(llmStream, (event) => {
 *   res.write(formatSseEvent(event));
 * });
 * ```
 */
export async function pipeLlmStreamToWriter(
  llmStream: AsyncIterable<LlmStreamChunk>,
  writer: StreamWriter,
  options?: PipeLlmStreamOptions,
): Promise<void> {
  for await (const event of pipeLlmStream(llmStream, options)) {
    await writer(event);
  }
}

// #endregion
