import { getEnvSecret } from "@jaypie/aws";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MistralProvider } from "../MistralProvider.class";
import { MistralClient } from "../client.js";
import { DEFAULT_BBOX_ANNOTATION_FORMAT } from "../ocrPage.js";
import {
  MODEL,
  PAGE_COST,
  PAGE_COST_ANNOTATED,
  PROVIDER,
} from "../../../constants.js";
import { LlmUnrecoverableError } from "../../../errors/LlmError.js";

// Mock the Mistral client
vi.mock("../client.js");

// Mock the OperateLoop for conversation history tests
vi.mock("../../../operate/index.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    createOperateLoop: vi.fn(() => ({
      execute: vi.fn(),
    })),
  };
});

vi.mock("@jaypie/aws", async () => {
  const actual = await vi.importActual("@jaypie/aws");
  const module = {
    ...actual,
    getEnvSecret: vi.fn(() => "MOCK_VALUE"),
  };
  return module;
});

describe("MistralProvider", () => {
  beforeEach(() => {
    vi.mocked(MistralClient).mockImplementation(
      class {
        chatCompletion = vi.fn();
      } as any,
    );
    vi.mocked(getEnvSecret).mockResolvedValue("test-mistral-key");
  });

  describe("Base Cases", () => {
    it("is a Class", () => {
      expect(MistralProvider).toBeFunction();
    });

    it("Works", () => {
      const provider = new MistralProvider();
      expect(provider).toBeInstanceOf(MistralProvider);
    });

    it("defaults to the Mistral default model", () => {
      const provider = new MistralProvider();
      expect(provider["model"]).toBe(PROVIDER.MISTRAL.DEFAULT);
    });

    it("accepts a custom model", () => {
      const provider = new MistralProvider(MODEL.MISTRAL.SMALL);
      expect(provider["model"]).toBe(MODEL.MISTRAL.SMALL);
    });
  });

  describe("Error Conditions", () => {
    beforeEach(() => {
      vi.mocked(getEnvSecret).mockResolvedValue(null as unknown as string);
    });

    it("throws ConfigurationError when API key is missing", async () => {
      const provider = new MistralProvider();
      expect(async () => provider.send("test")).toThrowConfigurationError();
    });
  });

  describe("Happy Paths", () => {
    beforeEach(() => {
      vi.mocked(getEnvSecret).mockResolvedValue("test-mistral-key");
    });

    it("sends messages using the Mistral client", async () => {
      const mockChatCompletion = vi.fn().mockResolvedValue({
        choices: [{ message: { content: "test response from mistral" } }],
      });
      vi.mocked(MistralClient).mockImplementation(
        class {
          chatCompletion = mockChatCompletion;
        } as any,
      );

      const provider = new MistralProvider();
      const response = await provider.send("test message");

      expect(response).toBe("test response from mistral");
      expect(mockChatCompletion).toHaveBeenCalledWith({
        model: PROVIDER.MISTRAL.DEFAULT,
        messages: [{ role: "user", content: "test message" }],
      });
    });

    it("initializes the Mistral client with the resolved API key", async () => {
      const mockChatCompletion = vi.fn().mockResolvedValue({
        choices: [{ message: { content: "response" } }],
      });
      vi.mocked(MistralClient).mockImplementation(
        class {
          chatCompletion = mockChatCompletion;
        } as any,
      );

      const provider = new MistralProvider();
      await provider.send("test");

      expect(MistralClient).toHaveBeenCalledWith({
        apiKey: "test-mistral-key",
      });
    });

    it("resolves MISTRAL_API_KEY from environment", async () => {
      const mockChatCompletion = vi.fn().mockResolvedValue({
        choices: [{ message: { content: "response" } }],
      });
      vi.mocked(MistralClient).mockImplementation(
        class {
          chatCompletion = mockChatCompletion;
        } as any,
      );

      const provider = new MistralProvider();
      await provider.send("test");

      expect(getEnvSecret).toHaveBeenCalledWith(PROVIDER.MISTRAL.API_KEY);
    });

    it("includes a system message when provided", async () => {
      const mockChatCompletion = vi.fn().mockResolvedValue({
        choices: [{ message: { content: "response" } }],
      });
      vi.mocked(MistralClient).mockImplementation(
        class {
          chatCompletion = mockChatCompletion;
        } as any,
      );

      const provider = new MistralProvider();
      await provider.send("test", { system: "Be helpful" });

      expect(mockChatCompletion).toHaveBeenCalledWith({
        model: PROVIDER.MISTRAL.DEFAULT,
        messages: [
          { role: "system", content: "Be helpful" },
          { role: "user", content: "test" },
        ],
      });
    });

    it("joins text chunks when reasoning returns array content", async () => {
      const mockChatCompletion = vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: [
                {
                  type: "thinking",
                  thinking: [{ type: "text", text: "let me think" }],
                  closed: true,
                },
                { type: "text", text: "391" },
              ],
            },
          },
        ],
      });
      vi.mocked(MistralClient).mockImplementation(
        class {
          chatCompletion = mockChatCompletion;
        } as any,
      );

      const provider = new MistralProvider();
      const response = await provider.send("What is 17*23?");

      expect(response).toBe("391");
      expect(response).not.toContain("let me think");
    });

    it("parses JSON content when structured response is requested", async () => {
      const mockChatCompletion = vi.fn().mockResolvedValue({
        choices: [{ message: { content: '{"capital":"Paris"}' } }],
      });
      vi.mocked(MistralClient).mockImplementation(
        class {
          chatCompletion = mockChatCompletion;
        } as any,
      );

      const provider = new MistralProvider();
      const response = await provider.send("test", {
        response: { capital: String },
      });

      expect(response).toEqual({ capital: "Paris" });
    });

    it("delegates operate to the operate loop", async () => {
      const { createOperateLoop } = await import("../../../operate/index.js");
      const mockExecute = vi.fn().mockResolvedValue({
        content: "loop response",
        history: [],
      });
      vi.mocked(createOperateLoop).mockReturnValue({
        execute: mockExecute,
      } as any);

      const provider = new MistralProvider();
      const response = await provider.operate("test input");

      expect(mockExecute).toHaveBeenCalledWith("test input", {
        model: PROVIDER.MISTRAL.DEFAULT,
      });
      expect(response.content).toBe("loop response");
    });
  });

  describe("Features", () => {
    describe("OCR", () => {
      const DOCUMENT_URL = "https://x.test/scan.pdf";

      function mockOcrClient(raw: unknown) {
        const mockOcr = vi.fn().mockResolvedValue(raw);
        vi.mocked(MistralClient).mockImplementation(
          class {
            ocr = mockOcr;
          } as any,
        );
        return mockOcr;
      }

      it("Returns the common OCR shape with 1-indexed pages", async () => {
        const raw = {
          model: MODEL.MISTRAL.OCR,
          pages: [
            {
              images: [{ id: "img-0.jpeg", image_base64: "AAAA" }],
              index: 0,
              markdown: "# Page One",
              header: "Header",
            },
            { index: 1, markdown: "Page two body", footer: "Footer" },
          ],
          usage_info: { pages_processed: 2 },
        };
        mockOcrClient(raw);

        const provider = new MistralProvider();
        const result = await provider.ocr(DOCUMENT_URL);

        expect(result.markdown).toBe("# Page One\n\nPage two body");
        expect(result.pages).toHaveLength(2);
        expect(result.pages[0].page).toBe(1);
        expect(result.pages[0].header).toBe("Header");
        expect(result.pages[0].raw).toBe(raw.pages[0]);
        expect(result.pages[0].success).toBe(true);
        expect(result.pages[1].page).toBe(2);
        expect(result.pages[1].footer).toBe("Footer");
        expect(result.images).toEqual([
          {
            data: "data:image/jpeg;base64,AAAA",
            id: "img-0.jpeg",
            mimeType: "image/jpeg",
            page: 1,
          },
        ]);
        expect(result.model).toBe(MODEL.MISTRAL.OCR);
        expect(result.provider).toBe(PROVIDER.MISTRAL.NAME);
        expect(result.responses).toEqual([raw]);
        expect(result.fallbackAttempts).toBe(1);
        expect(result.fallbackUsed).toBe(false);
        expect(result.usage).toEqual({
          cost: 0.01,
          model: MODEL.MISTRAL.OCR,
          pages: 2,
          provider: PROVIDER.MISTRAL.NAME,
        });
      });

      it("Sends a URL as document_url and defaults to the OCR model", async () => {
        const mockOcr = mockOcrClient({ pages: [] });
        const provider = new MistralProvider();
        await provider.ocr(DOCUMENT_URL);
        const [request] = mockOcr.mock.calls[0];
        expect(request.document).toEqual({
          document_name: "scan.pdf",
          document_url: DOCUMENT_URL,
          type: "document_url",
        });
        expect(request.model).toBe(MODEL.MISTRAL.OCR);
      });

      it("Sends image bytes as image_url", async () => {
        const mockOcr = mockOcrClient({ pages: [] });
        const provider = new MistralProvider();
        await provider.ocr({
          data: Buffer.from("png").toString("base64"),
          image: "photo.png",
        });
        const [request] = mockOcr.mock.calls[0];
        expect(request.document.type).toBe("image_url");
        expect(request.document.image_url).toMatch(/^data:image\/png;base64,/);
      });

      it("Converts 1-indexed pages to the 0-indexed wire form", async () => {
        const mockOcr = mockOcrClient({ pages: [] });
        const provider = new MistralProvider();
        await provider.ocr(DOCUMENT_URL, { pages: "1,3-4" });
        expect(mockOcr.mock.calls[0][0].pages).toEqual([0, 2, 3]);
      });

      it("Maps tables, images, and providerOptions onto the request", async () => {
        const mockOcr = mockOcrClient({ pages: [] });
        const provider = new MistralProvider();
        await provider.ocr(DOCUMENT_URL, {
          images: true,
          providerOptions: { include_blocks: true },
          tables: "html",
        });
        const [request] = mockOcr.mock.calls[0];
        expect(request.table_format).toBe("html");
        expect(request.include_image_base64).toBe(true);
        expect(request.include_blocks).toBe(true);
      });

      it("Requests image annotations by default", async () => {
        const mockOcr = mockOcrClient({ pages: [] });
        const provider = new MistralProvider();
        await provider.ocr(DOCUMENT_URL);
        const [request] = mockOcr.mock.calls[0];
        expect(request.bbox_annotation_format).toEqual(
          DEFAULT_BBOX_ANNOTATION_FORMAT,
        );
      });

      it("Lets providerOptions replace or disable image annotations", async () => {
        const mockOcr = mockOcrClient({ pages: [] });
        const provider = new MistralProvider();
        await provider.ocr(DOCUMENT_URL, {
          providerOptions: { bbox_annotation_format: null },
        });
        expect(mockOcr.mock.calls[0][0].bbox_annotation_format).toBeNull();
      });

      it("Prices annotated pages at the annotated rate", async () => {
        mockOcrClient({
          model: MODEL.MISTRAL.OCR,
          pages: [],
          usage_info: { pages_processed: 1000 },
        });
        const provider = new MistralProvider();
        const annotated = await provider.ocr(DOCUMENT_URL);
        expect(annotated.usage.cost).toBe(
          PAGE_COST_ANNOTATED[MODEL.MISTRAL.OCR],
        );
        const plain = await provider.ocr(DOCUMENT_URL, {
          providerOptions: { bbox_annotation_format: null },
        });
        expect(plain.usage.cost).toBe(PAGE_COST[MODEL.MISTRAL.OCR]);
      });

      describe("Markdown", () => {
        const TABLE = "| A | B |\n| --- | --- |\n| 1 | 2 |";

        it("Inlines extracted tables in place of placeholders", async () => {
          mockOcrClient({
            pages: [
              {
                images: [],
                index: 0,
                markdown: "Intro\n\n[tbl-0.md](tbl-0.md)\n\nOutro",
                tables: [
                  { content: TABLE, format: "markdown", id: "tbl-0.md" },
                ],
              },
            ],
          });
          const provider = new MistralProvider();
          const result = await provider.ocr(DOCUMENT_URL);
          expect(result.markdown).toBe(`Intro\n\n${TABLE}\n\nOutro`);
        });

        it("Describes images in alt text and on the image", async () => {
          mockOcrClient({
            pages: [
              {
                images: [
                  {
                    id: "img-0.jpeg",
                    image_annotation: JSON.stringify({
                      description: "Notary signature [Jane Doe]",
                      image_type: "signature",
                    }),
                  },
                  { id: "img-1.jpeg", image_annotation: null },
                ],
                index: 0,
                markdown:
                  "![img-0.jpeg](img-0.jpeg)\n\n![img-1.jpeg](img-1.jpeg)",
              },
            ],
          });
          const provider = new MistralProvider();
          const result = await provider.ocr(DOCUMENT_URL);
          expect(result.markdown).toBe(
            "![Notary signature \\[Jane Doe\\]](img-0.jpeg)\n\n![img-1.jpeg](img-1.jpeg)",
          );
          expect(result.images[0]).toMatchObject({
            annotation: {
              description: "Notary signature [Jane Doe]",
              image_type: "signature",
            },
            description: "Notary signature [Jane Doe]",
            type: "signature",
          });
          expect(result.images[1].description).toBeUndefined();
        });

        it("Uses a non-JSON annotation as the description", async () => {
          mockOcrClient({
            pages: [
              {
                images: [
                  { id: "img-0.jpeg", image_annotation: "Company logo" },
                ],
                index: 0,
                markdown: "![img-0.jpeg](img-0.jpeg)",
              },
            ],
          });
          const provider = new MistralProvider();
          const result = await provider.ocr(DOCUMENT_URL);
          expect(result.markdown).toBe("![Company logo](img-0.jpeg)");
        });

        it("Renders blocks, labeling signatures", async () => {
          mockOcrClient({
            pages: [
              {
                blocks: [
                  { content: "Running header", type: "header" },
                  { content: "# Deed", type: "title" },
                  { content: TABLE, table_id: null, type: "table" },
                  {
                    content: "![img-0.jpeg](img-0.jpeg)",
                    image_id: "img-0.jpeg",
                    type: "image",
                  },
                  { content: "Jane Q\nDoe", type: "signature" },
                  { content: "", type: "signature" },
                  { content: "Page 1", type: "footer" },
                ],
                header: "Running header",
                images: [
                  {
                    id: "img-0.jpeg",
                    image_annotation: JSON.stringify({
                      description: "Notary seal",
                      image_type: "seal",
                    }),
                  },
                ],
                index: 0,
                markdown: "unused",
              },
            ],
          });
          const provider = new MistralProvider();
          const result = await provider.ocr(DOCUMENT_URL);
          expect(result.markdown).toBe(
            [
              "# Deed",
              TABLE,
              "![Notary seal](img-0.jpeg)",
              "[Signature: Jane Q Doe]",
              "[Signature]",
              "Page 1",
            ].join("\n\n"),
          );
        });
      });

      it("Uses the instance model when it is an OCR model", async () => {
        const mockOcr = mockOcrClient({ pages: [] });
        const provider = new MistralProvider("mistral-ocr-latest");
        await provider.ocr(DOCUMENT_URL);
        expect(mockOcr.mock.calls[0][0].model).toBe("mistral-ocr-latest");
      });

      it("Prefers an explicit per-call model", async () => {
        const mockOcr = mockOcrClient({ pages: [] });
        const provider = new MistralProvider();
        await provider.ocr(DOCUMENT_URL, { model: "mistral-ocr-2512" });
        expect(mockOcr.mock.calls[0][0].model).toBe("mistral-ocr-2512");
      });

      it("Surfaces document annotations", async () => {
        mockOcrClient({ document_annotation: { title: "T" }, pages: [] });
        const provider = new MistralProvider();
        const result = await provider.ocr(DOCUMENT_URL);
        expect(result.annotations).toEqual({ title: "T" });
      });

      it("Returns empty markdown when no pages come back", async () => {
        mockOcrClient({});
        const provider = new MistralProvider();
        const result = await provider.ocr(DOCUMENT_URL);
        expect(result.markdown).toBe("");
        expect(result.pages).toEqual([]);
        expect(result.usage.pages).toBe(0);
      });

      it("Classifies a client failure as a typed LlmError", async () => {
        const { MistralHttpError } =
          await vi.importActual<typeof import("../client.js")>("../client.js");
        vi.mocked(MistralClient).mockImplementation(
          class {
            ocr = vi
              .fn()
              .mockRejectedValue(
                new MistralHttpError(422, "body.pages: extra_forbidden"),
              );
          } as any,
        );
        const provider = new MistralProvider();
        await expect(provider.ocr(DOCUMENT_URL)).rejects.toBeInstanceOf(
          LlmUnrecoverableError,
        );
      });
    });
  });
});
