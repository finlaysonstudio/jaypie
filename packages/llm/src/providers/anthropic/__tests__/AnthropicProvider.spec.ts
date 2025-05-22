import { getEnvSecret } from "@jaypie/aws";
import Anthropic from "@anthropic-ai/sdk";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod/v4";
import { AnthropicProvider } from "../AnthropicProvider.class.js";
import { PROVIDER } from "../../../constants.js";

// Create a mock implementation for Anthropic client
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn(),
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

describe("AnthropicProvider", () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();

    // Set up the mock response for Anthropic client
    vi.mocked(Anthropic).mockImplementation(
      () =>
        ({
          messages: {
            create: vi.fn(),
          },
        }) as any,
    );

    // Mock the API key resolution
    vi.mocked(getEnvSecret).mockResolvedValue("test-api-key");
  });

  describe("Base Cases", () => {
    it("is a Class", () => {
      expect(AnthropicProvider).toBeFunction();
    });

    it("can be instantiated", () => {
      const provider = new AnthropicProvider();
      expect(provider).toBeInstanceOf(AnthropicProvider);
    });

    it("accepts a model parameter", () => {
      const provider = new AnthropicProvider(
        PROVIDER.ANTHROPIC.MODEL.CLAUDE_3_OPUS,
      );
      expect(provider["model"]).toBe(PROVIDER.ANTHROPIC.MODEL.CLAUDE_3_OPUS);
    });

    it("accepts an apiKey parameter", () => {
      const provider = new AnthropicProvider(PROVIDER.ANTHROPIC.MODEL.DEFAULT, {
        apiKey: "test-key",
      });
      expect(provider["apiKey"]).toBe("test-key");
    });
  });

  describe("Error Conditions", () => {
    beforeEach(() => {
      vi.mocked(getEnvSecret).mockResolvedValue(null as unknown as string);
    });

    it("throws ConfigurationError when API key is missing", async () => {
      const provider = new AnthropicProvider();
      expect(async () => provider.send("test")).toThrowConfigurationError();
    });

    it("throws Error when operate method is called", async () => {
      const provider = new AnthropicProvider();
      provider["apiKey"] = "test-key"; // Set API key directly to avoid configuration error
      await expect(provider.operate("test")).rejects.toThrowError(
        "The operate method is not yet implemented for AnthropicProvider",
      );
    });

    it("throws error when JSON response does not match schema", async () => {
      const mockResponse = {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              salutation: "Hello",
              // Missing required 'name' field
            }),
          },
        ],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockResponse);
      vi.mocked(Anthropic).mockImplementation(
        () =>
          ({
            messages: {
              create: mockCreate,
            },
          }) as any,
      );

      const provider = new AnthropicProvider();
      const GreetingFormat = z.object({
        salutation: z.string(),
        name: z.string(),
      });

      await expect(
        provider.send("Hello, World", {
          response: GreetingFormat,
        }),
      ).rejects.toThrowError(
        "Failed to parse structured response from Anthropic",
      );
    });
  });

  describe("Happy Paths", () => {
    beforeEach(() => {
      vi.mocked(getEnvSecret).mockResolvedValue("test-key");
    });

    it("sends messages to Anthropic", async () => {
      const mockResponse = {
        content: [{ type: "text", text: "test response" }],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockResponse);
      vi.mocked(Anthropic).mockImplementation(
        () =>
          ({
            messages: {
              create: mockCreate,
            },
          }) as any,
      );

      const provider = new AnthropicProvider();
      const response = await provider.send("test message");

      expect(response).toBe("test response");
      expect(mockCreate).toHaveBeenCalledWith({
        messages: [
          { role: PROVIDER.ANTHROPIC.ROLE.USER, content: "test message" },
        ],
        model: expect.any(String),
        max_tokens: PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
      });
    });

    it("includes system message when provided", async () => {
      const mockResponse = {
        content: [{ type: "text", text: "test response" }],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockResponse);
      vi.mocked(Anthropic).mockImplementation(
        () =>
          ({
            messages: {
              create: mockCreate,
            },
          }) as any,
      );

      const provider = new AnthropicProvider();
      const response = await provider.send("test message", {
        system: "You are a test assistant",
      });

      expect(response).toBe("test response");
      expect(mockCreate).toHaveBeenCalledWith({
        messages: [
          { role: PROVIDER.ANTHROPIC.ROLE.USER, content: "test message" },
        ],
        model: expect.any(String),
        max_tokens: PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
        system: "You are a test assistant",
      });
    });
  });

  describe("Features", () => {
    describe("Structured Output", () => {
      it("uses tool calling for structured output", async () => {
        const mockResponse = {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                salutation: "Hello",
                name: "World",
              }),
            },
          ],
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(Anthropic).mockImplementation(
          () =>
            ({
              messages: {
                create: mockCreate,
              },
            }) as any,
        );

        const provider = new AnthropicProvider();
        const GreetingFormat = z.object({
          salutation: z.string(),
          name: z.string(),
        });

        const response = await provider.send("Hello, World", {
          response: GreetingFormat,
        });

        expect(response).toEqual({
          salutation: "Hello",
          name: "World",
        });

        expect(mockCreate).toHaveBeenCalledWith({
          messages: [
            { role: PROVIDER.ANTHROPIC.ROLE.USER, content: "Hello, World" },
          ],
          model: expect.any(String),
          max_tokens: PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
          system: expect.any(String),
        });
      });

      it("throws error when tool call result is not found", async () => {
        const mockResponse = {
          content: [
            { type: "text", text: "Invalid response without tool call" },
          ],
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(Anthropic).mockImplementation(
          () =>
            ({
              messages: {
                create: mockCreate,
              },
            }) as any,
        );

        const provider = new AnthropicProvider();
        const GreetingFormat = z.object({
          salutation: z.string(),
          name: z.string(),
        });

        await expect(
          provider.send("Hello, World", {
            response: GreetingFormat,
          }),
        ).rejects.toThrowError(
          "Failed to parse structured response from Anthropic",
        );
      });
    });

    describe("Message Options", () => {
      it("applies placeholders to system message", async () => {
        const mockResponse = {
          content: [{ type: "text", text: "test response" }],
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(Anthropic).mockImplementation(
          () =>
            ({
              messages: {
                create: mockCreate,
              },
            }) as any,
        );

        const provider = new AnthropicProvider();
        const response = await provider.send("test message", {
          system: "You are a {{role}}",
          data: { role: "test assistant" },
        });

        expect(response).toBe("test response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [
            { role: PROVIDER.ANTHROPIC.ROLE.USER, content: "test message" },
          ],
          model: expect.any(String),
          max_tokens: PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
          system: "You are a test assistant",
        });
      });

      it("applies placeholders to user message", async () => {
        const mockResponse = {
          content: [{ type: "text", text: "test response" }],
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(Anthropic).mockImplementation(
          () =>
            ({
              messages: {
                create: mockCreate,
              },
            }) as any,
        );

        const provider = new AnthropicProvider();
        const response = await provider.send("Hello, {{name}}", {
          data: { name: "World" },
        });

        expect(response).toBe("test response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [
            { role: PROVIDER.ANTHROPIC.ROLE.USER, content: "Hello, World" },
          ],
          model: expect.any(String),
          max_tokens: PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
        });
      });

      it("respects placeholders.message option", async () => {
        const mockResponse = {
          content: [{ type: "text", text: "test response" }],
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(Anthropic).mockImplementation(
          () =>
            ({
              messages: {
                create: mockCreate,
              },
            }) as any,
        );

        const provider = new AnthropicProvider();
        const response = await provider.send("Hello, {{name}}", {
          data: { name: "World" },
          placeholders: { message: false },
        });

        expect(response).toBe("test response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [
            { role: PROVIDER.ANTHROPIC.ROLE.USER, content: "Hello, {{name}}" },
          ],
          model: expect.any(String),
          max_tokens: PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
        });
      });

      it("respects placeholders.system option", async () => {
        const mockResponse = {
          content: [{ type: "text", text: "test response" }],
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(Anthropic).mockImplementation(
          () =>
            ({
              messages: {
                create: mockCreate,
              },
            }) as any,
        );

        const provider = new AnthropicProvider();
        const response = await provider.send("test message", {
          system: "You are a {{role}}",
          data: { role: "test assistant" },
          placeholders: { system: false },
        });

        expect(response).toBe("test response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [
            { role: PROVIDER.ANTHROPIC.ROLE.USER, content: "test message" },
          ],
          model: expect.any(String),
          max_tokens: PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
          system: "You are a {{role}}",
        });
      });
    });
  });
});
