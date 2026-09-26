import { InternalError, NotImplementedError } from "@jaypie/errors";
import { PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MODEL } from "../../constants.js";
import {
  LlmAbortError,
  LlmTransientError,
  LlmUnrecoverableError,
} from "../../errors/LlmError.js";
import { LlmOcrResolvedDocument } from "../../types/LlmOcr.interface.js";
import {
  LlmOperateResponse,
  LlmProvider,
} from "../../types/LlmProvider.interface.js";
import { getPdfPageCount } from "../../upload/index.js";
import {
  buildOcrFormat,
  buildOcrPrompt,
  emulateOcr,
  parseOcrContent,
} from "../OcrEmulator.js";

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

const PROVIDER_NAME = "anthropic";

async function makePdf(pages: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    doc.addPage();
  }
  return Buffer.from(await doc.save());
}

function pdfDocument(buffer: Buffer): LlmOcrResolvedDocument {
  return {
    filename: "scan.pdf",
    mimeType: "application/pdf",
    source: { buffer, kind: "data" },
  };
}

function operateResponse(
  content: LlmOperateResponse["content"],
  extra: Partial<LlmOperateResponse> = {},
): LlmOperateResponse {
  return {
    content,
    history: [],
    model: MODEL.HAIKU,
    output: [],
    provider: PROVIDER_NAME,
    reasoning: [],
    responses: [{ id: "r" }],
    status: "completed" as LlmOperateResponse["status"],
    usage: [
      {
        input: 10,
        model: MODEL.HAIKU,
        output: 5,
        provider: PROVIDER_NAME,
        reasoning: 0,
        total: 15,
      },
    ],
    ...extra,
  };
}

function page(markdown: string, confidence = 0.9) {
  return operateResponse({ confidence, markdown, notes: "" });
}

let operate: ReturnType<typeof vi.fn>;
let provider: LlmProvider;

describe("OcrEmulator", () => {
  beforeEach(() => {
    operate = vi.fn().mockResolvedValue(page("# Page"));
    provider = { operate, send: vi.fn() } as unknown as LlmProvider;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Works", () => {
    expect(buildOcrFormat).toBeFunction();
    expect(buildOcrPrompt).toBeFunction();
    expect(emulateOcr).toBeFunction();
    expect(parseOcrContent).toBeFunction();
  });

  describe("buildOcrPrompt", () => {
    it("Asks for markdown tables by default", () => {
      const prompt = buildOcrPrompt();
      expect(prompt).toContain("[UNCLEAR:");
      expect(prompt).toContain("[ELEMENT:");
      expect(prompt).toContain("Markdown tables");
      expect(prompt).not.toContain("<table>");
    });

    it("Asks for HTML tables when told", () => {
      expect(buildOcrPrompt({ tables: "html" })).toContain("<table>");
    });
  });

  describe("buildOcrFormat", () => {
    it("Requires markdown, confidence, and notes with no extra keys", () => {
      const format = buildOcrFormat();
      expect(format.required).toEqual(["confidence", "markdown", "notes"]);
      expect(format.additionalProperties).toBe(false);
      expect(
        (format.properties as Record<string, { type: string }>).markdown.type,
      ).toBe("string");
    });
  });

  describe("parseOcrContent", () => {
    it("Reads an object", () => {
      const parsed = parseOcrContent({
        content: { confidence: 0.5, markdown: "hi", notes: "" },
        page: 1,
      });
      expect(parsed.markdown).toBe("hi");
      expect(parsed.confidence).toBe(0.5);
    });

    it("Reads a JSON string", () => {
      const parsed = parseOcrContent({
        content: JSON.stringify({ confidence: "0.7", markdown: "hi" }),
        page: 1,
      });
      expect(parsed.markdown).toBe("hi");
      expect(parsed.confidence).toBe(0.7);
    });

    it("Clamps confidence and tolerates its absence", () => {
      expect(
        parseOcrContent({ content: { confidence: 7, markdown: "" }, page: 1 })
          .confidence,
      ).toBe(1);
      expect(
        parseOcrContent({ content: { markdown: "" }, page: 1 }).confidence,
      ).toBeUndefined();
    });

    it("Throws InternalError on unreadable content", () => {
      expect(() => parseOcrContent({ content: "nope", page: 2 })).toThrow(
        InternalError,
      );
      expect(() => parseOcrContent({ content: [], page: 2 })).toThrow(
        InternalError,
      );
      expect(() =>
        parseOcrContent({ content: { confidence: 1 }, page: 2 }),
      ).toThrow(/no markdown for page 2/);
    });
  });

  describe("emulateOcr", () => {
    it("Sends a single-page PDF as is", async () => {
      const buffer = await makePdf(1);
      const result = await emulateOcr({
        document: pdfDocument(buffer),
        options: {},
        provider,
        providerName: PROVIDER_NAME,
      });
      expect(operate).toHaveBeenCalledTimes(1);
      const [input, options] = operate.mock.calls[0];
      expect(input[0]).toBe("Transcribe page 1 of 1.");
      expect(input[1]).toEqual({
        data: buffer.toString("base64"),
        file: "scan.pdf",
      });
      expect(options).toMatchObject({
        fallback: false,
        placeholders: { input: false, system: false },
        temperature: 0,
        turns: 1,
      });
      expect(options.system).toBe(buildOcrPrompt());
      expect(result).toMatchObject({
        emulated: true,
        fallbackAttempts: 1,
        fallbackUsed: false,
        markdown: "# Page",
        model: MODEL.HAIKU,
        provider: PROVIDER_NAME,
      });
      expect(result.pages).toEqual([
        {
          confidence: 0.9,
          images: [],
          markdown: "# Page",
          page: 1,
          raw: {
            confidence: 0.9,
            markdown: "# Page",
            notes: "",
            transcriptions: 1,
          },
          success: true,
        },
      ]);
      expect(result.usage).toMatchObject({
        model: MODEL.HAIKU,
        pages: 1,
        provider: PROVIDER_NAME,
      });
      expect(result.usage.tokens).toHaveLength(1);
      expect(result.usage.cost).toBeGreaterThan(0);
    });

    it("Splits a PDF one page per call and keeps page order", async () => {
      const buffer = await makePdf(3);
      operate.mockImplementation(async (input: string[]) =>
        page(`page ${input[0].match(/page (\d)/)?.[1]}`),
      );
      const result = await emulateOcr({
        document: pdfDocument(buffer),
        options: {},
        provider,
        providerName: PROVIDER_NAME,
      });
      expect(operate).toHaveBeenCalledTimes(3);
      expect(result.pages.map((item) => item.page)).toEqual([1, 2, 3]);
      expect(result.markdown).toBe("page 1\n\npage 2\n\npage 3");
      for (const [input] of operate.mock.calls) {
        const sent = Buffer.from(input[1].data, "base64");
        expect(await getPdfPageCount(sent)).toBe(1);
      }
      expect(result.usage.pages).toBe(3);
      expect(result.usage.tokens).toHaveLength(3);
      expect(result.responses).toHaveLength(3);
    });

    it("Honors a page selection", async () => {
      const buffer = await makePdf(4);
      const result = await emulateOcr({
        document: pdfDocument(buffer),
        options: { pages: "2,4" },
        provider,
        providerName: PROVIDER_NAME,
      });
      expect(operate).toHaveBeenCalledTimes(2);
      expect(operate.mock.calls[0][0][0]).toBe("Transcribe page 2 of 4.");
      expect(operate.mock.calls[1][0][0]).toBe("Transcribe page 4 of 4.");
      expect(result.pages.map((item) => item.page)).toEqual([2, 4]);
    });

    it("Sends an image as an image input", async () => {
      const buffer = Buffer.from("png");
      await emulateOcr({
        document: {
          filename: "scan.png",
          mimeType: "image/png",
          source: { buffer, kind: "data" },
        },
        options: {},
        provider,
        providerName: PROVIDER_NAME,
      });
      const [input] = operate.mock.calls[0];
      expect(input[0]).toBe("Transcribe this page.");
      expect(input[1]).toEqual({
        data: buffer.toString("base64"),
        image: "scan.png",
      });
    });

    it("Fetches a URL document", async () => {
      const buffer = await makePdf(1);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          arrayBuffer: async () => buffer,
          ok: true,
          status: 200,
        }),
      );
      await emulateOcr({
        document: {
          filename: "scan.pdf",
          mimeType: "application/pdf",
          source: { kind: "url", url: "https://x.test/scan.pdf" },
        },
        options: {},
        provider,
        providerName: PROVIDER_NAME,
      });
      expect(fetch).toHaveBeenCalledWith("https://x.test/scan.pdf");
      expect(operate).toHaveBeenCalledTimes(1);
    });

    it("Passes the html table rule, model, retry, signal, and user through", async () => {
      const signal = new AbortController().signal;
      await emulateOcr({
        document: pdfDocument(await makePdf(1)),
        options: {
          model: MODEL.HAIKU,
          retry: { rateLimit: false },
          signal,
          tables: "html",
          user: "u",
        },
        provider,
        providerName: PROVIDER_NAME,
      });
      const [, options] = operate.mock.calls[0];
      expect(options.system).toContain("<table>");
      expect(options.model).toBe(MODEL.HAIKU);
      expect(options.retry).toEqual({ rateLimit: false });
      expect(options.user).toBe("u");
      // The emulator's own signal wraps the caller's so one failure can
      // stop the pages still in flight
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(options.signal).not.toBe(signal);
    });

    it("Transcribes a low-confidence page again and keeps the higher score", async () => {
      operate
        .mockResolvedValueOnce(page("first", 0.2))
        .mockResolvedValueOnce(page("second", 0.8));
      const result = await emulateOcr({
        document: pdfDocument(await makePdf(1)),
        options: {},
        provider,
        providerName: PROVIDER_NAME,
      });
      expect(operate).toHaveBeenCalledTimes(2);
      expect(result.pages[0].markdown).toBe("second");
      expect(result.pages[0].confidence).toBe(0.8);
      expect(result.pages[0].raw.transcriptions).toBe(2);
      expect(result.usage.tokens).toHaveLength(2);
      expect(result.responses).toHaveLength(2);
    });

    it("Keeps the first transcription when the second scores no higher", async () => {
      operate
        .mockResolvedValueOnce(page("first", 0.3))
        .mockResolvedValueOnce(page("second", 0.1));
      const result = await emulateOcr({
        document: pdfDocument(await makePdf(1)),
        options: {},
        provider,
        providerName: PROVIDER_NAME,
      });
      expect(result.pages[0].markdown).toBe("first");
    });

    it("Caps pages in flight at concurrency", async () => {
      let inFlight = 0;
      let peak = 0;
      operate.mockImplementation(async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
        return page("p");
      });
      await emulateOcr({
        document: pdfDocument(await makePdf(5)),
        options: { concurrency: 2 },
        provider,
        providerName: PROVIDER_NAME,
      });
      expect(operate).toHaveBeenCalledTimes(5);
      expect(peak).toBe(2);
    });

    it("Leaves cost undefined for an unpriced model", async () => {
      operate.mockResolvedValue(
        operateResponse(
          { confidence: 1, markdown: "p", notes: "" },
          {
            model: "mystery",
            usage: [
              { input: 1, model: "mystery", output: 1, reasoning: 0, total: 2 },
            ],
          },
        ),
      );
      const result = await emulateOcr({
        document: pdfDocument(await makePdf(1)),
        options: {},
        provider,
        providerName: PROVIDER_NAME,
      });
      expect(result.model).toBe("mystery");
      expect(result.usage.cost).toBeUndefined();
    });

    it("Makes no answer call without instructions or format", async () => {
      const result = await emulateOcr({
        document: pdfDocument(await makePdf(2)),
        options: {},
        provider,
        providerName: PROVIDER_NAME,
      });
      expect(operate).toHaveBeenCalledTimes(2);
      expect(result.content).toBeUndefined();
    });

    it("Answers instructions and format in one call over the whole document", async () => {
      operate
        .mockResolvedValueOnce(page("First page"))
        .mockResolvedValueOnce(page("Second page"))
        .mockResolvedValueOnce(operateResponse({ category: "deed" }));
      const result = await emulateOcr({
        document: pdfDocument(await makePdf(2)),
        options: {
          format: { category: ["deed", "invoice"] },
          instructions: "Classify the document",
        },
        provider,
        providerName: PROVIDER_NAME,
      });
      expect(operate).toHaveBeenCalledTimes(3);
      const [input, options] = operate.mock.calls[2];
      expect(input).toContain("First page");
      expect(input).toContain("Second page");
      expect(options.format).toEqual({ category: ["deed", "invoice"] });
      expect(options.model).toBe(MODEL.HAIKU);
      expect(input).toMatch(/<\/document>\n\nClassify the document$/);
      expect(result.content).toEqual({ category: "deed" });
      expect(result.markdown).toBe("First page\n\nSecond page");
      expect(result.responses).toHaveLength(3);
      expect(result.usage.tokens).toHaveLength(3);
    });

    it("Answers bare instructions as a string", async () => {
      operate
        .mockResolvedValueOnce(page("Only page"))
        .mockResolvedValueOnce(operateResponse("A one-page deed"));
      const result = await emulateOcr({
        document: pdfDocument(await makePdf(1)),
        options: { instructions: "Describe it" },
        provider,
        providerName: PROVIDER_NAME,
      });
      expect(operate.mock.calls[1][1].format).toBeUndefined();
      expect(result.content).toBe("A one-page deed");
    });
  });

  describe("Error Conditions", () => {
    it("Throws NotImplementedError without operate", async () => {
      await expect(
        emulateOcr({
          document: pdfDocument(await makePdf(1)),
          options: {},
          provider: { send: vi.fn() } as unknown as LlmProvider,
          providerName: "typesafe",
        }),
      ).rejects.toThrow(NotImplementedError);
    });

    it("Throws on unreadable content so a chain moves on", async () => {
      operate.mockResolvedValue(operateResponse("not json"));
      await expect(
        emulateOcr({
          document: pdfDocument(await makePdf(1)),
          options: {},
          provider,
          providerName: PROVIDER_NAME,
        }),
      ).rejects.toThrow(InternalError);
    });

    it("Throws the error a settled operate response carries", async () => {
      operate.mockResolvedValue(
        operateResponse(undefined, {
          error: new LlmUnrecoverableError("refused"),
          status: "error" as LlmOperateResponse["status"],
        }),
      );
      await expect(
        emulateOcr({
          document: pdfDocument(await makePdf(1)),
          options: {},
          provider,
          providerName: PROVIDER_NAME,
        }),
      ).rejects.toThrow("refused");
    });

    it("Wraps a settled error body so the chain sees its detail", async () => {
      // The loop's own stops (a provider cut the response short) settle a
      // plain error body rather than an Error instance
      operate.mockResolvedValue(
        operateResponse('{"markdown": "Half', {
          error: {
            detail: "Model stopped before finishing: content_filter",
            status: 502,
            title: "Incomplete Response",
          },
          status: "incomplete" as LlmOperateResponse["status"],
        }),
      );
      const thrown = await emulateOcr({
        document: pdfDocument(await makePdf(1)),
        options: {},
        provider,
        providerName: PROVIDER_NAME,
      }).catch((error: unknown) => error);
      expect(thrown).toBeInstanceOf(LlmUnrecoverableError);
      expect((thrown as Error).message).toBe(
        "Model stopped before finishing: content_filter",
      );
    });

    it("Stops the remaining pages after the first failure", async () => {
      let calls = 0;
      operate.mockImplementation(async (_input: unknown, options: any) => {
        calls += 1;
        if (calls === 1) {
          throw new LlmUnrecoverableError("first page failed");
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
        if (options.signal.aborted) {
          throw new LlmAbortError("aborted");
        }
        return page("p");
      });
      await expect(
        emulateOcr({
          document: pdfDocument(await makePdf(6)),
          options: { concurrency: 2 },
          provider,
          providerName: PROVIDER_NAME,
        }),
      ).rejects.toThrow("first page failed");
      // Two workers: the first fails at once, the second is already in
      // flight, and nothing further starts
      expect(calls).toBeLessThan(6);
    });

    it("Throws LlmAbortError when the caller aborts", async () => {
      const controller = new AbortController();
      operate.mockImplementation(async () => {
        controller.abort();
        throw new LlmAbortError("stop");
      });
      await expect(
        emulateOcr({
          document: pdfDocument(await makePdf(1)),
          options: { signal: controller.signal },
          provider,
          providerName: PROVIDER_NAME,
        }),
      ).rejects.toThrow(LlmAbortError);
    });

    it("Classifies a failed URL fetch", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 404 }),
      );
      const document: LlmOcrResolvedDocument = {
        filename: "scan.pdf",
        mimeType: "application/pdf",
        source: { kind: "url", url: "https://x.test/scan.pdf" },
      };
      await expect(
        emulateOcr({ document, options: {}, provider, providerName: "p" }),
      ).rejects.toThrow(LlmUnrecoverableError);

      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("ECONNRESET")),
      );
      await expect(
        emulateOcr({ document, options: {}, provider, providerName: "p" }),
      ).rejects.toThrow(LlmTransientError);
    });
  });
});
