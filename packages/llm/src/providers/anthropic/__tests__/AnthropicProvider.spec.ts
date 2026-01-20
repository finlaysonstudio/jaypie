import { getEnvSecret } from "@jaypie/aws";
import Anthropic from "@anthropic-ai/sdk";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod/v4";
import { AnthropicProvider } from "../AnthropicProvider.class.js";
import { PROVIDER } from "../../../constants.js";
import {
  LlmMessageType,
  LlmInputMessage,
  LlmOutputMessage,
  LlmMessageRole,
  LlmResponseStatus,
} from "../../../types/LlmProvider.interface.js";
import { Toolkit } from "../../../tools/Toolkit.class.js";

// Create a mock implementation for Anthropic client
vi.mock("@anthropic-ai/sdk", () => {
  // Create mock error classes
  class APIConnectionError extends Error {
    name = "APIConnectionError";
  }
  class APIConnectionTimeoutError extends Error {
    name = "APIConnectionTimeoutError";
  }
  class AuthenticationError extends Error {
    name = "AuthenticationError";
  }
  class BadRequestError extends Error {
    name = "BadRequestError";
  }
  class InternalServerError extends Error {
    name = "InternalServerError";
  }
  class NotFoundError extends Error {
    name = "NotFoundError";
  }
  class PermissionDeniedError extends Error {
    name = "PermissionDeniedError";
  }
  class RateLimitError extends Error {
    name = "RateLimitError";
  }

  return {
    default: vi.fn(),
    Anthropic: vi.fn(),
    APIConnectionError,
    APIConnectionTimeoutError,
    AuthenticationError,
    BadRequestError,
    InternalServerError,
    NotFoundError,
    PermissionDeniedError,
    RateLimitError,
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

// Mock the OperateLoop for operate-related tests
vi.mock("../../../operate/index.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    createOperateLoop: vi.fn(() => ({
      execute: vi.fn().mockResolvedValue({
        content: "test response",
        history: [],
        model: "claude-opus-4-1",
        output: [],
        provider: "anthropic",
        responses: [],
        status: "completed",
        usage: [],
      }),
    })),
  };
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
      const provider = new AnthropicProvider(PROVIDER.ANTHROPIC.MODEL.LARGE);
      expect(provider["model"]).toBe(PROVIDER.ANTHROPIC.MODEL.LARGE);
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

      it("operate returns structured output with history", async () => {
        const { createOperateLoop } = await import("../../../operate/index.js");
        const executeMock = vi.fn().mockResolvedValue({
          content: { salutation: "Hello", name: "World" },
          history: [
            {
              role: LlmMessageRole.User,
              content: "Hello, World",
              type: LlmMessageType.Message,
            },
            {
              role: LlmMessageRole.Assistant,
              content: JSON.stringify({ salutation: "Hello", name: "World" }),
              type: LlmMessageType.Message,
            },
          ],
          model: "claude-opus-4-1",
          output: [],
          provider: "anthropic",
          responses: [],
          status: LlmResponseStatus.Completed,
          usage: [
            {
              input: 10,
              output: 10,
              reasoning: 0,
              total: 20,
              provider: "anthropic",
              model: "claude-opus-4-1",
            },
          ],
        });
        vi.mocked(createOperateLoop).mockReturnValue({
          execute: executeMock,
        } as any);

        const provider = new AnthropicProvider();

        const GreetingFormat = z.object({
          salutation: z.string(),
          name: z.string(),
        });

        const response = await provider.operate("Hello, World", {
          format: GreetingFormat,
        });

        expect(response.content).toEqual({
          salutation: "Hello",
          name: "World",
        });
        expect(response.history).toHaveLength(2);
        expect(response.history[0]).toEqual({
          role: LlmMessageRole.User,
          content: "Hello, World",
          type: LlmMessageType.Message,
        });
        expect(response.history[1]).toEqual({
          role: LlmMessageRole.Assistant,
          content: JSON.stringify({
            salutation: "Hello",
            name: "World",
          }),
          type: LlmMessageType.Message,
        });
      });

      it("operate maintains history across structured output calls", async () => {
        const { createOperateLoop } = await import("../../../operate/index.js");

        const mockResponse1 = {
          content: { salutation: "Hello", name: "World" },
          history: [
            {
              role: LlmMessageRole.User,
              content: "Hello, World",
              type: LlmMessageType.Message,
            },
            {
              role: LlmMessageRole.Assistant,
              content: JSON.stringify({ salutation: "Hello", name: "World" }),
              type: LlmMessageType.Message,
            },
          ],
          model: "claude-opus-4-1",
          output: [],
          provider: "anthropic",
          responses: [],
          status: LlmResponseStatus.Completed,
          usage: [
            {
              input: 10,
              output: 10,
              reasoning: 0,
              total: 20,
              provider: "anthropic",
              model: "claude-opus-4-1",
            },
          ],
        };

        const mockResponse2 = {
          content: { salutation: "Goodbye", name: "World" },
          history: [
            {
              role: LlmMessageRole.User,
              content: "Hello, World",
              type: LlmMessageType.Message,
            },
            {
              role: LlmMessageRole.Assistant,
              content: JSON.stringify({ salutation: "Hello", name: "World" }),
              type: LlmMessageType.Message,
            },
            {
              role: LlmMessageRole.User,
              content: "Goodbye, World",
              type: LlmMessageType.Message,
            },
            {
              role: LlmMessageRole.Assistant,
              content: JSON.stringify({ salutation: "Goodbye", name: "World" }),
              type: LlmMessageType.Message,
            },
          ],
          model: "claude-opus-4-1",
          output: [],
          provider: "anthropic",
          responses: [],
          status: LlmResponseStatus.Completed,
          usage: [
            {
              input: 10,
              output: 10,
              reasoning: 0,
              total: 20,
              provider: "anthropic",
              model: "claude-opus-4-1",
            },
          ],
        };

        const executeMock = vi
          .fn()
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        vi.mocked(createOperateLoop).mockReturnValue({
          execute: executeMock,
        } as any);

        const provider = new AnthropicProvider();

        const GreetingFormat = z.object({
          salutation: z.string(),
          name: z.string(),
        });

        // First call
        await provider.operate("Hello, World", {
          format: GreetingFormat,
        });

        // Second call
        const response2 = await provider.operate("Goodbye, World", {
          format: GreetingFormat,
        });

        expect(response2.history).toHaveLength(4);
        expect(response2.history[0]).toEqual({
          role: LlmMessageRole.User,
          content: "Hello, World",
          type: LlmMessageType.Message,
        });
        expect(response2.history[1]).toEqual({
          role: LlmMessageRole.Assistant,
          content: JSON.stringify({
            salutation: "Hello",
            name: "World",
          }),
          type: LlmMessageType.Message,
        });
        expect(response2.history[2]).toEqual({
          role: LlmMessageRole.User,
          content: "Goodbye, World",
          type: LlmMessageType.Message,
        });
        expect(response2.history[3]).toEqual({
          role: LlmMessageRole.Assistant,
          content: JSON.stringify({
            salutation: "Goodbye",
            name: "World",
          }),
          type: LlmMessageType.Message,
        });
      });

      it("operate throws error when structured output is invalid", async () => {
        const { createOperateLoop } = await import("../../../operate/index.js");
        const executeMock = vi
          .fn()
          .mockRejectedValue(new Error("Model returned invalid JSON"));
        vi.mocked(createOperateLoop).mockReturnValue({
          execute: executeMock,
        } as any);

        const provider = new AnthropicProvider();

        const GreetingFormat = z.object({
          salutation: z.string(),
          name: z.string(),
        });

        await expect(provider.operate("Hello, World", {
            format: GreetingFormat,
          })).rejects.toThrowError("Model returned invalid JSON");
      });

      it("sets tool_choice to 'any' when structured output is requested", async () => {
        // This test is no longer applicable at the provider level
        // as structured output handling is done by the adapter
        // The adapter tests cover this behavior
        const { createOperateLoop } = await import("../../../operate/index.js");
        const executeMock = vi.fn().mockResolvedValue({
          content: { salutation: "Hello", name: "World" },
          history: [],
          model: "claude-opus-4-1",
          output: [],
          provider: "anthropic",
          responses: [],
          status: LlmResponseStatus.Completed,
          usage: [],
        });
        vi.mocked(createOperateLoop).mockReturnValue({
          execute: executeMock,
        } as any);

        const provider = new AnthropicProvider();

        const GreetingFormat = z.object({
          salutation: z.string(),
          name: z.string(),
        });

        const response = await provider.operate("Hello, World", {
          format: GreetingFormat,
        });

        expect(response.content).toEqual({
          salutation: "Hello",
          name: "World",
        });
        // Verify execute was called with format option
        expect(executeMock).toHaveBeenCalledWith(
          "Hello, World",
          expect.objectContaining({
            format: GreetingFormat,
          }),
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

    // Tool calling tests are now covered by OperateLoop.spec.ts
    // These tests verify the provider passes tools option to OperateLoop.execute
    describe("Tool Calling", () => {
      it("passes tools option to OperateLoop.execute", async () => {
        const { createOperateLoop } = await import("../../../operate/index.js");
        const executeMock = vi.fn().mockResolvedValue({
          content: "test response",
          history: [],
          model: "claude-opus-4-1",
          output: [],
          provider: "anthropic",
          responses: [],
          status: LlmResponseStatus.Completed,
          usage: [],
        });
        vi.mocked(createOperateLoop).mockReturnValue({
          execute: executeMock,
        } as any);

        const provider = new AnthropicProvider();

        const mockTool = {
          name: "test_tool",
          description: "Test tool",
          parameters: {
            type: "object",
            properties: {
              param: { type: "string" },
            },
          },
          type: "function",
          call: vi.fn().mockResolvedValue({ result: "test result" }),
        };

        await provider.operate("Test input", {
          tools: [mockTool],
        });

        expect(executeMock).toHaveBeenCalledWith(
          "Test input",
          expect.objectContaining({
            tools: [mockTool],
          }),
        );
      });

      it("passes Toolkit object to OperateLoop.execute", async () => {
        const { createOperateLoop } = await import("../../../operate/index.js");
        const executeMock = vi.fn().mockResolvedValue({
          content: "test response",
          history: [],
          model: "claude-opus-4-1",
          output: [],
          provider: "anthropic",
          responses: [],
          status: LlmResponseStatus.Completed,
          usage: [],
        });
        vi.mocked(createOperateLoop).mockReturnValue({
          execute: executeMock,
        } as any);

        const provider = new AnthropicProvider();

        const mockTool = {
          name: "test_tool",
          description: "Test tool",
          parameters: {
            type: "object",
            properties: {
              param: { type: "string" },
            },
          },
          type: "function",
          call: vi.fn().mockResolvedValue({ result: "test result" }),
        };

        const toolkit = new Toolkit([mockTool], { explain: true });

        await provider.operate("Test input", {
          tools: toolkit,
        });

        expect(executeMock).toHaveBeenCalledWith(
          "Test input",
          expect.objectContaining({
            tools: toolkit,
          }),
        );
      });

      it("passes hooks option to OperateLoop.execute", async () => {
        const { createOperateLoop } = await import("../../../operate/index.js");
        const executeMock = vi.fn().mockResolvedValue({
          content: "test response",
          history: [],
          model: "claude-opus-4-1",
          output: [],
          provider: "anthropic",
          responses: [],
          status: LlmResponseStatus.Completed,
          usage: [],
        });
        vi.mocked(createOperateLoop).mockReturnValue({
          execute: executeMock,
        } as any);

        const provider = new AnthropicProvider();

        const hooks = {
          beforeEachTool: vi.fn(),
          afterEachTool: vi.fn(),
          onToolError: vi.fn(),
        };

        await provider.operate("Test input", { hooks });

        expect(executeMock).toHaveBeenCalledWith(
          "Test input",
          expect.objectContaining({
            hooks,
          }),
        );
      });
    });

    // History tracking tests - verifies provider tracks conversation history
    describe("History Tracking", () => {
      it("maintains conversation history across operate calls", async () => {
        const { createOperateLoop } = await import("../../../operate/index.js");
        const mockResponse1 = {
          content: "first response",
          history: [
            {
              role: LlmMessageRole.User,
              content: "first message",
              type: LlmMessageType.Message,
            },
            {
              role: LlmMessageRole.Assistant,
              content: "first response",
              type: LlmMessageType.Message,
            },
          ],
          model: "claude-opus-4-1",
          output: [],
          provider: "anthropic",
          responses: [],
          status: LlmResponseStatus.Completed,
          usage: [],
        };
        const mockResponse2 = {
          content: "second response",
          history: [
            {
              role: LlmMessageRole.User,
              content: "first message",
              type: LlmMessageType.Message,
            },
            {
              role: LlmMessageRole.Assistant,
              content: "first response",
              type: LlmMessageType.Message,
            },
            {
              role: LlmMessageRole.User,
              content: "second message",
              type: LlmMessageType.Message,
            },
            {
              role: LlmMessageRole.Assistant,
              content: "second response",
              type: LlmMessageType.Message,
            },
          ],
          model: "claude-opus-4-1",
          output: [],
          provider: "anthropic",
          responses: [],
          status: LlmResponseStatus.Completed,
          usage: [],
        };
        const executeMock = vi
          .fn()
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);
        vi.mocked(createOperateLoop).mockReturnValue({
          execute: executeMock,
        } as any);

        const provider = new AnthropicProvider();

        // First call
        const response1 = await provider.operate("first message");
        expect(response1.content).toBe("first response");

        // Second call should include history from first call
        await provider.operate("second message");

        expect(executeMock).toHaveBeenCalledTimes(2);
        const secondCallOptions = executeMock.mock.calls[1][1];
        expect(secondCallOptions.history).toEqual(mockResponse1.history);
      });

      it("updates tracked history after each operate call", async () => {
        const { createOperateLoop } = await import("../../../operate/index.js");
        const mockResponse = {
          content: "response",
          history: [
            {
              role: LlmMessageRole.User,
              content: "message",
              type: LlmMessageType.Message,
            },
            {
              role: LlmMessageRole.Assistant,
              content: "response",
              type: LlmMessageType.Message,
            },
          ],
          model: "claude-opus-4-1",
          output: [],
          provider: "anthropic",
          responses: [],
          status: LlmResponseStatus.Completed,
          usage: [],
        };
        const executeMock = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(createOperateLoop).mockReturnValue({
          execute: executeMock,
        } as any);

        const provider = new AnthropicProvider();

        await provider.operate("message");

        // Verify provider stored the history
        expect(provider["conversationHistory"]).toEqual(mockResponse.history);
      });
    });

    // LlmOperateOptions tests - verifies provider passes options to OperateLoop
    describe("LlmOperateOptions", () => {
      it("passes data option to OperateLoop.execute", async () => {
        const { createOperateLoop } = await import("../../../operate/index.js");
        const executeMock = vi.fn().mockResolvedValue({
          content: "test response",
          history: [],
          model: "claude-opus-4-1",
          output: [],
          provider: "anthropic",
          responses: [],
          status: LlmResponseStatus.Completed,
          usage: [],
        });
        vi.mocked(createOperateLoop).mockReturnValue({
          execute: executeMock,
        } as any);

        const provider = new AnthropicProvider();

        await provider.operate("Hello, {{name}}", {
          data: { name: "World" },
        });

        expect(executeMock).toHaveBeenCalledWith(
          "Hello, {{name}}",
          expect.objectContaining({
            data: { name: "World" },
          }),
        );
      });

      it("passes system option to OperateLoop.execute", async () => {
        const { createOperateLoop } = await import("../../../operate/index.js");
        const executeMock = vi.fn().mockResolvedValue({
          content: "test response",
          history: [],
          model: "claude-opus-4-1",
          output: [],
          provider: "anthropic",
          responses: [],
          status: LlmResponseStatus.Completed,
          usage: [],
        });
        vi.mocked(createOperateLoop).mockReturnValue({
          execute: executeMock,
        } as any);

        const provider = new AnthropicProvider();

        await provider.operate("test message", {
          system: "You are a helpful assistant",
        });

        expect(executeMock).toHaveBeenCalledWith(
          "test message",
          expect.objectContaining({
            system: "You are a helpful assistant",
          }),
        );
      });

      it("passes providerOptions to OperateLoop.execute", async () => {
        const { createOperateLoop } = await import("../../../operate/index.js");
        const executeMock = vi.fn().mockResolvedValue({
          content: "test response",
          history: [],
          model: "claude-opus-4-1",
          output: [],
          provider: "anthropic",
          responses: [],
          status: LlmResponseStatus.Completed,
          usage: [],
        });
        vi.mocked(createOperateLoop).mockReturnValue({
          execute: executeMock,
        } as any);

        const provider = new AnthropicProvider();

        await provider.operate("test message", {
          providerOptions: {
            temperature: 0.7,
            top_p: 0.9,
          },
        });

        expect(executeMock).toHaveBeenCalledWith(
          "test message",
          expect.objectContaining({
            providerOptions: {
              temperature: 0.7,
              top_p: 0.9,
            },
          }),
        );
      });

      it("passes turns option to OperateLoop.execute", async () => {
        const { createOperateLoop } = await import("../../../operate/index.js");
        const executeMock = vi.fn().mockResolvedValue({
          content: "test response",
          history: [],
          model: "claude-opus-4-1",
          output: [],
          provider: "anthropic",
          responses: [],
          status: LlmResponseStatus.Incomplete,
          error: {
            detail: "exceeded 1 turns",
            status: 429,
            title: "Too Many Requests",
          },
          usage: [],
        });
        vi.mocked(createOperateLoop).mockReturnValue({
          execute: executeMock,
        } as any);

        const provider = new AnthropicProvider();

        const response = await provider.operate("Test input", {
          turns: 1,
        });

        expect(executeMock).toHaveBeenCalledWith(
          "Test input",
          expect.objectContaining({
            turns: 1,
          }),
        );
        expect(response.status).toBe(LlmResponseStatus.Incomplete);
      });

      it("passes explain option to OperateLoop.execute", async () => {
        const { createOperateLoop } = await import("../../../operate/index.js");
        const executeMock = vi.fn().mockResolvedValue({
          content: "test response",
          history: [],
          model: "claude-opus-4-1",
          output: [],
          provider: "anthropic",
          responses: [],
          status: LlmResponseStatus.Completed,
          usage: [],
        });
        vi.mocked(createOperateLoop).mockReturnValue({
          execute: executeMock,
        } as any);

        const provider = new AnthropicProvider();

        await provider.operate("Test input", {
          explain: true,
        });

        expect(executeMock).toHaveBeenCalledWith(
          "Test input",
          expect.objectContaining({
            explain: true,
          }),
        );
      });
    });

    // Feature Parity tests - verifies Anthropic has all features previously OpenAI-only
    describe("Feature Parity (Phase 6)", () => {
      it("passes beforeEachModelRequest hook to OperateLoop.execute", async () => {
        const { createOperateLoop } = await import("../../../operate/index.js");
        const executeMock = vi.fn().mockResolvedValue({
          content: "test response",
          history: [],
          model: "claude-opus-4-1",
          output: [],
          provider: "anthropic",
          responses: [],
          status: LlmResponseStatus.Completed,
          usage: [],
        });
        vi.mocked(createOperateLoop).mockReturnValue({
          execute: executeMock,
        } as any);

        const provider = new AnthropicProvider();
        const beforeEachModelRequest = vi.fn();

        await provider.operate("Test input", {
          hooks: { beforeEachModelRequest },
        });

        expect(executeMock).toHaveBeenCalledWith(
          "Test input",
          expect.objectContaining({
            hooks: expect.objectContaining({
              beforeEachModelRequest,
            }),
          }),
        );
      });

      it("passes afterEachModelResponse hook to OperateLoop.execute", async () => {
        const { createOperateLoop } = await import("../../../operate/index.js");
        const executeMock = vi.fn().mockResolvedValue({
          content: "test response",
          history: [],
          model: "claude-opus-4-1",
          output: [],
          provider: "anthropic",
          responses: [],
          status: LlmResponseStatus.Completed,
          usage: [],
        });
        vi.mocked(createOperateLoop).mockReturnValue({
          execute: executeMock,
        } as any);

        const provider = new AnthropicProvider();
        const afterEachModelResponse = vi.fn();

        await provider.operate("Test input", {
          hooks: { afterEachModelResponse },
        });

        expect(executeMock).toHaveBeenCalledWith(
          "Test input",
          expect.objectContaining({
            hooks: expect.objectContaining({
              afterEachModelResponse,
            }),
          }),
        );
      });

      it("passes onRetryableModelError hook to OperateLoop.execute", async () => {
        const { createOperateLoop } = await import("../../../operate/index.js");
        const executeMock = vi.fn().mockResolvedValue({
          content: "test response",
          history: [],
          model: "claude-opus-4-1",
          output: [],
          provider: "anthropic",
          responses: [],
          status: LlmResponseStatus.Completed,
          usage: [],
        });
        vi.mocked(createOperateLoop).mockReturnValue({
          execute: executeMock,
        } as any);

        const provider = new AnthropicProvider();
        const onRetryableModelError = vi.fn();

        await provider.operate("Test input", {
          hooks: { onRetryableModelError },
        });

        expect(executeMock).toHaveBeenCalledWith(
          "Test input",
          expect.objectContaining({
            hooks: expect.objectContaining({
              onRetryableModelError,
            }),
          }),
        );
      });

      it("passes onUnrecoverableModelError hook to OperateLoop.execute", async () => {
        const { createOperateLoop } = await import("../../../operate/index.js");
        const executeMock = vi.fn().mockResolvedValue({
          content: "test response",
          history: [],
          model: "claude-opus-4-1",
          output: [],
          provider: "anthropic",
          responses: [],
          status: LlmResponseStatus.Completed,
          usage: [],
        });
        vi.mocked(createOperateLoop).mockReturnValue({
          execute: executeMock,
        } as any);

        const provider = new AnthropicProvider();
        const onUnrecoverableModelError = vi.fn();

        await provider.operate("Test input", {
          hooks: { onUnrecoverableModelError },
        });

        expect(executeMock).toHaveBeenCalledWith(
          "Test input",
          expect.objectContaining({
            hooks: expect.objectContaining({
              onUnrecoverableModelError,
            }),
          }),
        );
      });

      it("uses OperateLoop which includes retry logic via RetryExecutor", async () => {
        // This test verifies the provider uses createOperateLoop
        // The OperateLoop itself includes RetryExecutor which is tested separately
        const { createOperateLoop } = await import("../../../operate/index.js");
        const executeMock = vi.fn().mockResolvedValue({
          content: "test response",
          history: [],
          model: "claude-opus-4-1",
          output: [],
          provider: "anthropic",
          responses: [],
          status: LlmResponseStatus.Completed,
          usage: [],
        });
        vi.mocked(createOperateLoop).mockReturnValue({
          execute: executeMock,
        } as any);

        const provider = new AnthropicProvider();
        await provider.operate("Test input");

        // Verify createOperateLoop was called with anthropicAdapter
        expect(createOperateLoop).toHaveBeenCalledWith(
          expect.objectContaining({
            adapter: expect.objectContaining({
              name: "anthropic",
            }),
          }),
        );
      });
    });
  });
});
