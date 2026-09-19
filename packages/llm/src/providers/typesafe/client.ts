import { JsonObject } from "@jaypie/types";

import { PROVIDER } from "../../constants.js";
import {
  LlmRateLimitError,
  LlmTransientError,
  LlmUnrecoverableError,
} from "../../errors/LlmError.js";
import { LlmAnswer, LlmQuestions } from "../../types/LlmQuestion.interface.js";

//
//
// Constants
//

const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_OVERLOADED = 529;
const HTTP_SERVER_ERROR = 500;
const MILLISECONDS_PER_SECOND = 1000;

//
//
// Types
//

export interface TypeSafeModel {
  description: string;
  name: string;
  release_date: string;
}

export interface TypeSafeModelsResponse {
  models: TypeSafeModel[];
}

export interface TypeSafeSystemOneRequest {
  model: string;
  questions: LlmQuestions;
  state: unknown;
}

export interface TypeSafeSystemOneResponse {
  answers: Record<string, LlmAnswer>;
  /** The versioned id that served the request, e.g. "jev-1.13.0" */
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

//
//
// Helpers
//

function retryAfterMs(headers: Headers): number | undefined {
  const header = headers.get("retry-after");
  if (!header) {
    return undefined;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return seconds * MILLISECONDS_PER_SECOND;
  }
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

/** Pull the most specific message the API offers out of an error body. */
function errorMessage(status: number, body: string): string {
  let detail = body.trim();
  try {
    const parsed = JSON.parse(body) as JsonObject;
    const candidate = parsed.detail ?? parsed.message ?? parsed.error;
    if (typeof candidate === "string") {
      detail = candidate;
    } else if (candidate !== undefined) {
      detail = JSON.stringify(candidate);
    }
  } catch {
    // Not JSON; the raw body is the best available detail
  }
  return detail
    ? `TypeSafe request failed (${status}): ${detail}`
    : `TypeSafe request failed (${status})`;
}

//
//
// Main
//

/**
 * Minimal client for TypeSafe's two documented routes. The published SDK is
 * early (0.6.0) and wraps the same two calls, so the dependency is not taken.
 */
export class TypeSafeClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor({
    apiKey,
    baseUrl = PROVIDER.TYPESAFE.BASE_URL,
  }: {
    apiKey: string;
    baseUrl?: string;
  }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request<T>({
    body,
    method = "GET",
    path,
    signal,
  }: {
    body?: unknown;
    method?: string;
    path: string;
    signal?: AbortSignal;
  }): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      method,
      signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const message = errorMessage(response.status, text);
      const options = {
        provider: PROVIDER.TYPESAFE.NAME,
        retryAfterMs: retryAfterMs(response.headers),
      };
      if (
        response.status === HTTP_TOO_MANY_REQUESTS ||
        response.status === HTTP_OVERLOADED
      ) {
        throw new LlmRateLimitError(message, options);
      }
      if (response.status >= HTTP_SERVER_ERROR) {
        throw new LlmTransientError(message, options);
      }
      throw new LlmUnrecoverableError(message, options);
    }

    return (await response.json()) as T;
  }

  async listModels(): Promise<TypeSafeModelsResponse> {
    return this.request<TypeSafeModelsResponse>({ path: "/models" });
  }

  async systemOne(
    body: TypeSafeSystemOneRequest,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<TypeSafeSystemOneResponse> {
    return this.request<TypeSafeSystemOneResponse>({
      body,
      method: "POST",
      path: "/systemone",
      signal,
    });
  }
}
