/**
 * JaypieStream provides SSE (Server-Sent Events) streaming utilities
 * for Lambda and Express handlers.
 */

//
//
// Types
//

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
export interface SSEEvent {
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
export function formatSSE(chunk: StreamChunk): string {
  const event = chunk.type;
  const data = JSON.stringify(chunk);
  return `event: ${event}\ndata: ${data}\n\n`;
}

/**
 * Create an async generator that yields SSE-formatted strings from stream chunks
 */
export async function* streamToSSE(
  stream: AsyncIterable<StreamChunk>,
): AsyncIterable<string> {
  for await (const chunk of stream) {
    yield formatSSE(chunk);
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
      const sseData = formatSSE(chunk);
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
      const sseData = formatSSE(chunk);
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
  toSSE(): AsyncIterable<string> {
    return streamToSSE(this.source);
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
