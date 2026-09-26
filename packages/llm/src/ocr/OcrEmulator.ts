import { JsonObject } from "@jaypie/types";
import { InternalError, NotImplementedError } from "@jaypie/errors";

import {
  LlmTransientError,
  LlmUnrecoverableError,
} from "../errors/LlmError.js";
import { toAbortError } from "../errors/toAbortError.js";
import {
  LlmOcrOptions,
  LlmOcrPage,
  LlmOcrResolvedDocument,
  LlmOcrResponse,
  LlmOcrTableFormat,
} from "../types/LlmOcr.interface.js";
import {
  LlmOperateInput,
  LlmOperateResponse,
  LlmProvider,
  LlmUsage,
} from "../types/LlmProvider.interface.js";
import { getLogger } from "../util/logger.js";
import { tokenCost } from "../util/tokenCost.js";
import { extractPdfPages, getPdfPageCount } from "../upload/index.js";
import { answerOcr, wantsOcrAnswer } from "./answerOcr.js";
import { expandPageSelection } from "./expandPageSelection.js";

//
//
// Constants
//

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_TABLES: LlmOcrTableFormat = "markdown";
/** A page reported below this confidence is transcribed a second time */
const LOW_CONFIDENCE = 0.4;
const PDF_MIME_TYPE = "application/pdf";

const SYSTEM_PROMPT = [
  "Transcribe the attached document page to Markdown. This is optical character recognition, not conversation: produce no commentary, only the required JSON.",
  "",
  "Rules:",
  "- Transcribe every piece of text verbatim and in reading order. Do not summarize, translate, correct spelling, or fix grammar.",
  "- Do not invent text. A page with nothing to read yields an empty markdown string.",
  "- Use Markdown headings for headings and lists for lists, and preserve paragraph breaks.",
  "- Mark text that cannot be read with confidence as [UNCLEAR: best guess].",
  "- Describe non-text elements (photographs, charts, signatures, stamps) inline as [ELEMENT: short description]. A logo or graphic that contains readable text is transcribed as text, not marked as an element.",
  "- Report one confidence between 0 and 1 for the whole transcription: near 1 for clean printed text; lower for handwriting, low resolution, skew, or any [UNCLEAR] mark.",
].join("\n");

const TABLE_RULES: Record<LlmOcrTableFormat, string> = {
  html: "- Render tables as HTML <table> elements so merged cells survive.",
  markdown:
    "- Render tables as Markdown tables with one header row; flatten merged cells by repeating their value.",
};

//
//
// Types
//

interface PageInput {
  /** 1-indexed page within the document as sent */
  page: number;
  input: LlmOperateInput;
}

interface Transcription {
  confidence?: number;
  content: JsonObject;
  markdown: string;
  response: LlmOperateResponse;
}

//
//
// Helpers
//

function clampConfidence(value: unknown): number | undefined {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (typeof numeric !== "number" || !Number.isFinite(numeric)) {
    return undefined;
  }
  return Math.min(1, Math.max(0, numeric));
}

/** Read a URL the vendors would have fetched themselves */
async function fetchDocument(url: string): Promise<Buffer> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new LlmTransientError(`Could not fetch document ${url}`, {
      cause: error,
    });
  }
  if (!response.ok) {
    throw new LlmUnrecoverableError(
      `Could not fetch document ${url}: HTTP ${response.status}`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

async function resolveBuffer(
  document: LlmOcrResolvedDocument,
): Promise<Buffer> {
  return document.source.kind === "data"
    ? document.source.buffer
    : fetchDocument(document.source.url);
}

/**
 * Split the document into one `operate()` input per page. A PDF is trimmed
 * to a single page per call so the model never has to count or number
 * pages; an image or any other file is one page.
 */
async function splitPages({
  buffer,
  document,
  pages,
}: {
  buffer: Buffer;
  document: LlmOcrResolvedDocument;
  pages?: number[] | string;
}): Promise<PageInput[]> {
  const { filename, mimeType } = document;
  if (mimeType !== PDF_MIME_TYPE) {
    const key = mimeType.startsWith("image/") ? "image" : "file";
    return [
      {
        input: [
          "Transcribe this page.",
          { [key]: filename, data: buffer.toString("base64") },
        ] as LlmOperateInput,
        page: 1,
      },
    ];
  }
  const total = await getPdfPageCount(buffer);
  const selected: number[] = pages
    ? (expandPageSelection(pages) ?? [])
    : Array.from({ length: total }, (_page, index) => index + 1);
  const single = total === 1 && selected.length === 1 && selected[0] === 1;
  return Promise.all(
    selected.map(async (page) => {
      const bytes = single ? buffer : await extractPdfPages(buffer, [page]);
      return {
        input: [
          `Transcribe page ${page} of ${total}.`,
          { data: bytes.toString("base64"), file: filename },
        ] as LlmOperateInput,
        page,
      };
    }),
  );
}

/**
 * Run `task` over `items` with at most `limit` in flight. The first failure
 * aborts the rest through `controller` and is rethrown once everything in
 * flight has settled, so a fallback engine starts from a quiet line.
 */
async function runConcurrently<T, R>({
  controller,
  items,
  limit,
  task,
}: {
  controller: AbortController;
  items: T[];
  limit: number;
  task: (item: T) => Promise<R>;
}): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let failure: unknown;
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (next < items.length && !controller.signal.aborted) {
        const index = next++;
        try {
          results[index] = await task(items[index]);
        } catch (error) {
          failure ??= error;
          controller.abort();
        }
      }
    },
  );
  await Promise.all(workers);
  if (failure !== undefined) {
    throw failure;
  }
  return results;
}

//
//
// Main
//

/** System prompt for one page, with the table rule the caller chose */
export function buildOcrPrompt({
  tables = DEFAULT_TABLES,
}: { tables?: LlmOcrTableFormat } = {}): string {
  return `${SYSTEM_PROMPT}\n${TABLE_RULES[tables]}`;
}

/**
 * JSON Schema for one page. Bounds live in descriptions rather than
 * `minimum`/`maximum` because strict structured-output modes reject numeric
 * keywords.
 */
export function buildOcrFormat(): JsonObject {
  return {
    additionalProperties: false,
    properties: {
      confidence: {
        description:
          "Confidence between 0 and 1 that the markdown is a faithful transcription",
        type: "number",
      },
      markdown: {
        description:
          "The page's text as Markdown, verbatim and in reading order",
        type: "string",
      },
      notes: {
        description:
          "Anything a reader of the transcription needs to know about the page; empty when nothing",
        type: "string",
      },
    },
    required: ["confidence", "markdown", "notes"],
    type: "object",
  };
}

/**
 * Read one page's transcription out of an `operate()` response. A missing
 * or unreadable transcription throws so the fallback chain moves to the
 * next engine rather than returning a partial document.
 */
export function parseOcrContent({
  content,
  page,
}: {
  content: unknown;
  page: number;
}): { confidence?: number; content: JsonObject; markdown: string } {
  let parsed: unknown = content;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw new InternalError(
        `OCR emulation did not return JSON for page ${page}`,
      );
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new InternalError(
      `OCR emulation did not return a JSON object for page ${page}`,
    );
  }
  const payload = parsed as Record<string, unknown>;
  if (typeof payload.markdown !== "string") {
    throw new InternalError(
      `OCR emulation returned no markdown for page ${page}`,
    );
  }
  return {
    confidence: clampConfidence(payload.confidence),
    content: payload as JsonObject,
    markdown: payload.markdown,
  };
}

/**
 * Transcribe a document with a provider that has no native OCR, by rigging
 * up one structured `operate()` call per page. Each page rides alone so the
 * model never numbers pages; a page the model reports low confidence on is
 * transcribed once more and the higher score wins.
 */
export async function emulateOcr({
  document,
  options,
  provider,
  providerName,
}: {
  document: LlmOcrResolvedDocument;
  options: LlmOcrOptions;
  provider: LlmProvider;
  providerName: string;
}): Promise<LlmOcrResponse> {
  if (!provider.operate) {
    throw new NotImplementedError(
      `Provider ${providerName} supports neither ocr nor operate`,
    );
  }
  const operate = provider.operate.bind(provider);
  // The facade has resolved a chain to one id by the time an attempt runs
  const model = typeof options.model === "string" ? options.model : undefined;
  const log = getLogger();
  const buffer = await resolveBuffer(document);
  const pageInputs = await splitPages({
    buffer,
    document,
    pages: options.pages,
  });

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });
  const format = buildOcrFormat();
  const system = buildOcrPrompt({ tables: options.tables });

  const transcribe = async ({
    input,
    page,
  }: PageInput): Promise<Transcription> => {
    const response = await operate(input, {
      fallback: false,
      format,
      model,
      placeholders: { input: false, system: false },
      retry: options.retry,
      signal: controller.signal,
      system,
      temperature: 0,
      turns: 1,
      user: options.user,
    });
    if (response.error) {
      // A settled error is a plain body (the loop's own stops are); wrap it so
      // the chain logs its detail and classifies it like any other failure
      throw response.error instanceof Error
        ? response.error
        : new LlmUnrecoverableError(
            response.error.detail ?? response.error.title,
          );
    }
    return {
      ...parseOcrContent({ content: response.content, page }),
      response,
    };
  };

  const transcribePage = async (
    pageInput: PageInput,
  ): Promise<{ page: number; transcriptions: Transcription[] }> => {
    const transcriptions = [await transcribe(pageInput)];
    const first = transcriptions[0].confidence;
    if (first !== undefined && first < LOW_CONFIDENCE) {
      log.debug(
        `${providerName} OCR emulation reported low confidence; transcribing again`,
        { confidence: first, page: pageInput.page },
      );
      transcriptions.push(await transcribe(pageInput));
    } else {
      log.trace(`${providerName} OCR emulation transcribed page`, {
        confidence: first,
        page: pageInput.page,
      });
    }
    return { page: pageInput.page, transcriptions };
  };

  let results: Array<{ page: number; transcriptions: Transcription[] }>;
  try {
    results = await runConcurrently({
      controller,
      items: pageInputs,
      limit: options.concurrency ?? DEFAULT_CONCURRENCY,
      task: transcribePage,
    });
  } catch (error) {
    if (options.signal?.aborted) {
      throw toAbortError({
        cause: error,
        model,
        provider: providerName,
        signal: options.signal,
      });
    }
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", onAbort);
  }

  const responses: LlmOcrResponse["responses"] = [];
  const tokens: LlmUsage = [];
  let servedModel: string | undefined;
  let servedProvider: string | undefined;
  const pages: LlmOcrPage[] = results.map(({ page, transcriptions }) => {
    for (const { response } of transcriptions) {
      responses.push(...response.responses);
      tokens.push(...response.usage);
      servedModel ??= response.model;
      servedProvider ??= response.provider;
    }
    // The higher confidence wins; an unreported confidence never displaces
    // a reported one
    const best = transcriptions.reduce((winner, candidate) =>
      (candidate.confidence ?? -1) > (winner.confidence ?? -1)
        ? candidate
        : winner,
    );
    return {
      confidence: best.confidence,
      images: [],
      markdown: best.markdown,
      page,
      raw: { ...best.content, transcriptions: transcriptions.length },
      success: true,
    };
  });

  const finalModel = servedModel ?? model ?? "";
  const finalProvider = servedProvider ?? providerName;
  const markdown = pages.map((item) => item.markdown).join("\n\n");

  // Each page rode alone, so the document-level answer takes one more call
  // over the whole transcription
  let content: string | JsonObject | undefined;
  if (wantsOcrAnswer(options)) {
    const answer = await answerOcr({
      format: options.format,
      instructions: options.instructions,
      markdown,
      model: servedModel ?? model,
      operate,
      retry: options.retry,
      signal: options.signal,
      user: options.user,
    });
    content = answer.content;
    responses.push(...answer.response.responses);
    tokens.push(...answer.response.usage);
  }

  return {
    ...(content !== undefined ? { content } : {}),
    emulated: true,
    fallbackAttempts: 1,
    fallbackUsed: false,
    images: [],
    markdown,
    model: finalModel,
    pages,
    provider: finalProvider,
    responses,
    usage: {
      cost: tokenCost(tokens, { model: finalModel }),
      model: finalModel,
      pages: pages.length,
      provider: finalProvider,
      tokens,
    },
  };
}
