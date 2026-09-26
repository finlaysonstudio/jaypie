import { JsonObject, JsonReturn } from "@jaypie/types";
import type { MistralClient, OcrRequest } from "./client.js";
import { PROVIDER } from "../../constants.js";
import { LlmError } from "../../errors/LlmError.js";
import { toLlmError } from "../../errors/toLlmError.js";
import {
  answerOcr,
  expandPageSelection,
  pageCost,
  resolveOcrDocument,
  runOcrAttempts,
  toDataUri,
  wantsOcrAnswer,
} from "../../ocr/index.js";
import {
  createOperateLoop,
  createStreamLoop,
  mistralAdapter,
  OperateLoop,
  StreamLoop,
} from "../../operate/index.js";
import {
  LlmHistory,
  LlmInputMessage,
  LlmMessageOptions,
  LlmOperateOptions,
  LlmOperateResponse,
  LlmProvider,
  LlmHistoryItem,
  LlmUsage,
} from "../../types/LlmProvider.interface.js";
import { LlmStreamChunk } from "../../types/LlmStreamChunk.interface.js";
import {
  LlmOcrDocument,
  LlmOcrOptions,
  LlmOcrResolvedDocument,
  LlmOcrResponse,
} from "../../types/LlmOcr.interface.js";
import { isImageExtension } from "../../upload/index.js";
import { tokenCost } from "../../util/tokenCost.js";
import {
  DEFAULT_BBOX_ANNOTATION_FORMAT,
  MistralOcrPage,
  toOcrPage,
} from "./ocrPage.js";
import {
  getDefaultModel,
  getLogger,
  initializeClient,
  prepareMessages,
} from "./utils.js";

//
//
// Constants
//

/** Mistral reads only this many pages for `document_annotation` and says nothing past it */
const DOCUMENT_ANNOTATION_PAGE_LIMIT = 8;
const DOCUMENT_ANNOTATION_SCHEMA_NAME = "document";
/** Mistral requires a format with a prompt, so bare instructions answer into this key */
const INSTRUCTIONS_ONLY_KEY = "content";
const OCR_MODEL_MARKER = "ocr";
const PAGE_SEPARATOR = "\n\n";

//
//
// Helpers
//

/** Mistral wants `image_url` for images and `document_url` for the rest */
function toMistralDocument(document: LlmOcrResolvedDocument): JsonObject {
  const isImage =
    document.mimeType.startsWith("image/") ||
    isImageExtension(document.filename);
  const url = toDataUri(document);
  if (isImage) {
    return { image_url: url, type: "image_url" };
  }
  return {
    document_name: document.filename,
    document_url: url,
    type: "document_url",
  };
}

/**
 * `document_annotation_prompt` and `document_annotation_format` for the
 * caller's `instructions` and `format`. Bare instructions ride in a
 * one-string schema because Mistral rejects a prompt without a format.
 */
function toDocumentAnnotation({
  format,
  instructions,
}: Pick<LlmOcrOptions, "format" | "instructions">): Partial<OcrRequest> {
  const prompt = instructions?.trim();
  const schema = mistralAdapter.formatOutputSchema(
    format ?? { [INSTRUCTIONS_ONLY_KEY]: String },
  );
  return {
    ...(prompt ? { document_annotation_prompt: prompt } : {}),
    document_annotation_format: {
      json_schema: {
        name: DOCUMENT_ANNOTATION_SCHEMA_NAME,
        schema,
        strict: true,
      },
      type: "json_schema",
    },
  };
}

/** `document_annotation` arrives as a JSON string */
function parseDocumentAnnotation(value: unknown): JsonObject | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as JsonObject;
    }
  } catch {
    // Not JSON; there is no object to return
  }
  return undefined;
}

export class MistralProvider implements LlmProvider {
  private model: string;
  private _client?: MistralClient;
  private _operateLoop?: OperateLoop;
  private _streamLoop?: StreamLoop;
  private apiKey?: string;
  private log = getLogger();
  private conversationHistory: LlmHistoryItem[] = [];

  constructor(
    model: string = getDefaultModel(),
    { apiKey }: { apiKey?: string } = {},
  ) {
    this.model = model;
    this.apiKey = apiKey;
  }

  private async getClient(): Promise<MistralClient> {
    if (this._client) {
      return this._client;
    }

    this._client = await initializeClient({ apiKey: this.apiKey });
    return this._client;
  }

  private async getOperateLoop(): Promise<OperateLoop> {
    if (this._operateLoop) {
      return this._operateLoop;
    }

    const client = await this.getClient();
    this._operateLoop = createOperateLoop({
      adapter: mistralAdapter,
      client,
    });
    return this._operateLoop;
  }

  private async getStreamLoop(): Promise<StreamLoop> {
    if (this._streamLoop) {
      return this._streamLoop;
    }

    const client = await this.getClient();
    this._streamLoop = createStreamLoop({
      adapter: mistralAdapter,
      client,
    });
    return this._streamLoop;
  }

  async send(
    message: string,
    options?: LlmMessageOptions,
  ): Promise<string | JsonObject> {
    const client = await this.getClient();
    const messages = prepareMessages(message, options);
    const modelToUse = options?.model || this.model;

    // OpenAI-compatible Chat Completions body; messages are already wire-shaped.
    const response = await client.chatCompletion({
      model: modelToUse,
      messages,
    });

    const choices = response.choices as
      Array<{ message?: { content?: unknown } }> | undefined;
    const rawContent = choices?.[0]?.message?.content;
    // Content is a string unless reasoning is on, in which case it is an array
    // of chunks (a `thinking` chunk followed by a `text` chunk).
    const content =
      typeof rawContent === "string"
        ? rawContent
        : Array.isArray(rawContent)
          ? rawContent
              .filter((item) => item.type === "text")
              .map((item) => (item as { text: string }).text)
              .join("")
          : "";

    this.log.trace(`Assistant reply: ${content?.length || 0} characters`);

    // If structured output was requested, try to parse the response
    if (options?.response && content) {
      try {
        return JSON.parse(content);
      } catch {
        return content || "";
      }
    }

    return content || "";
  }

  async operate(
    input?: string | LlmHistory | LlmInputMessage,
    options: LlmOperateOptions = {},
  ): Promise<LlmOperateResponse> {
    const operateLoop = await this.getOperateLoop();
    const mergedOptions = { ...options, model: options.model ?? this.model };

    // Create a merged history including both the tracked history and any explicitly provided history
    if (this.conversationHistory.length > 0) {
      mergedOptions.history = options.history
        ? [...this.conversationHistory, ...options.history]
        : [...this.conversationHistory];
    }

    // Execute operate loop
    const response = await operateLoop.execute(input, mergedOptions);

    // Update conversation history with the new history from the response
    if (response.history && response.history.length > 0) {
      this.conversationHistory = response.history;
    }

    return response;
  }

  async *stream(
    input?: string | LlmHistory | LlmInputMessage,
    options: LlmOperateOptions = {},
  ): AsyncIterable<LlmStreamChunk> {
    const streamLoop = await this.getStreamLoop();
    const mergedOptions = { ...options, model: options.model ?? this.model };

    // Create a merged history including both the tracked history and any explicitly provided history
    if (this.conversationHistory.length > 0) {
      mergedOptions.history = options.history
        ? [...this.conversationHistory, ...options.history]
        : [...this.conversationHistory];
    }

    // Execute stream loop
    yield* streamLoop.execute(input, mergedOptions);
  }

  /**
   * Extract a document with Mistral's OCR models into the common
   * `LlmOcrResponse` shape.
   *
   * OCR is a document-processing route (`POST /v1/ocr`) rather than a chat
   * completion, so it does not pass through the operate loop. Pages are
   * 1-indexed here and 0-indexed on the wire; `providerOptions` spreads last
   * so any `OCRRequest` field (annotation formats, image limits, block
   * geometry) reaches the API untouched.
   */
  async ocr(
    document: LlmOcrDocument | LlmOcrResolvedDocument,
    options: LlmOcrOptions = {},
  ): Promise<LlmOcrResponse> {
    const model = this.resolveOcrModel(options.model);
    const resolved = await resolveOcrDocument(document);
    const pages = expandPageSelection(options.pages)?.map((page) => page - 1);
    const answering = wantsOcrAnswer(options);
    const request: OcrRequest = {
      document: toMistralDocument(resolved),
      model,
      ...(pages ? { pages } : {}),
      bbox_annotation_format: DEFAULT_BBOX_ANNOTATION_FORMAT,
      ...(answering ? toDocumentAnnotation(options) : {}),
      ...(options.tables ? { table_format: options.tables } : {}),
      ...(options.images ? { include_image_base64: true } : {}),
      ...(options.providerOptions ?? {}),
    };
    const annotated = Boolean(request.bbox_annotation_format);

    const client = await this.getClient();
    const raw = await runOcrAttempts({
      attempt: async () => {
        try {
          return await client.ocr(request, { signal: options.signal });
        } catch (error) {
          throw this.toOcrError(error, model);
        }
      },
      model,
      provider: PROVIDER.MISTRAL.NAME,
      retry: options.retry,
      signal: options.signal,
    });

    const wirePages = (raw.pages as MistralOcrPage[] | undefined) ?? [];
    const ocrPages = wirePages.map(toOcrPage);
    const markdown = ocrPages.map((page) => page.markdown).join(PAGE_SEPARATOR);
    const usageInfo = raw.usage_info as
      { pages_processed?: number } | undefined;
    const pagesProcessed = usageInfo?.pages_processed ?? ocrPages.length;
    const servedModel = (raw.model as string | undefined) ?? model;

    this.log.trace(`OCR extracted ${ocrPages.length} page(s)`);

    const annotations = parseDocumentAnnotation(raw.document_annotation);
    const responses: JsonReturn[] = [raw as JsonReturn];
    let content: string | JsonObject | undefined;
    let tokens: LlmUsage | undefined;
    if (answering && pagesProcessed > DOCUMENT_ANNOTATION_PAGE_LIMIT) {
      // The native annotation saw only the first pages; the chat model reads
      // the whole transcription instead
      this.log.debug(
        `OCR answer exceeds the ${DOCUMENT_ANNOTATION_PAGE_LIMIT}-page annotation limit; answering over markdown`,
        { pages: pagesProcessed },
      );
      const operateLoop = await this.getOperateLoop();
      const answer = await answerOcr({
        format: options.format,
        instructions: options.instructions,
        markdown,
        model: PROVIDER.MISTRAL.DEFAULT,
        operate: (input, operateOptions) =>
          operateLoop.execute(input, operateOptions),
        retry: options.retry,
        signal: options.signal,
      });
      content = answer.content;
      responses.push(...answer.response.responses);
      tokens = answer.response.usage;
    } else if (answering && annotations) {
      content = options.format
        ? annotations
        : (annotations[INSTRUCTIONS_ONLY_KEY] as string | undefined);
    }
    const ocrCost = pageCost({
      annotated,
      model: servedModel,
      pages: pagesProcessed,
    });
    // An unpriced part makes the whole unknown rather than understated
    const answerCost = tokens
      ? tokenCost(tokens, { model: PROVIDER.MISTRAL.DEFAULT })
      : 0;
    const cost =
      ocrCost === undefined || answerCost === undefined
        ? undefined
        : ocrCost + answerCost;

    return {
      ...(annotations ? { annotations } : {}),
      ...(content !== undefined ? { content } : {}),
      emulated: false,
      fallbackAttempts: 1,
      fallbackUsed: false,
      images: ocrPages.flatMap((page) => page.images),
      markdown,
      model: servedModel,
      pages: ocrPages,
      provider: PROVIDER.MISTRAL.NAME,
      responses,
      usage: {
        ...(cost !== undefined ? { cost } : {}),
        model: servedModel,
        pages: pagesProcessed,
        provider: PROVIDER.MISTRAL.NAME,
        ...(tokens ? { tokens } : {}),
      },
    };
  }

  /**
   * The instance model is a chat model unless the caller built the provider
   * for OCR, so anything without "ocr" in its id defers to the OCR default.
   */
  private resolveOcrModel(requested?: LlmOcrOptions["model"]): string {
    if (typeof requested === "string" && requested) {
      return requested;
    }
    if (this.model.toLowerCase().includes(OCR_MODEL_MARKER)) {
      return this.model;
    }
    return PROVIDER.MISTRAL.OCR;
  }

  /** Classify a client failure the way the chat adapter does, as a typed LlmError */
  private toOcrError(error: unknown, model: string): unknown {
    if (error instanceof LlmError) {
      return error;
    }
    return toLlmError(mistralAdapter.classifyError(error), {
      model,
      provider: PROVIDER.MISTRAL.NAME,
    });
  }
}
