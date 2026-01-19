/**
 * JaypieStream provides SSE (Server-Sent Events) and NLJSON streaming utilities
 * for Lambda and Express handlers.
 */

//
//
// Types
//

/**
 * Stream output format
 * - "sse": Server-Sent Events format (default)
 * - "nljson": Newline-delimited JSON format
 */
export type StreamFormat = "nljson" | "sse";

/**
 * Generic stream chunk interface compatible with LLM streaming
 */
export interface StreamChunk {
  type: string;
  [key: string]: unknown;
}

/**
 * SSE event structure
 */
export interface SseEvent {
  data: string;
  event?: string;
  id?: string;
}

/**
 * Stream writer interface for Lambda Response Streaming
 */
export interface LambdaStreamWriter {
  write(chunk: string | Uint8Array): void;
  end(): void;
}

/**
 * Express response with streaming capability
 */
export interface ExpressStreamResponse {
  setHeader(name: string, value: string): void;
  write(chunk: string | Uint8Array): boolean;
  end(): void;
  flushHeaders(): void;
}

//
//
// Helpers
//

/**
 * Format a chunk as an SSE event
 */
export function formatSse(chunk: StreamChunk): string {
  const event = chunk.type;
  const data = JSON.stringify(chunk);
  return `event: ${event}\ndata: ${data}\n\n`;
}

/**
 * Format a chunk as NLJSON (newline-delimited JSON)
 */
export function formatNljson(
  chunk: StreamChunk | Record<string, unknown>,
): string {
  return JSON.stringify(chunk) + "\n";
}

/**
 * Error body interface for Jaypie errors
 */
interface JaypieErrorBody {
  error?: unknown;
  [key: string]: unknown;
}

/**
 * Format an error as an SSE error event
 */
export function formatStreamErrorSse(errorBody: JaypieErrorBody): string {
  return `event: error\ndata: ${JSON.stringify(errorBody)}\n\n`;
}

/**
 * Format an error as NLJSON
 */
export function formatStreamErrorNljson(errorBody: JaypieErrorBody): string {
  return JSON.stringify({ error: errorBody }) + "\n";
}

/**
 * Format an error based on the stream format
 */
export function formatStreamError(
  errorBody: JaypieErrorBody,
  format: StreamFormat = "sse",
): string {
  if (format === "nljson") {
    return formatStreamErrorNljson(errorBody);
  }
  return formatStreamErrorSse(errorBody);
}

/**
 * Get the content type for a stream format
 */
export function getContentTypeForFormat(format: StreamFormat): string {
  if (format === "nljson") {
    return "application/x-ndjson";
  }
  return "text/event-stream";
}

/**
 * Create an async generator that yields SSE-formatted strings from stream chunks
 */
export async function* streamToSse(
  stream: AsyncIterable<StreamChunk>,
): AsyncIterable<string> {
  for await (const chunk of stream) {
    yield formatSse(chunk);
  }
}

//
//
// Lambda Streaming
//

/**
 * Create a Lambda stream response from an async iterable of chunks.
 * Use this with AWS Lambda Response Streaming (awslambda.streamifyResponse).
 *
 * @example
 * ```ts
 * export const handler = awslambda.streamifyResponse(async (event, responseStream, context) => {
 *   const llmStream = llm.stream("Hello");
 *   await createLambdaStream(llmStream, responseStream);
 * });
 * ```
 */
export async function createLambdaStream(
  stream: AsyncIterable<StreamChunk>,
  writer: LambdaStreamWriter,
): Promise<void> {
  try {
    for await (const chunk of stream) {
      const sseData = formatSse(chunk);
      writer.write(sseData);
    }
  } finally {
    writer.end();
  }
}

//
//
// Express Streaming
//

/**
 * Create an Express stream response from an async iterable of chunks.
 * Sets appropriate headers for SSE and streams chunks to the response.
 *
 * @example
 * ```ts
 * app.get('/stream', async (req, res) => {
 *   const llmStream = llm.stream("Hello");
 *   await createExpressStream(llmStream, res);
 * });
 * ```
 */
export async function createExpressStream(
  stream: AsyncIterable<StreamChunk>,
  res: ExpressStreamResponse,
): Promise<void> {
  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
  res.flushHeaders();

  try {
    for await (const chunk of stream) {
      const sseData = formatSse(chunk);
      res.write(sseData);
    }
  } finally {
    res.end();
  }
}

//
//
// JaypieStream Class
//

/**
 * JaypieStream wraps an async iterable of stream chunks and provides
 * methods to pipe to different output targets (Lambda, Express, etc.)
 */
export class JaypieStream {
  private readonly source: AsyncIterable<StreamChunk>;

  constructor(source: AsyncIterable<StreamChunk>) {
    this.source = source;
  }

  /**
   * Pipe to a Lambda response stream writer
   */
  async toLambda(writer: LambdaStreamWriter): Promise<void> {
    return createLambdaStream(this.source, writer);
  }

  /**
   * Pipe to an Express response
   */
  async toExpress(res: ExpressStreamResponse): Promise<void> {
    return createExpressStream(this.source, res);
  }

  /**
   * Get the underlying async iterable
   */
  [Symbol.asyncIterator](): AsyncIterator<StreamChunk> {
    return this.source[Symbol.asyncIterator]();
  }

  /**
   * Convert to SSE-formatted strings
   */
  toSse(): AsyncIterable<string> {
    return streamToSse(this.source);
  }
}

/**
 * Create a JaypieStream from an async iterable
 */
export function createJaypieStream(
  source: AsyncIterable<StreamChunk>,
): JaypieStream {
  return new JaypieStream(source);
}
