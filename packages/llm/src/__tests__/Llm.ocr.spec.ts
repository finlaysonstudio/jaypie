import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Llm from "../Llm.js";
import { MODEL, PROVIDER } from "../constants.js";
import { LlmUnrecoverableError } from "../errors/LlmError.js";
import { LlamaCloudProvider } from "../providers/llamacloud/index.js";
import { LlmOcrResponse } from "../types/LlmOcr.interface.js";
import { LlmOperateResponse } from "../types/LlmProvider.interface.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const anthropicOperateMock = vi.fn();
const llamaCloudOcrMock = vi.fn();
const mistralOcrMock = vi.fn();

vi.mock("../providers/llamacloud/index.js", () => ({
  LlamaCloudProvider: vi.fn().mockImplementation(
    class {
      ocr = llamaCloudOcrMock;
      send = vi.fn();
    } as any,
  ),
}));

vi.mock("../providers/mistral/index.js", () => ({
  MistralProvider: vi.fn().mockImplementation(
    class {
      ocr = mistralOcrMock;
      operate = vi.fn();
      send = vi.fn();
    } as any,
  ),
}));

vi.mock("../providers/anthropic/AnthropicProvider.class.js", () => ({
  AnthropicProvider: vi.fn().mockImplementation(
    class {
      operate = anthropicOperateMock;
      send = vi.fn();
    } as any,
  ),
}));

vi.mock("../providers/typesafe/index.js", () => ({
  TypeSafeProvider: vi.fn().mockImplementation(
    class {
      question = vi.fn();
      send = vi.fn();
    } as any,
  ),
}));

vi.mock("@jaypie/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@jaypie/logger")>();
  return {
    ...actual,
    default: {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      trace: vi.fn(),
      warn: vi.fn(),
    },
  };
});

const DOCUMENT_URL = "https://x.test/scan.pdf";
const FIXTURE_PDF = join(__dirname, "../../test/fixtures/page.pdf");

function response(
  provider: string,
  model: string,
): Omit<LlmOcrResponse, "fallbackAttempts" | "fallbackUsed"> {
  return {
    emulated: false,
    images: [],
    markdown: "# Page",
    model,
    pages: [
      { images: [], markdown: "# Page", page: 1, raw: {}, success: true },
    ],
    provider,
    responses: [],
    usage: { model, pages: 1, provider },
  };
}

function operateResponse(
  content: LlmOperateResponse["content"],
): LlmOperateResponse {
  return {
    content,
    history: [],
    model: MODEL.HAIKU,
    output: [],
    provider: PROVIDER.ANTHROPIC.NAME,
    reasoning: [],
    responses: [{ id: "r" }],
    status: "completed" as LlmOperateResponse["status"],
    usage: [
      {
        input: 10,
        model: MODEL.HAIKU,
        output: 5,
        provider: PROVIDER.ANTHROPIC.NAME,
        reasoning: 0,
        total: 15,
      },
    ],
  };
}

describe("Llm.ocr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mistralOcrMock.mockResolvedValue(
      response(PROVIDER.MISTRAL.NAME, MODEL.MISTRAL.OCR),
    );
    llamaCloudOcrMock.mockResolvedValue(
      response(PROVIDER.LLAMACLOUD.NAME, MODEL.LLAMAPARSE.AGENTIC),
    );
    anthropicOperateMock.mockResolvedValue(
      operateResponse({ confidence: 0.9, markdown: "# Emulated", notes: "" }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Works", () => {
    expect(Llm.ocr).toBeFunction();
    expect(new Llm(PROVIDER.MISTRAL.NAME).ocr).toBeFunction();
  });

  describe("Happy Paths", () => {
    it("Defaults to Mistral OCR with no provider or model", async () => {
      const result = await Llm.ocr(DOCUMENT_URL);
      expect(mistralOcrMock).toHaveBeenCalledTimes(1);
      expect(llamaCloudOcrMock).not.toHaveBeenCalled();
      expect(result.provider).toBe(PROVIDER.MISTRAL.NAME);
      expect(result.emulated).toBe(false);
      expect(result.fallbackAttempts).toBe(1);
      expect(result.fallbackUsed).toBe(false);
    });

    it("Resolves the document once and hands providers the resolved form", async () => {
      await Llm.ocr(DOCUMENT_URL, { pages: [1] });
      const [document, options] = mistralOcrMock.mock.calls[0];
      expect(document).toEqual({
        filename: "scan.pdf",
        mimeType: "application/pdf",
        source: { kind: "url", url: DOCUMENT_URL },
      });
      expect(options.pages).toEqual([1]);
      expect(options.fallback).toBe(false);
    });

    it("Routes a LlamaParse tier id to LlamaCloud", async () => {
      const result = await Llm.ocr(DOCUMENT_URL, {
        model: MODEL.LLAMAPARSE.FAST,
      });
      expect(llamaCloudOcrMock).toHaveBeenCalledTimes(1);
      // The static form builds the provider for the model; the per-call
      // options carry no model of their own
      expect(vi.mocked(LlamaCloudProvider)).toHaveBeenCalledWith(
        MODEL.LLAMAPARSE.FAST,
        expect.anything(),
      );
      expect(llamaCloudOcrMock.mock.calls[0][1].model).toBeUndefined();
      expect(result.provider).toBe(PROVIDER.LLAMACLOUD.NAME);
    });

    it("Passes a per-call model through on an instance", async () => {
      const llm = new Llm(PROVIDER.LLAMACLOUD.NAME);
      await llm.ocr(DOCUMENT_URL, { model: MODEL.LLAMAPARSE.FAST });
      expect(llamaCloudOcrMock.mock.calls[0][1].model).toBe(
        MODEL.LLAMAPARSE.FAST,
      );
    });

    it("Routes a provider name to that provider's default", async () => {
      await Llm.ocr(DOCUMENT_URL, { llm: PROVIDER.LLAMACLOUD.NAME });
      expect(llamaCloudOcrMock).toHaveBeenCalledTimes(1);
      expect(llamaCloudOcrMock.mock.calls[0][1].model).toBeUndefined();
    });

    it("Falls back across engines on a model chain", async () => {
      mistralOcrMock.mockRejectedValueOnce(
        new LlmUnrecoverableError("mistral down"),
      );
      const result = await Llm.ocr(DOCUMENT_URL, {
        model: [MODEL.MISTRAL.OCR, MODEL.LLAMAPARSE.AGENTIC],
      });
      expect(mistralOcrMock).toHaveBeenCalledTimes(1);
      expect(llamaCloudOcrMock).toHaveBeenCalledTimes(1);
      // The fallback runs its own model, never the primary's
      expect(llamaCloudOcrMock.mock.calls[0][1].model).toBeUndefined();
      expect(result.provider).toBe(PROVIDER.LLAMACLOUD.NAME);
      expect(result.fallbackAttempts).toBe(2);
      expect(result.fallbackUsed).toBe(true);
    });

    it("Fails fast on rate limits when a fallback remains", async () => {
      await Llm.ocr(DOCUMENT_URL, {
        model: [MODEL.MISTRAL.OCR, MODEL.LLAMAPARSE.AGENTIC],
      });
      expect(mistralOcrMock.mock.calls[0][1].retry).toEqual({
        rateLimit: false,
      });
    });

    it("Keeps the wait on the last attempt", async () => {
      await Llm.ocr(DOCUMENT_URL, { model: MODEL.MISTRAL.OCR });
      expect(mistralOcrMock.mock.calls[0][1].retry).toBeUndefined();
    });

    it("Honors an explicit fallback config", async () => {
      llamaCloudOcrMock.mockRejectedValueOnce(
        new LlmUnrecoverableError("llama down"),
      );
      const result = await Llm.ocr(DOCUMENT_URL, {
        fallback: [{ provider: PROVIDER.MISTRAL.NAME }],
        llm: PROVIDER.LLAMACLOUD.NAME,
      });
      expect(result.provider).toBe(PROVIDER.MISTRAL.NAME);
      expect(result.fallbackUsed).toBe(true);
    });

    it("Runs on an instance built for a provider", async () => {
      const llm = new Llm(PROVIDER.LLAMACLOUD.NAME);
      const result = await llm.ocr(DOCUMENT_URL);
      expect(result.provider).toBe(PROVIDER.LLAMACLOUD.NAME);
    });
  });

  describe("Emulation", () => {
    it("Emulates through operate on a chat model", async () => {
      const result = await Llm.ocr(FIXTURE_PDF, { model: MODEL.HAIKU });
      expect(mistralOcrMock).not.toHaveBeenCalled();
      expect(anthropicOperateMock).toHaveBeenCalledTimes(1);
      const [input, options] = anthropicOperateMock.mock.calls[0];
      expect(input[0]).toBe("Transcribe page 1 of 1.");
      expect(input[1].file).toBe("page.pdf");
      expect(input[1].data).toBeString();
      expect(options.format).toMatchObject({ type: "object" });
      expect(options.fallback).toBe(false);
      expect(options.turns).toBe(1);
      expect(result.emulated).toBe(true);
      expect(result.provider).toBe(PROVIDER.ANTHROPIC.NAME);
      expect(result.model).toBe(MODEL.HAIKU);
      expect(result.markdown).toBe("# Emulated");
      expect(result.pages[0]).toMatchObject({
        confidence: 0.9,
        page: 1,
        success: true,
      });
      expect(result.usage.pages).toBe(1);
      expect(result.usage.tokens).toHaveLength(1);
      expect(result.usage.cost).toBeGreaterThan(0);
    });

    it("Falls from a native engine to an emulated one", async () => {
      mistralOcrMock.mockRejectedValueOnce(
        new LlmUnrecoverableError("mistral down"),
      );
      const result = await Llm.ocr(FIXTURE_PDF, {
        model: [MODEL.MISTRAL.OCR, MODEL.HAIKU],
      });
      expect(mistralOcrMock).toHaveBeenCalledTimes(1);
      expect(anthropicOperateMock).toHaveBeenCalledTimes(1);
      // The fallback runs its own model, never the primary's
      expect(anthropicOperateMock.mock.calls[0][1].model).toBeUndefined();
      expect(result.emulated).toBe(true);
      expect(result.fallbackAttempts).toBe(2);
      expect(result.fallbackUsed).toBe(true);
    });

    it("Falls from an emulated engine to a native one on unreadable content", async () => {
      anthropicOperateMock.mockResolvedValueOnce(operateResponse("not json"));
      const result = await Llm.ocr(FIXTURE_PDF, {
        model: [MODEL.HAIKU, MODEL.MISTRAL.OCR],
      });
      expect(anthropicOperateMock).toHaveBeenCalledTimes(1);
      expect(mistralOcrMock).toHaveBeenCalledTimes(1);
      expect(result.emulated).toBe(false);
      expect(result.provider).toBe(PROVIDER.MISTRAL.NAME);
      expect(result.fallbackUsed).toBe(true);
    });

    it("Fetches a URL for an emulated engine", async () => {
      const buffer = Buffer.from("png");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          arrayBuffer: async () => buffer,
          ok: true,
          status: 200,
        }),
      );
      await Llm.ocr("https://x.test/scan.png", { model: MODEL.HAIKU });
      expect(fetch).toHaveBeenCalledWith("https://x.test/scan.png");
      const [input] = anthropicOperateMock.mock.calls[0];
      expect(input[1]).toEqual({
        data: buffer.toString("base64"),
        image: "scan.png",
      });
    });
  });

  describe("Error Conditions", () => {
    it("Moves on when a provider has neither ocr nor operate", async () => {
      const result = await Llm.ocr(DOCUMENT_URL, {
        model: [MODEL.JEV, MODEL.MISTRAL.OCR],
      });
      expect(result.provider).toBe(PROVIDER.MISTRAL.NAME);
      expect(result.fallbackUsed).toBe(true);
    });

    it("Throws NotImplementedError on an instance with neither", async () => {
      await expect(
        new Llm(PROVIDER.TYPESAFE.NAME).ocr(DOCUMENT_URL),
      ).rejects.toThrow(/neither ocr nor operate/);
    });

    it("Rethrows the last error when every engine fails", async () => {
      mistralOcrMock.mockRejectedValue(new LlmUnrecoverableError("one"));
      llamaCloudOcrMock.mockRejectedValue(new LlmUnrecoverableError("two"));
      await expect(
        Llm.ocr(DOCUMENT_URL, {
          model: [MODEL.MISTRAL.OCR, MODEL.LLAMAPARSE.AGENTIC],
        }),
      ).rejects.toThrow("two");
    });
  });
});
