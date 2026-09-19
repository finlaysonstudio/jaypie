import { JsonObject } from "@jaypie/types";

import { PROVIDER } from "../../constants.js";
import {
  LlmRateLimitError,
  LlmTransientError,
  LlmUnrecoverableError,
} from "../../errors/LlmError.js";

//
//
// Constants
//

const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR = 500;
const MILLISECONDS_PER_SECOND = 1000;

//
//
// Types
//

export type LlamaCloudParseStatus =
  "CANCELLED" | "COMPLETED" | "FAILED" | "PENDING" | "RUNNING";

export type LlamaCloudParseTier =
  "agentic" | "agentic_plus" | "cost_effective" | "fast";

/** `ParseRequestConfiguration`; every field but `tier` and `version` is optional */
export interface LlamaCloudParseConfiguration {
  agentic_options?: JsonObject;
  disable_cache?: boolean;
  file_id?: string;
  output_options?: JsonObject;
  page_ranges?: { max_pages?: number; target_pages?: string };
  processing_options?: JsonObject;
  source_url?: string;
  tier: LlamaCloudParseTier | string;
  version: string;
  [key: string]: unknown;
}

export interface LlamaCloudParseJob {
  error_message?: string | null;
  id: string;
  status: LlamaCloudParseStatus;
  tier?: string | null;
  /** Present only with `expand=usage`; `credits` is null until billing records it */
  usage?: { credits?: number | null } | null;
  [key: string]: unknown;
}

export interface LlamaCloudMarkdownPage {
  footer?: string | null;
  header?: string | null;
  markdown: string;
  page_number: number;
  success: true;
  [key: string]: unknown;
}

export interface LlamaCloudFailedPage {
  error: string;
  page_number: number;
  success: false;
}

export interface LlamaCloudTextPage {
  page_number: number;
  text: string;
  [key: string]: unknown;
}

export interface LlamaCloudImageMetadata {
  content_type?: string | null;
  filename: string;
  index: number;
  presigned_url?: string | null;
  [key: string]: unknown;
}

/** `ParseResultResponse`; result blocks appear only when named in `expand` */
export interface LlamaCloudParseResult {
  images_content_metadata?: {
    images: LlamaCloudImageMetadata[];
    total_count: number;
  } | null;
  job: LlamaCloudParseJob;
  markdown?: {
    pages: Array<LlamaCloudMarkdownPage | LlamaCloudFailedPage>;
  } | null;
  markdown_full?: string | null;
  text?: { pages: LlamaCloudTextPage[] } | null;
  [key: string]: unknown;
}

export interface LlamaCloudRequestOptions {
  signal?: AbortSignal;
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

/**
 * Pull the most specific message the API offers out of an error body.
 * FastAPI validation failures arrive as `{ detail: [{ loc, msg }] }`; each is
 * rendered `body.field: message` so a rejected configuration names the field.
 */
function errorMessage(status: number, body: string): string {
  let detail = body.trim();
  try {
    const parsed = JSON.parse(body) as JsonObject;
    const candidate = parsed.detail ?? parsed.message ?? parsed.error;
    if (typeof candidate === "string") {
      detail = candidate;
    } else if (Array.isArray(candidate)) {
      detail = candidate
        .map((item) => {
          const entry = item as { loc?: unknown[]; msg?: string };
          const location = Array.isArray(entry.loc) ? entry.loc.join(".") : "";
          const text = entry.msg ?? JSON.stringify(item);
          return location ? `${location}: ${text}` : text;
        })
        .join("; ");
    } else if (candidate !== undefined) {
      detail = JSON.stringify(candidate);
    }
  } catch {
    // Not JSON; the raw body is the best available detail
  }
  return detail
    ? `LlamaCloud request failed (${status}): ${detail}`
    : `LlamaCloud request failed (${status})`;
}

//
//
// Main
//

/**
 * Minimal `fetch` client for the LlamaCloud Parse API v2: submit by URL,
 * submit by upload, poll a job, and download an extracted image. The
 * published `llama-cloud-services` SDK wraps the same routes and is not
 * taken, matching the other first-class providers.
 */
export class LlamaCloudClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor({
    apiKey,
    baseUrl = PROVIDER.LLAMACLOUD.BASE_URL,
  }: {
    apiKey: string;
    baseUrl?: string;
  }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async throwFor(response: Response): Promise<never> {
    const text = await response.text().catch(() => "");
    const message = errorMessage(response.status, text);
    const options = {
      provider: PROVIDER.LLAMACLOUD.NAME,
      retryAfterMs: retryAfterMs(response.headers),
    };
    if (response.status === HTTP_TOO_MANY_REQUESTS) {
      throw new LlmRateLimitError(message, options);
    }
    if (response.status >= HTTP_SERVER_ERROR) {
      throw new LlmTransientError(message, options);
    }
    throw new LlmUnrecoverableError(message, options);
  }

  private async request<T>({
    body,
    headers = {},
    method = "GET",
    path,
    signal,
  }: {
    body?: FormData | string;
    headers?: Record<string, string>;
    method?: string;
    path: string;
    signal?: AbortSignal;
  }): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      body,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        ...headers,
      },
      method,
      signal,
    });
    if (!response.ok) {
      await this.throwFor(response);
    }
    return (await response.json()) as T;
  }

  /** `POST /parse`: start a job on a `source_url` or an uploaded `file_id` */
  async createParse(
    configuration: LlamaCloudParseConfiguration,
    { signal }: LlamaCloudRequestOptions = {},
  ): Promise<LlamaCloudParseJob> {
    return this.request<LlamaCloudParseJob>({
      body: JSON.stringify(configuration),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      path: "/parse",
      signal,
    });
  }

  /** `POST /parse/upload`: multipart `file` plus `configuration` JSON string */
  async uploadParse(
    {
      buffer,
      configuration,
      filename,
      mimeType,
    }: {
      buffer: Buffer;
      configuration: LlamaCloudParseConfiguration;
      filename: string;
      mimeType: string;
    },
    { signal }: LlamaCloudRequestOptions = {},
  ): Promise<LlamaCloudParseJob> {
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(buffer)], { type: mimeType }),
      filename,
    );
    form.append("configuration", JSON.stringify(configuration));
    return this.request<LlamaCloudParseJob>({
      body: form,
      method: "POST",
      path: "/parse/upload",
      signal,
    });
  }

  /** `GET /parse/{job_id}` with the result blocks named in `expand` */
  async getParse(
    jobId: string,
    {
      expand = [],
      signal,
    }: LlamaCloudRequestOptions & { expand?: string[] } = {},
  ): Promise<LlamaCloudParseResult> {
    const query = new URLSearchParams();
    for (const field of expand) {
      query.append("expand", field);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return this.request<LlamaCloudParseResult>({
      path: `/parse/${encodeURIComponent(jobId)}${suffix}`,
      signal,
    });
  }

  /** Download a presigned image URL as a `data:` URI */
  async fetchImage(
    url: string,
    { signal }: LlamaCloudRequestOptions = {},
  ): Promise<{ data: string; mimeType: string }> {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      await this.throwFor(response);
    }
    const mimeType =
      response.headers.get("content-type")?.split(";")[0].trim() ||
      "application/octet-stream";
    const bytes = Buffer.from(await response.arrayBuffer());
    return {
      data: `data:${mimeType};base64,${bytes.toString("base64")}`,
      mimeType,
    };
  }
}
