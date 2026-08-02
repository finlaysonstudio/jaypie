import { getEnvSecret } from "@jaypie/aws";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MistralProvider } from "../MistralProvider.class";
import { MistralClient } from "../client.js";
import { MODEL, PROVIDER } from "../../../constants.js";

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
      it("joins page markdown and preserves the raw response", async () => {
        const raw = {
          model: MODEL.MISTRAL.OCR,
          pages: [
            { index: 0, markdown: "# Page One", blocks: [{ type: "title" }] },
            { index: 1, markdown: "Page two body" },
          ],
        };
        const mockOcr = vi.fn().mockResolvedValue(raw);
        vi.mocked(MistralClient).mockImplementation(
          class {
            ocr = mockOcr;
          } as any,
        );

        const provider = new MistralProvider();
        const result = await provider.ocr({
          document: {
            type: "document_url",
            document_url: "data:application/pdf;base64,AAAA",
          },
        });

        expect(result.markdown).toBe("# Page One\n\nPage two body");
        expect(result.pages).toHaveLength(2);
        expect(result.model).toBe(MODEL.MISTRAL.OCR);
        expect(result.raw).toBe(raw);
      });

      it("returns empty markdown when no pages come back", async () => {
        vi.mocked(MistralClient).mockImplementation(
          class {
            ocr = vi.fn().mockResolvedValue({});
          } as any,
        );

        const provider = new MistralProvider();
        const result = await provider.ocr({
          document: { type: "document_url", document_url: "https://x.test/a" },
        });

        expect(result.markdown).toBe("");
        expect(result.pages).toEqual([]);
      });
    });
  });
});
