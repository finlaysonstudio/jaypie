import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Llm from "../Llm.js";
import { MODEL, PROVIDER } from "../constants.js";
import { LlmUnrecoverableError } from "../errors/LlmError.js";
import { LlamaCloudProvider } from "../providers/llamacloud/index.js";
import { LlmOcrResponse } from "../types/LlmOcr.interface.js";

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
      operate = vi.fn();
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

function response(
  provider: string,
  model: string,
): Omit<LlmOcrResponse, "fallbackAttempts" | "fallbackUsed"> {
  return {
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

describe("Llm.ocr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mistralOcrMock.mockResolvedValue(
      response(PROVIDER.MISTRAL.NAME, MODEL.MISTRAL.OCR),
    );
    llamaCloudOcrMock.mockResolvedValue(
      response(PROVIDER.LLAMACLOUD.NAME, MODEL.LLAMAPARSE.AGENTIC),
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

  describe("Error Conditions", () => {
    it("Moves on when a chat provider cannot ocr", async () => {
      const result = await Llm.ocr(DOCUMENT_URL, {
        model: [MODEL.SONNET, MODEL.MISTRAL.OCR],
      });
      expect(result.provider).toBe(PROVIDER.MISTRAL.NAME);
      expect(result.fallbackUsed).toBe(true);
    });

    it("Throws NotImplementedError on a chat-only instance", async () => {
      await expect(
        new Llm(PROVIDER.ANTHROPIC.NAME).ocr(DOCUMENT_URL),
      ).rejects.toThrow(/does not support ocr/);
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
