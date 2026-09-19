import { JsonObject, JsonReturn } from "@jaypie/types";
import type { MistralClient, OcrRequest } from "./client.js";
import { PROVIDER } from "../../constants.js";
import { LlmError } from "../../errors/LlmError.js";
import { toLlmError } from "../../errors/toLlmError.js";
import {
  expandPageSelection,
  pageCost,
  resolveOcrDocument,
  runOcrAttempts,
  toDataUri,
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
} from "../../types/LlmProvider.interface.js";
import { LlmStreamChunk } from "../../types/LlmStreamChunk.interface.js";
import {
  LlmOcrDocument,
  LlmOcrImage,
  LlmOcrOptions,
  LlmOcrPage,
  LlmOcrResolvedDocument,
  LlmOcrResponse,
} from "../../types/LlmOcr.interface.js";
import { getMimeType, isImageExtension } from "../../upload/index.js";
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

const OCR_MODEL_MARKER = "ocr";
const PAGE_SEPARATOR = "\n\n";

//
//
// Types
//

/** One page of Mistral's `OCRResponse`, 0-indexed on the wire */
interface MistralOcrPage {
  footer?: string | null;
  header?: string | null;
  images?: MistralOcrImage[];
  index: number;
  markdown?: string;
  [key: string]: unknown;
}

interface MistralOcrImage {
  id: string;
  image_base64?: string | null;
  [key: string]: unknown;
}

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

/** Base64 arrives with or without a `data:` prefix depending on the route */
function toImageDataUri(
  image: MistralOcrImage,
  mimeType?: string,
): string | undefined {
  const base64 = image.image_base64;
  if (!base64) {
    return undefined;
  }
  if (base64.startsWith("data:")) {
    return base64;
  }
  return `data:${mimeType ?? "image/jpeg"};base64,${base64}`;
}

function toOcrPage(page: MistralOcrPage): LlmOcrPage {
  const pageNumber = page.index + 1;
  const images: LlmOcrImage[] = (page.images ?? []).map((image) => {
    const mimeType = getMimeType(image.id);
    return {
      data: toImageDataUri(image, mimeType),
      id: image.id,
      mimeType,
      page: pageNumber,
    };
  });
  return {
    ...(page.footer ? { footer: page.footer } : {}),
    ...(page.header ? { header: page.header } : {}),
    images,
    markdown: page.markdown ?? "",
    page: pageNumber,
    raw: page as JsonObject,
    success: true,
  };
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
    const request: OcrRequest = {
      document: toMistralDocument(resolved),
      model,
      ...(pages ? { pages } : {}),
      ...(options.tables ? { table_format: options.tables } : {}),
      ...(options.images ? { include_image_base64: true } : {}),
      ...(options.providerOptions ?? {}),
    };

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

    return {
      ...(raw.document_annotation
        ? { annotations: raw.document_annotation as JsonObject }
        : {}),
      emulated: false,
      fallbackAttempts: 1,
      fallbackUsed: false,
      images: ocrPages.flatMap((page) => page.images),
      markdown,
      model: servedModel,
      pages: ocrPages,
      provider: PROVIDER.MISTRAL.NAME,
      responses: [raw as JsonReturn],
      usage: {
        cost: pageCost({ model: servedModel, pages: pagesProcessed }),
        model: servedModel,
        pages: pagesProcessed,
        provider: PROVIDER.MISTRAL.NAME,
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
