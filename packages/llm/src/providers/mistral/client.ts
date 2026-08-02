import { JsonObject } from "@jaypie/types";

import { PROVIDER } from "../../constants.js";
import { parseSseStream } from "../../util/sse.js";

//
//
// Types
//

export interface MistralClientOptions {
  apiKey: string;
  baseURL?: string;
}

export interface ChatCompletionOptions {
  signal?: AbortSignal;
}

export interface OcrRequest {
  /** Document reference, e.g. `{ type: "document_url", document_url: "data:application/pdf;base64,..." }` */
  document: JsonObject;
  model?: string;
  pages?: number[];
}

/**
 * A single field-level validation failure from Mistral's 422 schema check.
 */
interface MistralErrorDetail {
  loc?: (string | number)[];
  msg?: string;
  type?: string;
}

/**
 * HTTP error carrying the upstream status and parsed API message. The
 * MistralAdapter classifies errors by reading `.status` / `.statusCode`,
 * `.message`, and Mistral's own `.type` / `.code` discriminators.
 *
 * Mistral's envelope is flat — `{ object, message, type, param, code,
 * raw_status_code }` — not OpenAI's `{ error: { message } }`.
 */
export class MistralHttpError extends Error {
  readonly status: number;
  readonly statusCode: number;
  readonly code?: string;
  readonly type?: string;
  readonly error?: { message?: string };

  constructor(
    status: number,
    message: string,
    { code, type }: { code?: string; type?: string } = {},
  ) {
    super(message);
    this.name = "MistralHttpError";
    this.status = status;
    this.statusCode = status;
    this.code = code;
    this.type = type;
    // Mirrored for the shared classifyProviderError pass, which reads
    // `.error.message` across providers.
    this.error = { message };
  }
}

//
//
// Helpers
//

/**
 * Render Mistral's polymorphic `message` field as a string.
 *
 * Model-level errors send a plain string ("reasoning_effort is not enabled for
 * this model"), while schema validation sends an object of field-level
 * failures (`{ detail: [{ loc, msg, type }] }`). Stringifying the latter
 * blindly yields "[object Object]" and loses the field names that make a 422
 * actionable, so each detail is rendered as `body.field: message`.
 */
function renderErrorMessage(message: unknown, status: number): string {
  if (typeof message === "string" && message) return message;

  if (message && typeof message === "object") {
    const detail = (message as { detail?: MistralErrorDetail[] }).detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const parts = detail.map((item) => {
        const location = Array.isArray(item.loc) ? item.loc.join(".") : "";
        const text = item.msg ?? item.type ?? "invalid";
        return location ? `${location}: ${text}` : text;
      });
      return parts.join("; ");
    }
    try {
      return JSON.stringify(message);
    } catch {
      // Fall through to the status-based message
    }
  }

  return `Mistral request failed with status ${status}`;
}

/**
 * Normalize the snake_case wire response into the camelCase shape the adapter
 * readers expect. Only protocol fields are touched — user content (schema
 * property names, tool argument JSON) is left untouched, and `message.content`
 * is deliberately left alone because Mistral returns it as either a string or
 * an array of chunks depending on `reasoning_effort`.
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
    if (usage.promptTokens === undefined) {
      usage.promptTokens = usage.prompt_tokens;
    }
    if (usage.completionTokens === undefined) {
      usage.completionTokens = usage.completion_tokens;
    }
    if (usage.totalTokens === undefined) usage.totalTokens = usage.total_tokens;
    const details = usage.prompt_tokens_details as
      { cached_tokens?: number } | undefined;
    if (details?.cached_tokens !== undefined && !usage.promptTokensDetails) {
      usage.promptTokensDetails = { cachedTokens: details.cached_tokens };
    }
  }

  return json;
}

//
//
// Main
//

/**
 * Minimal `fetch`-based client for Mistral's OpenAI-compatible Chat
 * Completions endpoint, plus the OCR endpoint.
 *
 * Mistral validates the request body strictly: any field outside its schema is
 * rejected with a 422 `extra_forbidden`, so the adapter must not forward
 * OpenAI-only fields (`user`, `seed`, and friends).
 */
export class MistralClient {
  private readonly apiKey: string;
  private readonly baseURL: string;

  constructor({
    apiKey,
    baseURL = PROVIDER.MISTRAL.BASE_URL,
  }: MistralClientOptions) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  private async toError(response: Response): Promise<MistralHttpError> {
    let message = `Mistral request failed with status ${response.status}`;
    let code: string | undefined;
    let type: string | undefined;
    try {
      const body = (await response.json()) as {
        code?: string | null;
        error?: { message?: string };
        message?: unknown;
        type?: string;
      };
      if (body?.message !== undefined) {
        message = renderErrorMessage(body.message, response.status);
      } else if (body?.error?.message) {
        message = body.error.message;
      }
      code = body?.code ?? undefined;
      type = body?.type;
    } catch {
      // Non-JSON error body; keep the status-based message.
    }
    return new MistralHttpError(response.status, message, { code, type });
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

  /**
   * Extract a document via Mistral's OCR endpoint. Returns per-page markdown
   * alongside block geometry; this is a document-processing route, not a chat
   * completion, so it does not pass through the operate loop.
   */
  async ocr(
    { document, model = PROVIDER.MISTRAL.OCR, pages }: OcrRequest,
    { signal }: ChatCompletionOptions = {},
  ): Promise<JsonObject> {
    const response = await fetch(`${this.baseURL}/ocr`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        document,
        model,
        ...(pages ? { pages } : {}),
      }),
      signal,
    });

    if (!response.ok) throw await this.toError(response);

    return (await response.json()) as JsonObject;
  }
}
