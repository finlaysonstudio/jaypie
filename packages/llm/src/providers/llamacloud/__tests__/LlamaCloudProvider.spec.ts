import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MODEL, PROVIDER } from "../../../constants.js";
import {
  LlmAbortError,
  LlmTransientError,
  LlmUnrecoverableError,
} from "../../../errors/LlmError.js";
import { LlamaCloudClient } from "../client.js";
import { LlamaCloudProvider } from "../LlamaCloudProvider.class.js";

vi.mock("@jaypie/aws", () => ({
  getEnvSecret: vi.fn().mockResolvedValue("_MOCK_LLAMA_KEY"),
}));

vi.mock("../client.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../client.js")>();
  return { ...actual, LlamaCloudClient: vi.fn() };
});

vi.mock("../../../util/abortableSleep.js", () => ({
  abortableSleep: vi.fn().mockResolvedValue(undefined),
}));

const DOCUMENT_URL = "https://x.test/scan.pdf";

const COMPLETED_RESULT = {
  images_content_metadata: {
    images: [
      {
        content_type: "image/png",
        filename: "image_0.png",
        index: 0,
        presigned_url: "https://signed.test/image_0.png",
      },
    ],
    total_count: 1,
  },
  job: { id: "pjb-1", status: "COMPLETED", usage: { credits: 20 } },
  markdown: {
    pages: [
      { header: "H", markdown: "# One", page_number: 1, success: true },
      { error: "unreadable", page_number: 2, success: false },
    ],
  },
};

function mockClient({
  createParse = vi.fn().mockResolvedValue({ id: "pjb-1", status: "PENDING" }),
  fetchImage = vi.fn().mockResolvedValue({
    data: "data:image/png;base64,AA",
    mimeType: "image/png",
  }),
  getParse = vi.fn().mockResolvedValue(COMPLETED_RESULT),
  uploadParse = vi.fn().mockResolvedValue({ id: "pjb-1", status: "PENDING" }),
} = {}) {
  vi.mocked(LlamaCloudClient).mockImplementation(
    class {
      createParse = createParse;
      fetchImage = fetchImage;
      getParse = getParse;
      uploadParse = uploadParse;
    } as any,
  );
  return { createParse, fetchImage, getParse, uploadParse };
}

describe("LlamaCloudProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Works", () => {
    expect(LlamaCloudProvider).toBeClass();
    expect(new LlamaCloudProvider()).toBeInstanceOf(LlamaCloudProvider);
  });

  describe("Base Cases", () => {
    it("Defaults to the agentic tier", () => {
      expect(new LlamaCloudProvider()["model"]).toBe(MODEL.LLAMAPARSE.AGENTIC);
    });

    it("Does not implement send", async () => {
      await expect(new LlamaCloudProvider().send()).rejects.toThrow(
        /extracts documents only/,
      );
    });
  });

  describe("Happy Paths", () => {
    it("Submits a URL as source_url with tier and pinned version", async () => {
      const { createParse, uploadParse } = mockClient();
      await new LlamaCloudProvider().ocr(DOCUMENT_URL);
      expect(uploadParse).not.toHaveBeenCalled();
      const [configuration] = createParse.mock.calls[0];
      expect(configuration).toEqual({
        source_url: DOCUMENT_URL,
        tier: "agentic",
        version: PROVIDER.LLAMACLOUD.VERSION.agentic,
      });
    });

    it("Uploads bytes as multipart", async () => {
      const { createParse, uploadParse } = mockClient();
      await new LlamaCloudProvider().ocr({
        data: Buffer.from("%PDF").toString("base64"),
        file: "scan.pdf",
      });
      expect(createParse).not.toHaveBeenCalled();
      const [upload] = uploadParse.mock.calls[0];
      expect(upload.filename).toBe("scan.pdf");
      expect(upload.mimeType).toBe("application/pdf");
      expect(upload.buffer.toString()).toBe("%PDF");
      expect(upload.configuration.tier).toBe("agentic");
    });

    it("Polls until the job is terminal, then fetches with expand", async () => {
      const getParse = vi
        .fn()
        .mockResolvedValueOnce({ job: { id: "pjb-1", status: "PENDING" } })
        .mockResolvedValueOnce({ job: { id: "pjb-1", status: "RUNNING" } })
        .mockResolvedValueOnce({ job: { id: "pjb-1", status: "COMPLETED" } })
        .mockResolvedValueOnce(COMPLETED_RESULT);
      mockClient({ getParse });
      const response = await new LlamaCloudProvider().ocr(DOCUMENT_URL);
      expect(getParse).toHaveBeenCalledTimes(4);
      expect(getParse.mock.calls[0][1].expand).toBeUndefined();
      expect(getParse.mock.calls[3][1].expand).toEqual(["markdown", "usage"]);
      expect(response.pages).toHaveLength(2);
    });

    it("Skips polling when the submit response is already complete", async () => {
      const { getParse } = mockClient({
        createParse: vi
          .fn()
          .mockResolvedValue({ id: "pjb-1", status: "COMPLETED" }),
      });
      await new LlamaCloudProvider().ocr(DOCUMENT_URL);
      expect(getParse).toHaveBeenCalledTimes(1);
    });

    it("Returns the common shape with failed pages, credits, and cost", async () => {
      mockClient();
      const response = await new LlamaCloudProvider().ocr(DOCUMENT_URL);
      expect(response.markdown).toBe("# One\n\n");
      expect(response.pages[0]).toMatchObject({
        header: "H",
        markdown: "# One",
        page: 1,
        success: true,
      });
      expect(response.pages[1]).toMatchObject({
        error: "unreadable",
        markdown: "",
        page: 2,
        success: false,
      });
      expect(response.model).toBe(
        `${MODEL.LLAMAPARSE.AGENTIC}@${PROVIDER.LLAMACLOUD.VERSION.agentic}`,
      );
      expect(response.provider).toBe(PROVIDER.LLAMACLOUD.NAME);
      expect(response.responses).toEqual([COMPLETED_RESULT]);
      expect(response.usage).toEqual({
        cost: 0.025,
        credits: 20,
        model: `${MODEL.LLAMAPARSE.AGENTIC}@${PROVIDER.LLAMACLOUD.VERSION.agentic}`,
        pages: 2,
        provider: PROVIDER.LLAMACLOUD.NAME,
      });
      // Images are listed from metadata without downloading
      expect(response.images).toEqual([
        { id: "image_0.png", mimeType: "image/png" },
      ]);
    });

    it("Falls back to the page price when credits are not yet recorded", async () => {
      mockClient({
        getParse: vi.fn().mockResolvedValue({
          ...COMPLETED_RESULT,
          job: { id: "pjb-1", status: "COMPLETED", usage: { credits: null } },
        }),
      });
      const response = await new LlamaCloudProvider().ocr(DOCUMENT_URL);
      expect(response.usage.credits).toBeUndefined();
      expect(response.usage.cost).toBeCloseTo(0.025);
    });

    it("Downloads images when asked", async () => {
      const { fetchImage, getParse } = mockClient();
      const response = await new LlamaCloudProvider().ocr(DOCUMENT_URL, {
        images: true,
      });
      expect(getParse.mock.calls.at(-1)?.[1].expand).toEqual([
        "markdown",
        "usage",
        "images_content_metadata",
      ]);
      expect(fetchImage).toHaveBeenCalledWith(
        "https://signed.test/image_0.png",
        expect.anything(),
      );
      expect(response.images[0].data).toBe("data:image/png;base64,AA");
    });

    it("Maps pages and tables onto the configuration", async () => {
      const { createParse } = mockClient();
      await new LlamaCloudProvider().ocr(DOCUMENT_URL, {
        pages: "1,3-4",
        tables: "html",
      });
      const [configuration] = createParse.mock.calls[0];
      expect(configuration.page_ranges).toEqual({ target_pages: "1,3,4" });
      expect(configuration.output_options).toEqual({
        markdown: { tables: { output_tables_as_markdown: false } },
      });
    });

    it("Spreads providerOptions last and honors a version override", async () => {
      const { createParse, getParse } = mockClient();
      const response = await new LlamaCloudProvider().ocr(DOCUMENT_URL, {
        providerOptions: {
          agentic_options: { custom_prompt: "Transcribe verbatim" },
          disable_cache: true,
          version: "latest",
        },
      });
      const [configuration] = createParse.mock.calls[0];
      expect(configuration.version).toBe("latest");
      expect(configuration.disable_cache).toBe(true);
      expect(configuration.agentic_options).toEqual({
        custom_prompt: "Transcribe verbatim",
      });
      expect(response.model).toBe(`${MODEL.LLAMAPARSE.AGENTIC}@latest`);
      expect(getParse).toHaveBeenCalled();
    });

    it("Pins the version by tier", async () => {
      const { createParse } = mockClient();
      await new LlamaCloudProvider(MODEL.LLAMAPARSE.AGENTIC_PLUS).ocr(
        DOCUMENT_URL,
      );
      expect(createParse.mock.calls[0][0]).toMatchObject({
        tier: "agentic_plus",
        version: PROVIDER.LLAMACLOUD.VERSION.agentic_plus,
      });
    });

    it("Requests text on the fast tier and copies it into markdown", async () => {
      const getParse = vi.fn().mockResolvedValue({
        job: { id: "pjb-1", status: "COMPLETED", usage: { credits: 1 } },
        text: { pages: [{ page_number: 1, text: "plain words" }] },
      });
      const { createParse } = mockClient({ getParse });
      const response = await new LlamaCloudProvider(MODEL.LLAMAPARSE.FAST).ocr(
        DOCUMENT_URL,
      );
      expect(createParse.mock.calls[0][0].tier).toBe("fast");
      expect(getParse.mock.calls.at(-1)?.[1].expand).toEqual(["text", "usage"]);
      expect(response.markdown).toBe("plain words");
      expect(response.pages[0].success).toBe(true);
    });

    it("Prefers an explicit per-call model for the tier", async () => {
      const { createParse } = mockClient();
      await new LlamaCloudProvider().ocr(DOCUMENT_URL, {
        model: MODEL.LLAMAPARSE.COST_EFFECTIVE,
      });
      expect(createParse.mock.calls[0][0].tier).toBe("cost_effective");
    });
  });

  describe("Error Conditions", () => {
    it("Rejects an unknown tier before any request", async () => {
      const { createParse } = mockClient();
      await expect(
        new LlamaCloudProvider("llamaparse-turbo").ocr(DOCUMENT_URL),
      ).rejects.toThrow(/Unknown LlamaParse tier/);
      expect(createParse).not.toHaveBeenCalled();
    });

    it.each([
      ["instructions", { instructions: "Classify it" }],
      ["format", { format: { taco: String } }],
    ])(
      "Rejects %s before any request so a chain moves on",
      async (_name, options) => {
        const { createParse, uploadParse } = mockClient();
        await expect(
          new LlamaCloudProvider().ocr(DOCUMENT_URL, options),
        ).rejects.toThrow(/does not support OCR instructions or format/);
        expect(createParse).not.toHaveBeenCalled();
        expect(uploadParse).not.toHaveBeenCalled();
      },
    );

    it("Throws unrecoverable with the error message on FAILED", async () => {
      mockClient({
        getParse: vi.fn().mockResolvedValue({
          job: { error_message: "corrupt pdf", id: "pjb-1", status: "FAILED" },
        }),
      });
      await expect(new LlamaCloudProvider().ocr(DOCUMENT_URL)).rejects.toThrow(
        LlmUnrecoverableError,
      );
      await expect(new LlamaCloudProvider().ocr(DOCUMENT_URL)).rejects.toThrow(
        /corrupt pdf/,
      );
    });

    it("Throws an abort error on CANCELLED", async () => {
      mockClient({
        getParse: vi
          .fn()
          .mockResolvedValue({ job: { id: "pjb-1", status: "CANCELLED" } }),
      });
      await expect(new LlamaCloudProvider().ocr(DOCUMENT_URL)).rejects.toThrow(
        LlmAbortError,
      );
    });

    it("Throws transient when the job outlives the timeout", async () => {
      mockClient({
        getParse: vi
          .fn()
          .mockResolvedValue({ job: { id: "pjb-1", status: "RUNNING" } }),
      });
      await expect(
        new LlamaCloudProvider().ocr(DOCUMENT_URL, { timeout: 0 }),
      ).rejects.toThrow(LlmTransientError);
    });

    it("Throws an abort error when the signal aborts mid-poll", async () => {
      const controller = new AbortController();
      const getParse = vi.fn().mockImplementation(async () => {
        controller.abort();
        return { job: { id: "pjb-1", status: "RUNNING" } };
      });
      mockClient({ getParse });
      await expect(
        new LlamaCloudProvider().ocr(DOCUMENT_URL, {
          signal: controller.signal,
        }),
      ).rejects.toThrow(LlmAbortError);
    });
  });
});
