import { parseSseStream } from "../../util/sse.js";
import { Anthropic } from "./types.js";

//
//
// Constants
//

const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";

const ANTHROPIC_VERSION = "2023-06-01";

//
//
// Errors
//
// The adapter's `classifyError` keys off `error.constructor.name` (the SDK's
// class names), so the client throws errors whose class names match. Status →
// class mapping mirrors the SDK.
//

export class AnthropicApiError extends Error {
  readonly status: number;
  readonly error?: { message?: string };

  constructor(status: number, message: string, error?: { message?: string }) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.error = error;
  }
}

export class BadRequestError extends AnthropicApiError {}
export class AuthenticationError extends AnthropicApiError {}
export class PermissionDeniedError extends AnthropicApiError {}
export class NotFoundError extends AnthropicApiError {}
export class RateLimitError extends AnthropicApiError {}
export class InternalServerError extends AnthropicApiError {}
export class APIConnectionError extends AnthropicApiError {}

function errorForStatus(
  status: number,
  message: string,
  error?: { message?: string },
): AnthropicApiError {
  if (status === 400) return new BadRequestError(status, message, error);
  if (status === 401) return new AuthenticationError(status, message, error);
  if (status === 403) return new PermissionDeniedError(status, message, error);
  if (status === 404) return new NotFoundError(status, message, error);
  if (status === 429) return new RateLimitError(status, message, error);
  if (status >= 500) return new InternalServerError(status, message, error);
  return new AnthropicApiError(status, message, error);
}

//
//
// Types
//

export interface AnthropicClientOptions {
  apiKey: string;
  baseURL?: string;
}

export interface CreateOptions {
  signal?: AbortSignal;
}

interface MessagesApi {
  create(
    params: Anthropic.MessageCreateParamsStreaming,
    options?: CreateOptions,
  ): Promise<AsyncIterable<Anthropic.MessageStreamEvent>>;
  create(
    params: Anthropic.MessageCreateParams,
    options?: CreateOptions,
  ): Promise<Anthropic.Message>;
}

//
//
// Main
//

/**
 * Minimal `fetch`-based client for Anthropic's Messages API. Replaces
 * `@anthropic-ai/sdk` — the adapter only needs `messages.create` (streaming and
 * non-streaming), header auth, and HTTP errors whose class names drive
 * `classifyError`. Internal request params are already Anthropic's wire shape,
 * so they serialize verbatim. Exposes a `messages` facade mirroring the SDK so
 * the adapter call sites are unchanged.
 */
export class AnthropicClient {
  private readonly apiKey: string;
  private readonly baseURL: string;
  readonly messages: MessagesApi;

  constructor({
    apiKey,
    baseURL = ANTHROPIC_BASE_URL,
  }: AnthropicClientOptions) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.messages = {
      create: ((
        params: Anthropic.MessageCreateParams,
        options?: CreateOptions,
      ) =>
        params.stream
          ? this.createStream(params, options)
          : this.createMessage(params, options)) as MessagesApi["create"],
    };
  }

  private headers(): Record<string, string> {
    return {
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
      "x-api-key": this.apiKey,
    };
  }

  private async toError(response: Response): Promise<AnthropicApiError> {
    let message = `Anthropic request failed with status ${response.status}`;
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

  private async createMessage(
    params: Anthropic.MessageCreateParams,
    { signal }: CreateOptions = {},
  ): Promise<Anthropic.Message> {
    const response = await fetch(`${this.baseURL}/messages`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(params),
      signal,
    });

    if (!response.ok) throw await this.toError(response);
    return (await response.json()) as Anthropic.Message;
  }

  private async createStream(
    params: Anthropic.MessageCreateParams,
    { signal }: CreateOptions = {},
  ): Promise<AsyncIterable<Anthropic.MessageStreamEvent>> {
    const response = await fetch(`${this.baseURL}/messages`, {
      method: "POST",
      headers: { ...this.headers(), accept: "text/event-stream" },
      body: JSON.stringify(params),
      signal,
    });

    if (!response.ok) throw await this.toError(response);
    if (!response.body) return (async function* () {})();

    return parseSseStream(
      response.body,
    ) as AsyncIterable<Anthropic.MessageStreamEvent>;
  }
}
