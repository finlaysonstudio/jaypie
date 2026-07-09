import { JsonObject } from "@jaypie/types";

import { parseSseStream } from "../../util/sse.js";

//
//
// Constants
//

const OPENAI_BASE_URL = "https://api.openai.com/v1";

//
//
// Errors
//
// The adapter's `classifyError` uses `instanceof` against these classes, so the
// client throws them directly. Status → class mapping mirrors the SDK; the
// non-HTTP classes (connection/abort) are thrown when `fetch` itself rejects.
//

export class OpenAiApiError extends Error {
  readonly status: number;
  readonly error?: { message?: string };

  constructor(status: number, message: string, error?: { message?: string }) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.error = error;
  }
}

export class BadRequestError extends OpenAiApiError {}
export class AuthenticationError extends OpenAiApiError {}
export class PermissionDeniedError extends OpenAiApiError {}
export class NotFoundError extends OpenAiApiError {}
export class ConflictError extends OpenAiApiError {}
export class UnprocessableEntityError extends OpenAiApiError {}
export class RateLimitError extends OpenAiApiError {}
export class InternalServerError extends OpenAiApiError {}
export class APIConnectionError extends OpenAiApiError {}
export class APIConnectionTimeoutError extends APIConnectionError {}
export class APIUserAbortError extends OpenAiApiError {}

function errorForStatus(
  status: number,
  message: string,
  error?: { message?: string },
): OpenAiApiError {
  if (status === 400) return new BadRequestError(status, message, error);
  if (status === 401) return new AuthenticationError(status, message, error);
  if (status === 403) return new PermissionDeniedError(status, message, error);
  if (status === 404) return new NotFoundError(status, message, error);
  if (status === 409) return new ConflictError(status, message, error);
  if (status === 422) {
    return new UnprocessableEntityError(status, message, error);
  }
  if (status === 429) return new RateLimitError(status, message, error);
  if (status >= 500) return new InternalServerError(status, message, error);
  return new OpenAiApiError(status, message, error);
}

//
//
// Types
//

export interface OpenAIClientOptions {
  apiKey: string;
  baseURL?: string;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

interface ResponsesApi {
  create(
    params: Record<string, unknown> & { stream: true },
    options?: RequestOptions,
  ): Promise<AsyncIterable<Record<string, unknown>>>;
  create(
    params: Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<JsonObject>;
}

interface ChatCompletionsApi {
  create(
    params: Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<JsonObject>;
  parse(
    params: Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<JsonObject>;
}

//
//
// Main
//

/**
 * Minimal `fetch`-based client for the OpenAI API. Replaces the `openai` SDK —
 * the adapters and provider utilities only need the Responses API
 * (`/responses`, streaming and non-streaming) for `operate`/`stream` and the
 * Chat Completions API (`/chat/completions`, plus a `parse` helper for
 * structured output) for `send`. Mirrors the SDK's `responses.create` and
 * `chat.completions.create` / `chat.completions.parse` surface so call sites are
 * unchanged. Also serves xAI via a custom `baseURL`.
 */
export class OpenAIClient {
  private readonly apiKey: string;
  private readonly baseURL: string;
  readonly responses: ResponsesApi;
  readonly chat: { completions: ChatCompletionsApi };

  constructor({ apiKey, baseURL = OPENAI_BASE_URL }: OpenAIClientOptions) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.responses = {
      create: ((params: Record<string, unknown>, options?: RequestOptions) =>
        params.stream
          ? this.createResponseStream(params, options)
          : this.createResponse(params, options)) as ResponsesApi["create"],
    };
    this.chat = {
      completions: {
        create: (params, options) =>
          this.chatCompletion(params, options, { parse: false }),
        parse: (params, options) =>
          this.chatCompletion(params, options, { parse: true }),
      },
    };
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  private async post(
    path: string,
    body: Record<string, unknown>,
    { signal }: RequestOptions = {},
    { stream = false }: { stream?: boolean } = {},
  ): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(`${this.baseURL}${path}`, {
        method: "POST",
        headers: this.headers(
          stream ? { Accept: "text/event-stream" } : undefined,
        ),
        body: JSON.stringify(body),
        signal,
      });
    } catch (cause) {
      if (signal?.aborted) {
        throw new APIUserAbortError(0, "Request was aborted");
      }
      const message =
        cause instanceof Error ? cause.message : "Connection error";
      const error = new APIConnectionError(0, message);
      (error as { cause?: unknown }).cause = cause;
      throw error;
    }
    if (!response.ok) throw await this.toError(response);
    return response;
  }

  private async toError(response: Response): Promise<OpenAiApiError> {
    let message = `OpenAI request failed with status ${response.status}`;
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
    return errorForStatus(response.status, message, error);
  }

  private async createResponse(
    params: Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<JsonObject> {
    const response = await this.post("/responses", params, options);
    return (await response.json()) as JsonObject;
  }

  private async createResponseStream(
    params: Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<AsyncIterable<Record<string, unknown>>> {
    const response = await this.post("/responses", params, options, {
      stream: true,
    });
    if (!response.body) return (async function* () {})();
    // The Responses API streams typed events and does not emit a `[DONE]`
    // sentinel; the empty default sentinel never matches, so the stream ends
    // when the connection closes.
    return parseSseStream(response.body);
  }

  private async chatCompletion(
    params: Record<string, unknown>,
    options: RequestOptions | undefined,
    { parse }: { parse: boolean },
  ): Promise<JsonObject> {
    const response = await this.post("/chat/completions", params, options);
    const json = (await response.json()) as JsonObject;
    // `chat.completions.parse` surfaces parsed JSON on each message; replicate
    // the SDK by JSON-parsing the assistant content into `message.parsed`.
    if (parse) {
      const choices = json.choices as
        Array<Record<string, unknown>> | undefined;
      if (Array.isArray(choices)) {
        for (const choice of choices) {
          const message = choice.message as Record<string, unknown> | undefined;
          if (
            message &&
            typeof message.content === "string" &&
            !message.refusal
          ) {
            try {
              message.parsed = JSON.parse(message.content);
            } catch {
              message.parsed = null;
            }
          }
        }
      }
    }
    return json;
  }
}
