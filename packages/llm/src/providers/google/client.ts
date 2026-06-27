import { JsonObject } from "@jaypie/types";

import { parseSseStream } from "../../util/sse.js";
import {
  GeminiContent,
  GeminiGenerateContentConfig,
  GeminiRawResponse,
} from "./types.js";

//
//
// Constants
//

const GOOGLE_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// Config keys the REST API expects at the top level of the request body. Every
// other key in the SDK-style `config` object belongs under `generationConfig`.
const TOP_LEVEL_CONFIG_KEYS = new Set([
  "systemInstruction",
  "tools",
  "toolConfig",
  "safetySettings",
  "cachedContent",
]);

//
//
// Types
//

export interface GoogleClientOptions {
  apiKey: string;
  baseURL?: string;
}

export interface GenerateContentParams {
  model: string;
  contents: GeminiContent[];
  config?: GeminiGenerateContentConfig;
}

export interface GenerateContentOptions {
  signal?: AbortSignal;
}

/**
 * HTTP error carrying the upstream status and parsed API message. The
 * GoogleAdapter classifies errors by reading `.status` / `.code` and
 * `.message`, so this shape keeps `classifyError` working unchanged after
 * dropping the SDK.
 */
export class GoogleHttpError extends Error {
  readonly status: number;
  readonly code: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GoogleHttpError";
    this.status = status;
    this.code = status;
  }
}

//
//
// Helpers
//

/**
 * Translate the SDK-style `{ model, contents, config }` request into the REST
 * `generateContent` body. `systemInstruction` (a string) becomes a Content;
 * top-level config keys pass through; all remaining config keys (temperature,
 * responseMimeType, responseSchema, responseJsonSchema, ...) move under
 * `generationConfig`.
 */
function toRestBody(params: GenerateContentParams): JsonObject {
  const body: JsonObject = {
    contents: params.contents as unknown as JsonObject[],
  };
  const config = params.config;
  if (!config) return body;

  const generationConfig: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined) continue;
    if (key === "systemInstruction") {
      body.systemInstruction =
        typeof value === "string"
          ? { parts: [{ text: value }] }
          : (value as JsonObject);
    } else if (TOP_LEVEL_CONFIG_KEYS.has(key)) {
      body[key] = value as JsonObject;
    } else {
      generationConfig[key] = value;
    }
  }
  if (Object.keys(generationConfig).length > 0) {
    body.generationConfig = generationConfig as JsonObject;
  }
  return body;
}

/**
 * Concatenate the non-thought text parts of the first candidate, matching the
 * SDK's `response.text` convenience getter (consumed by `GoogleProvider.send`).
 */
function responseText(response: GeminiRawResponse): string | undefined {
  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) return undefined;
  const text = parts
    .filter((part) => part.text && !part.thought)
    .map((part) => part.text)
    .join("");
  return text.length > 0 ? text : undefined;
}

//
//
// Main
//

/**
 * Minimal `fetch`-based client for Google's Generative Language (Gemini) REST
 * API. Replaces `@google/genai` — the adapter only needs `generateContent`
 * (streaming and non-streaming), an api-key header, and HTTP error surfacing.
 * Exposes a `models` facade mirroring the SDK so the adapter call sites are
 * unchanged.
 */
export class GoogleClient {
  private readonly apiKey: string;
  private readonly baseURL: string;
  readonly models: {
    generateContent: (
      params: GenerateContentParams,
      options?: GenerateContentOptions,
    ) => Promise<GeminiRawResponse>;
    generateContentStream: (
      params: GenerateContentParams,
      options?: GenerateContentOptions,
    ) => Promise<AsyncIterable<GeminiRawResponse>>;
  };

  constructor({ apiKey, baseURL = GOOGLE_BASE_URL }: GoogleClientOptions) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.models = {
      generateContent: (params, options) =>
        this.generateContent(params, options),
      generateContentStream: (params, options) =>
        this.generateContentStream(params, options),
    };
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-goog-api-key": this.apiKey,
    };
  }

  private async toError(response: Response): Promise<GoogleHttpError> {
    let message = `Google request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body?.error?.message) message = body.error.message;
    } catch {
      // Non-JSON error body; keep the status-based message.
    }
    return new GoogleHttpError(response.status, message);
  }

  private async generateContent(
    params: GenerateContentParams,
    { signal }: GenerateContentOptions = {},
  ): Promise<GeminiRawResponse> {
    const url = `${this.baseURL}/models/${params.model}:generateContent`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(toRestBody(params)),
      signal,
    });

    if (!response.ok) throw await this.toError(response);

    const json = (await response.json()) as GeminiRawResponse;
    json.text = responseText(json);
    return json;
  }

  private async generateContentStream(
    params: GenerateContentParams,
    { signal }: GenerateContentOptions = {},
  ): Promise<AsyncIterable<GeminiRawResponse>> {
    const url = `${this.baseURL}/models/${params.model}:streamGenerateContent?alt=sse`;
    const response = await fetch(url, {
      method: "POST",
      headers: { ...this.headers(), Accept: "text/event-stream" },
      body: JSON.stringify(toRestBody(params)),
      signal,
    });

    if (!response.ok) throw await this.toError(response);
    if (!response.body) return (async function* () {})();

    return parseSseStream(response.body) as AsyncIterable<GeminiRawResponse>;
  }
}
