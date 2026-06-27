import { JsonObject } from "@jaypie/types";

//
//
// Constants
//

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const SSE_DONE = "[DONE]";

//
//
// Types
//

export interface OpenRouterClientOptions {
  apiKey: string;
  baseURL?: string;
}

export interface ChatCompletionOptions {
  signal?: AbortSignal;
}

/**
 * HTTP error carrying the upstream status and parsed API message. The
 * OpenRouterAdapter classifies errors by reading `.status` / `.statusCode` and
 * `.message` / `.error.message`, so this shape keeps `classifyError`,
 * `isTemperatureDeprecationError`, and `isStructuredOutputUnsupportedError`
 * working unchanged after dropping the SDK.
 */
export class OpenRouterHttpError extends Error {
  readonly status: number;
  readonly statusCode: number;
  readonly error?: { message?: string };

  constructor(status: number, message: string, error?: { message?: string }) {
    super(message);
    this.name = "OpenRouterHttpError";
    this.status = status;
    this.statusCode = status;
    this.error = error;
  }
}

//
//
// Helpers
//

/**
 * Parse an OpenAI-style Server-Sent Events stream into decoded JSON chunks.
 * Buffers across network reads, dispatches on blank lines, and stops at the
 * `[DONE]` sentinel. Comment lines (`: ...`, used by OpenRouter for keep-alive)
 * are ignored.
 */
async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<JsonObject> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
        buffer = buffer.slice(newlineIndex + 1);

        if (line === "" || line.startsWith(":")) continue;
        if (!line.startsWith("data:")) continue;

        const data = line.slice("data:".length).trim();
        if (data === SSE_DONE) return;

        yield JSON.parse(data) as JsonObject;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Normalize the snake_case wire response into the camelCase shape the adapter
 * readers expect (the SDK previously returned camelCase). Only protocol fields
 * are touched — user content (schema property names, tool argument JSON) is
 * left untouched.
 */
function normalizeResponse(json: JsonObject): JsonObject {
  const choices = json.choices as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      if (
        choice.finish_reason !== undefined &&
        choice.finishReason === undefined
      ) {
        choice.finishReason = choice.finish_reason;
      }
      const message = choice.message as Record<string, unknown> | undefined;
      if (
        message?.tool_calls !== undefined &&
        message.toolCalls === undefined
      ) {
        message.toolCalls = message.tool_calls;
      }
    }
  }

  const usage = json.usage as Record<string, unknown> | undefined;
  if (usage) {
    if (usage.promptTokens === undefined)
      usage.promptTokens = usage.prompt_tokens;
    if (usage.completionTokens === undefined) {
      usage.completionTokens = usage.completion_tokens;
    }
    if (usage.totalTokens === undefined) usage.totalTokens = usage.total_tokens;
    const details = usage.completion_tokens_details as
      | { reasoning_tokens?: number }
      | undefined;
    if (
      details?.reasoning_tokens !== undefined &&
      !usage.completionTokensDetails
    ) {
      usage.completionTokensDetails = {
        reasoningTokens: details.reasoning_tokens,
      };
    }
  }

  return json;
}

//
//
// Main
//

/**
 * Minimal `fetch`-based client for OpenRouter's OpenAI-compatible Chat
 * Completions endpoint. Replaces `@openrouter/sdk` — the adapter only needs a
 * single POST (streaming and non-streaming), header auth, and HTTP error
 * surfacing.
 */
export class OpenRouterClient {
  private readonly apiKey: string;
  private readonly baseURL: string;

  constructor({
    apiKey,
    baseURL = OPENROUTER_BASE_URL,
  }: OpenRouterClientOptions) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  private async toError(response: Response): Promise<OpenRouterHttpError> {
    let message = `OpenRouter request failed with status ${response.status}`;
    let error: { message?: string } | undefined;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body?.error?.message) {
        message = body.error.message;
        error = body.error;
      }
    } catch {
      // Non-JSON error body; keep the status-based message.
    }
    return new OpenRouterHttpError(response.status, message, error);
  }

  async chatCompletion(
    body: Record<string, unknown>,
    { signal }: ChatCompletionOptions = {},
  ): Promise<JsonObject> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) throw await this.toError(response);

    const json = (await response.json()) as JsonObject;
    return normalizeResponse(json);
  }

  async *streamChatCompletion(
    body: Record<string, unknown>,
    { signal }: ChatCompletionOptions = {},
  ): AsyncIterable<JsonObject> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: { ...this.headers(), Accept: "text/event-stream" },
      // OpenAI-style streams only include usage when explicitly requested.
      body: JSON.stringify({
        ...body,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal,
    });

    if (!response.ok) throw await this.toError(response);
    if (!response.body) return;

    yield* parseSseStream(response.body);
  }
}
