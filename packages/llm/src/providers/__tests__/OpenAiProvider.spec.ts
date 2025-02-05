import { getEnvSecret } from "@jaypie/aws";
import { OpenAI } from "openai";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAiProvider } from "../OpenAiProvider.class";

vi.mock("openai");

describe("OpenAiProvider", () => {
  beforeEach(() => {
    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          chat: {
            completions: {
              create: vi.fn(),
            },
          },
        }) as any,
    );
    vi.mocked(getEnvSecret).mockResolvedValue("test-key");
  });

  describe("Base Cases", () => {
    it("is a Class", () => {
      expect(OpenAiProvider).toBeFunction();
    });

    it("Works", () => {
      const provider = new OpenAiProvider();
      expect(provider).toBeInstanceOf(OpenAiProvider);
    });
  });

  describe("Error Conditions", () => {
    beforeEach(() => {
      vi.mocked(getEnvSecret).mockResolvedValue(null as unknown as string);
    });

    it("throws ConfigurationError when API key is missing", async () => {
      const provider = new OpenAiProvider();
      expect(async () => provider.send("test")).toThrowConfigurationError();
    });
  });

  describe("Happy Paths", () => {
    beforeEach(() => {
      vi.mocked(getEnvSecret).mockResolvedValue("test-key");
    });

    it("sends messages to OpenAI", async () => {
      const mockResponse = {
        choices: [{ message: { content: "test response" } }],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockResponse);
      vi.mocked(OpenAI).mockImplementation(
        () =>
          ({
            chat: {
              completions: {
                create: mockCreate,
              },
            },
          }) as any,
      );

      const provider = new OpenAiProvider();
      const response = await provider.send("test message");

      expect(response).toBe("test response");
      expect(mockCreate).toHaveBeenCalledWith({
        messages: [{ role: "user", content: "test message" }],
        model: expect.any(String),
      });
    });
  });

  describe("Features", () => {
    describe("Message Options", () => {
      it("includes system message when provided", async () => {
        const mockResponse = {
          choices: [{ message: { content: "test response" } }],
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              chat: {
                completions: {
                  create: mockCreate,
                },
              },
            }) as any,
        );

        const provider = new OpenAiProvider();
        const response = await provider.send("test message", {
          system: "You are a test assistant",
        });

        expect(response).toBe("test response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [
            { role: "system", content: "You are a test assistant" },
            { role: "user", content: "test message" },
          ],
          model: expect.any(String),
        });
      });

      it("uses provided model when specified", async () => {
        const mockResponse = {
          choices: [{ message: { content: "test response" } }],
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              chat: {
                completions: {
                  create: mockCreate,
                },
              },
            }) as any,
        );

        const provider = new OpenAiProvider();
        const response = await provider.send("test message", {
          model: "gpt-4",
        });

        expect(response).toBe("test response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [{ role: "user", content: "test message" }],
          model: "gpt-4",
        });
      });

      it("replaces data placeholders in message", async () => {
        const mockResponse = {
          choices: [{ message: { content: "test response" } }],
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              chat: {
                completions: {
                  create: mockCreate,
                },
              },
            }) as any,
        );

        const provider = new OpenAiProvider();
        const response = await provider.send(
          "Hello {{ name }}, your age is {{ age }}",
          {
            data: {
              name: "John",
              age: "30",
            },
          },
        );

        expect(response).toBe("test response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [{ role: "user", content: "Hello John, your age is 30" }],
          model: expect.any(String),
        });
      });
    });
  });
});
