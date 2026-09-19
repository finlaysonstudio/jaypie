import { JsonObject, JsonReturn } from "@jaypie/types";
import { NotImplementedError } from "@jaypie/errors";

import { PROVIDER } from "../../constants.js";
import {
  LlmAbortError,
  LlmTransientError,
  LlmUnrecoverableError,
} from "../../errors/LlmError.js";
import { toAbortError } from "../../errors/toAbortError.js";
import {
  expandPageSelection,
  pageCost,
  resolveOcrDocument,
  runOcrAttempts,
} from "../../ocr/index.js";
import {
  LlmOcrDocument,
  LlmOcrImage,
  LlmOcrOptions,
  LlmOcrPage,
  LlmOcrResolvedDocument,
  LlmOcrResponse,
} from "../../types/LlmOcr.interface.js";
import { LlmProvider } from "../../types/LlmProvider.interface.js";
import { abortableSleep } from "../../util/abortableSleep.js";
import {
  LlamaCloudClient,
  LlamaCloudImageMetadata,
  LlamaCloudParseConfiguration,
  LlamaCloudParseJob,
  LlamaCloudParseResult,
  LlamaCloudParseTier,
} from "./client.js";
import { getLogger, initializeClient, resolveTier } from "./utils.js";

//
//
// Constants
//

const CREDITS_PER_PRICE_UNIT = 1000;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const EXPAND_IMAGES = "images_content_metadata";
const EXPAND_MARKDOWN = "markdown";
const EXPAND_TEXT = "text";
const EXPAND_USAGE = "usage";
const FAST_TIER: LlamaCloudParseTier = "fast";
const IMAGE_PAGE_PATTERN = /(?:^|[_-])(?:page|p)[_-]?(\d+)(?=[_.-]|$)/i;
const PAGE_SEPARATOR = "\n\n";
const POLL_BACKOFF_FACTOR = 1.5;
const POLL_INITIAL_MS = 1000;
const POLL_MAX_MS = 5000;
const TERMINAL_STATUSES = new Set(["CANCELLED", "COMPLETED", "FAILED"]);

//
//
// Helpers
//

/** LlamaParse names images `image_0.png`; a page is read when the name carries one */
function pageFromFilename(filename: string): number | undefined {
  const match = IMAGE_PAGE_PATTERN.exec(filename);
  return match ? Number(match[1]) : undefined;
}

function toOcrImage(image: LlamaCloudImageMetadata): LlmOcrImage {
  const page = pageFromFilename(image.filename);
  return {
    id: image.filename,
    ...(image.content_type ? { mimeType: image.content_type } : {}),
    ...(page !== undefined ? { page } : {}),
  };
}

function markdownPages(result: LlamaCloudParseResult): LlmOcrPage[] {
  return (result.markdown?.pages ?? []).map((page) => {
    if (page.success === false) {
      return {
        error: page.error,
        images: [],
        markdown: "",
        page: page.page_number,
        raw: page as unknown as JsonObject,
        success: false,
      };
    }
    return {
      ...(page.footer ? { footer: page.footer } : {}),
      ...(page.header ? { header: page.header } : {}),
      images: [],
      markdown: page.markdown ?? "",
      page: page.page_number,
      raw: page as unknown as JsonObject,
      success: true,
    };
  });
}

/** The fast tier produces text only; it stands in for markdown page by page */
function textPages(result: LlamaCloudParseResult): LlmOcrPage[] {
  return (result.text?.pages ?? []).map((page) => ({
    images: [],
    markdown: page.text ?? "",
    page: page.page_number,
    raw: page as unknown as JsonObject,
    success: true,
  }));
}

//
//
// Main
//

/**
 * LlamaParse over the LlamaCloud Parse API v2. The service extracts
 * documents and does nothing else — no text generation, no tools, no
 * conversation — so `ocr` is the provider's whole surface; `send` is not
 * implemented, and `Llm` routes around the absence of the rest.
 *
 * A parse is a job: submit (by URL or upload), poll until terminal, fetch
 * the result blocks. The tier comes from the model id
 * (`llamaparse-agentic` → `agentic`) and the API version from the tier's
 * entry in `PROVIDER.LLAMACLOUD.VERSION` unless `providerOptions.version`
 * overrides it.
 */
export class LlamaCloudProvider implements LlmProvider {
  private _client?: LlamaCloudClient;
  private apiKey?: string;
  private log = getLogger();
  private model: string;

  constructor(
    model: string = PROVIDER.LLAMACLOUD.DEFAULT,
    { apiKey }: { apiKey?: string } = {},
  ) {
    this.apiKey = apiKey;
    this.model = model;
  }

  private async getClient(): Promise<LlamaCloudClient> {
    if (this._client) {
      return this._client;
    }
    this._client = await initializeClient({ apiKey: this.apiKey });
    return this._client;
  }

  async send(): Promise<string | JsonObject> {
    throw new NotImplementedError(
      `Provider ${PROVIDER.LLAMACLOUD.NAME} extracts documents only; use Llm.ocr`,
    );
  }

  async ocr(
    document: LlmOcrDocument | LlmOcrResolvedDocument,
    options: LlmOcrOptions = {},
  ): Promise<LlmOcrResponse> {
    const model =
      (typeof options.model === "string" && options.model) || this.model;
    const tier = resolveTier(model);
    const providerOptions = options.providerOptions ?? {};
    const version =
      (typeof providerOptions.version === "string" &&
        providerOptions.version) ||
      PROVIDER.LLAMACLOUD.VERSION[tier];
    const resolved = await resolveOcrDocument(document);
    const configuration = this.buildConfiguration({
      options,
      providerOptions,
      tier,
      version,
    });
    const context = {
      model,
      provider: PROVIDER.LLAMACLOUD.NAME,
      retry: options.retry,
      signal: options.signal,
    };
    const client = await this.getClient();

    // Submit
    const submitted = await runOcrAttempts({
      ...context,
      attempt: () => this.submit({ client, configuration, resolved, options }),
    });
    this.log.trace(`LlamaParse job ${submitted.id} submitted (${tier})`);

    // Poll
    const job = await this.waitForJob({
      client,
      context,
      job: submitted,
      timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
    });
    if (job.status === "FAILED") {
      throw new LlmUnrecoverableError(
        `LlamaParse job ${job.id} failed: ${job.error_message ?? "no error message"}`,
        { model, provider: PROVIDER.LLAMACLOUD.NAME },
      );
    }
    if (job.status === "CANCELLED") {
      throw new LlmAbortError(`LlamaParse job ${job.id} was cancelled`, {
        model,
        provider: PROVIDER.LLAMACLOUD.NAME,
      });
    }

    // Fetch
    const expand = [
      tier === FAST_TIER ? EXPAND_TEXT : EXPAND_MARKDOWN,
      EXPAND_USAGE,
      ...(options.images ? [EXPAND_IMAGES] : []),
    ];
    const result = await runOcrAttempts({
      ...context,
      attempt: () =>
        client.getParse(job.id, { expand, signal: options.signal }),
    });

    return this.toResponse({
      client,
      model,
      options,
      result,
      tier,
      version,
    });
  }

  private buildConfiguration({
    options,
    providerOptions,
    tier,
    version,
  }: {
    options: LlmOcrOptions;
    providerOptions: JsonObject;
    tier: LlamaCloudParseTier;
    version: string;
  }): LlamaCloudParseConfiguration {
    const pages = expandPageSelection(options.pages);
    const configuration: LlamaCloudParseConfiguration = { tier, version };
    if (pages) {
      configuration.page_ranges = { target_pages: pages.join(",") };
    }
    if (options.tables) {
      configuration.output_options = {
        markdown: {
          tables: { output_tables_as_markdown: options.tables !== "html" },
        },
      };
    }
    // Vendor fields last: a caller's `output_options` replaces the one built
    // above rather than merging, so the caller sees exactly what was sent.
    return { ...configuration, ...providerOptions, tier, version };
  }

  private async submit({
    client,
    configuration,
    options,
    resolved,
  }: {
    client: LlamaCloudClient;
    configuration: LlamaCloudParseConfiguration;
    options: LlmOcrOptions;
    resolved: LlmOcrResolvedDocument;
  }): Promise<LlamaCloudParseJob> {
    if (resolved.source.kind === "url") {
      return client.createParse(
        { ...configuration, source_url: resolved.source.url },
        { signal: options.signal },
      );
    }
    return client.uploadParse(
      {
        buffer: resolved.source.buffer,
        configuration,
        filename: resolved.filename,
        mimeType: resolved.mimeType,
      },
      { signal: options.signal },
    );
  }

  /**
   * Poll until the job is terminal. The interval starts at one second and
   * backs off to five; the deadline (`timeout`, default ten minutes) throws
   * a transient error so a fallback chain can try the next engine.
   */
  private async waitForJob({
    client,
    context,
    job,
    timeout,
  }: {
    client: LlamaCloudClient;
    context: {
      model: string;
      provider: string;
      retry?: LlmOcrOptions["retry"];
      signal?: AbortSignal;
    };
    job: LlamaCloudParseJob;
    timeout: number;
  }): Promise<LlamaCloudParseJob> {
    const deadline = Date.now() + timeout;
    let current = job;
    let delay = POLL_INITIAL_MS;
    let polls = 0;

    while (!TERMINAL_STATUSES.has(current.status)) {
      if (context.signal?.aborted) {
        throw toAbortError({ ...context, signal: context.signal });
      }
      if (Date.now() >= deadline) {
        throw new LlmTransientError(
          `LlamaParse job ${current.id} did not complete within the timeout`,
          { model: context.model, provider: context.provider },
        );
      }
      await abortableSleep({ ms: delay, signal: context.signal });
      delay = Math.min(delay * POLL_BACKOFF_FACTOR, POLL_MAX_MS);
      polls += 1;
      const polled = await runOcrAttempts({
        ...context,
        attempt: () => client.getParse(current.id, { signal: context.signal }),
      });
      current = polled.job;
    }

    this.log.trace(
      `LlamaParse job ${current.id} ${current.status} after ${polls} poll(s)`,
    );
    return current;
  }

  private async toResponse({
    client,
    model,
    options,
    result,
    tier,
    version,
  }: {
    client: LlamaCloudClient;
    model: string;
    options: LlmOcrOptions;
    result: LlamaCloudParseResult;
    tier: LlamaCloudParseTier;
    version: string;
  }): Promise<LlmOcrResponse> {
    let pages: LlmOcrPage[];
    if (tier === FAST_TIER) {
      pages = textPages(result);
      this.log.debug(
        "LlamaParse fast tier returns text only; markdown carries the page text",
      );
    } else {
      pages = markdownPages(result);
    }

    // Images: metadata always names them; bytes are fetched only on request
    const metadata = result.images_content_metadata?.images ?? [];
    const images: LlmOcrImage[] = [];
    for (const item of metadata) {
      const image = toOcrImage(item);
      if (options.images && item.presigned_url) {
        const fetched = await runOcrAttempts({
          attempt: () =>
            client.fetchImage(item.presigned_url as string, {
              signal: options.signal,
            }),
          model,
          provider: PROVIDER.LLAMACLOUD.NAME,
          retry: options.retry,
          signal: options.signal,
        });
        image.data = fetched.data;
        image.mimeType = image.mimeType ?? fetched.mimeType;
      }
      images.push(image);
      const owner = pages.find((page) => page.page === image.page);
      if (owner) {
        owner.images.push(image);
      }
    }

    const credits = result.job.usage?.credits ?? undefined;
    const servedModel = `${model}@${version}`;
    const cost =
      credits !== undefined
        ? (credits * PROVIDER.LLAMACLOUD.CREDIT_COST) / CREDITS_PER_PRICE_UNIT
        : pageCost({ model, pages: pages.length });

    this.log.trace(`LlamaParse extracted ${pages.length} page(s)`);

    return {
      fallbackAttempts: 1,
      fallbackUsed: false,
      images,
      markdown: pages.map((page) => page.markdown).join(PAGE_SEPARATOR),
      model: servedModel,
      pages,
      provider: PROVIDER.LLAMACLOUD.NAME,
      responses: [result as unknown as JsonReturn],
      usage: {
        ...(cost !== undefined ? { cost } : {}),
        ...(credits !== undefined ? { credits } : {}),
        model: servedModel,
        pages: pages.length,
        provider: PROVIDER.LLAMACLOUD.NAME,
      },
    };
  }
}
