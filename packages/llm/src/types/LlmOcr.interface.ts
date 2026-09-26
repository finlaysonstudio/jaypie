import { JsonObject, JsonReturn } from "@jaypie/types";

import { type LlmProviderName } from "../constants.js";
import { type LlmRetryOptions } from "../operate/retry/RetryPolicy.js";
import type {
  LlmFallbackConfig,
  LlmModelOption,
  LlmOperateInputFile,
  LlmOperateInputImage,
  LlmUsage,
} from "./LlmProvider.interface.js";

/**
 * What to read. A string is an `https://` URL, a `data:` URI, an S3 key
 * (when `CDK_ENV_BUCKET` is set), or a local path, detected in that order.
 * The object forms are the ones `operate()` already accepts, so a caller
 * with `{ file, bucket, pages }` in hand passes it through unchanged.
 */
export type LlmOcrDocument =
  string | LlmOperateInputFile | LlmOperateInputImage;

/**
 * A document after `resolveOcrDocument`: either a URL both vendors fetch
 * themselves, or bytes read once and handed to every attempt in a fallback
 * chain. Providers accept this alongside the raw forms so the facade can
 * resolve S3 and disk a single time per call.
 */
export interface LlmOcrResolvedDocument {
  filename: string;
  mimeType: string;
  source: { kind: "url"; url: string } | { kind: "data"; buffer: Buffer };
}

export type LlmOcrTableFormat = "html" | "markdown";

export interface LlmOcrOptions {
  /** Static form only: API key for the primary provider */
  apiKey?: string;
  /**
   * Emulated engines only: pages in flight at once, each its own
   * `operate()` call. Default 5.
   */
  concurrency?: number;
  /** Chain of fallback providers; `false` disables instance-level fallback */
  fallback?: LlmFallbackConfig[] | false;
  /** Fetch extracted images as base64 data URIs. Default false. */
  images?: boolean;
  /** Static form only: provider name */
  llm?: LlmProviderName;
  model?: LlmModelOption;
  /** 1-indexed page selection: `[1, 3]` or `"1,3,5-10"`. Omit for all pages. */
  pages?: number[] | string;
  /**
   * Vendor fields forwarded verbatim and spread last: Mistral `OCRRequest`
   * fields, or LlamaParse `ParseRequestConfiguration` fields (`version`,
   * `agentic_options`, `processing_options`, `output_options`, ...).
   */
  providerOptions?: JsonObject;
  retry?: LlmRetryOptions;
  /** Caller-owned cancellation */
  signal?: AbortSignal;
  /**
   * Table syntax inside markdown. Tables are always inline; this picks
   * markdown pipes or HTML. Omit for the engine default (markdown).
   */
  tables?: LlmOcrTableFormat;
  /** Upper bound on an asynchronous job, in milliseconds. Default 10 minutes. */
  timeout?: number;
  /** End-user identifier forwarded to emulated engines, as on `operate()` */
  user?: string;
}

export interface LlmOcrImage {
  /** The engine's structured annotation of the image, when it made one */
  annotation?: JsonObject;
  /** `data:` URI when fetched (`images: true`), else undefined */
  data?: string;
  /**
   * Short label for the image, e.g. "Notary signature of Jane Doe". It is also
   * the alt text of the image's link in `markdown`.
   */
  description?: string;
  /** Vendor filename, e.g. "img-0.jpeg" or "image_0.png" */
  id: string;
  mimeType?: string;
  /** 1-indexed page the image was extracted from, when the vendor reports it */
  page?: number;
  /** Kind of element, e.g. "signature", "seal", "photo", when annotated */
  type?: string;
}

export interface LlmOcrPage {
  /**
   * Emulated engines only: the model's self-reported confidence in the
   * transcription, 0 to 1. Native OCR engines report none.
   */
  confidence?: number;
  /** Vendor error text when the page failed */
  error?: string;
  footer?: string;
  header?: string;
  images: LlmOcrImage[];
  markdown: string;
  /** 1-indexed */
  page: number;
  /** The vendor page untouched, for block geometry and other extras */
  raw: JsonObject;
  success: boolean;
}

export interface LlmOcrUsage {
  /** USD: from PAGE_COST for a native engine, from COST tokens when emulated */
  cost?: number;
  /** LlamaParse credits billed, when the job has recorded them */
  credits?: number;
  model: string;
  pages: number;
  provider: string;
  /** Emulated engines only: token usage of every `operate()` call made */
  tokens?: LlmUsage;
}

export interface LlmOcrResponse {
  /** Mistral `document_annotation`, when requested through providerOptions */
  annotations?: JsonObject;
  /**
   * True when a chat model transcribed the pages through `operate()`
   * rather than a native OCR engine answering.
   */
  emulated: boolean;
  /** Number of providers attempted (1 = primary only, >1 = fallback(s) used) */
  fallbackAttempts: number;
  fallbackUsed: boolean;
  /** Every page's images, in page order */
  images: LlmOcrImage[];
  /** Every page's markdown joined with a blank line */
  markdown: string;
  /** The id the vendor echoed, or the tier id plus pinned version */
  model: string;
  pages: LlmOcrPage[];
  provider: string;
  /** Raw vendor payload(s): the OCR body, or the final parse result */
  responses: JsonReturn[];
  usage: LlmOcrUsage;
}
