import { getEnvSecret } from "@jaypie/aws";
import { OpenAI } from "openai";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { OpenAiProvider } from "../OpenAiProvider.class";

vi.mock("openai");

describe("OpenAiProvider", () => {
  beforeEach(() => {
    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          beta: {
            chat: {
              completions: {
                parse: vi.fn(),
              },
            },
          },
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
    describe("Structured Output", () => {
      it("Uses beta endpoint when structured output is requested", async () => {
        const mockParsedResponse = {
          salutation: "Hello",
          name: "World",
        };

        const mockResponse = {
          choices: [
            {
              message: {
                parsed: mockParsedResponse,
              },
            },
          ],
        };

        const mockParse = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              beta: {
                chat: {
                  completions: {
                    parse: mockParse,
                  },
                },
              },
            }) as any,
        );

        const provider = new OpenAiProvider();
        const GreetingFormat = z.object({
          salutation: z.string(),
          name: z.string(),
        });
        const response = await provider.send("Hello, World", {
          response: GreetingFormat,
        });

        expect(response).toEqual(mockParsedResponse);
        expect(mockParse).toHaveBeenCalledWith({
          messages: [{ role: "user", content: "Hello, World" }],
          model: expect.any(String),
          response_format: expect.any(Object),
        });
      });

      it("Handles NaturalSchema response format", async () => {
        const mockParsedResponse = {
          salutation: "Hello",
          name: "World",
        };

        const mockResponse = {
          choices: [
            {
              message: {
                parsed: mockParsedResponse,
              },
            },
          ],
        };

        const mockParse = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              beta: {
                chat: {
                  completions: {
                    parse: mockParse,
                  },
                },
              },
            }) as any,
        );

        const provider = new OpenAiProvider();
        const GreetingFormat = {
          salutation: String,
          name: String,
        };
        const response = await provider.send("Hello, World", {
          response: GreetingFormat,
        });

        expect(response).toEqual(mockParsedResponse);
        expect(mockParse).toHaveBeenCalledWith({
          messages: [{ role: "user", content: "Hello, World" }],
          model: expect.any(String),
          response_format: expect.any(Object),
        });
      });
    });

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
            { role: "developer", content: "You are a test assistant" },
            { role: "user", content: "test message" },
          ],
          model: expect.any(String),
        });
      });

      it("applies placeholders to system message", async () => {
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
          system: "You are a {{role}}",
          data: { role: "test assistant" },
        });

        expect(response).toBe("test response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [
            { role: "developer", content: "You are a test assistant" },
            { role: "user", content: "test message" },
          ],
          model: expect.any(String),
        });
      });

      it("applies placeholders to user message", async () => {
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
        const response = await provider.send("Hello, {{name}}", {
          data: { name: "World" },
        });

        expect(response).toBe("test response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [{ role: "user", content: "Hello, World" }],
          model: expect.any(String),
        });
      });

      it("respects placeholders.message option", async () => {
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
        const response = await provider.send("Hello, {{name}}", {
          data: { name: "World" },
          placeholders: { message: false },
        });

        expect(response).toBe("test response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [{ role: "user", content: "Hello, {{name}}" }],
          model: expect.any(String),
        });
      });

      it("respects placeholders.system option", async () => {
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
          system: "You are a {{role}}",
          data: { role: "test assistant" },
          placeholders: { system: false },
        });

        expect(response).toBe("test response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [
            { role: "developer", content: "You are a {{role}}" },
            { role: "user", content: "test message" },
          ],
          model: expect.any(String),
        });
      });
    });
  });
});
