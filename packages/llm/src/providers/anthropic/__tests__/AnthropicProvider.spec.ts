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
} from "../../../types/LlmProvider.interface.js";

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
        const mockResponse = {
          content: [
            {
              type: "tool_use",
              id: "tool_1",
              name: "structured_output",
              input: {
                salutation: "Hello",
                name: "World",
              },
            },
          ],
          usage: { input_tokens: 10, output_tokens: 10 },
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
        provider["apiKey"] = "test-key";

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
        const mockResponse1 = {
          content: [
            {
              type: "tool_use",
              id: "tool_1",
              name: "structured_output",
              input: {
                salutation: "Hello",
                name: "World",
              },
            },
          ],
          usage: { input_tokens: 10, output_tokens: 10 },
        };

        const mockResponse2 = {
          content: [
            {
              type: "tool_use",
              id: "tool_2",
              name: "structured_output",
              input: {
                salutation: "Goodbye",
                name: "World",
              },
            },
          ],
          usage: { input_tokens: 10, output_tokens: 10 },
        };

        const mockCreate = vi
          .fn()
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        vi.mocked(Anthropic).mockImplementation(
          () =>
            ({
              messages: {
                create: mockCreate,
              },
            }) as any,
        );

        const provider = new AnthropicProvider();
        provider["apiKey"] = "test-key";

        const GreetingFormat = z.object({
          salutation: z.string(),
          name: z.string(),
        });

        // First call
        const response1 = await provider.operate("Hello, World", {
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
          usage: { input_tokens: 10, output_tokens: 10 },
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
        provider["apiKey"] = "test-key";

        const GreetingFormat = z.object({
          salutation: z.string(),
          name: z.string(),
        });

        await expect(async () => {
          await provider.operate("Hello, World", {
            format: GreetingFormat,
          });
        }).toThrowError("Model returned invalid JSON");
      });

      it("sets tool_choice to 'any' when structured output is requested", async () => {
        const mockResponse = {
          content: [
            {
              type: "tool_use",
              id: "tool_1",
              name: "structured_output",
              input: {
                salutation: "Hello",
                name: "World",
              },
            },
          ],
          usage: { input_tokens: 10, output_tokens: 10 },
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
        provider["apiKey"] = "test-key";

        const GreetingFormat = z.object({
          salutation: z.string(),
          name: z.string(),
        });

        await provider.operate("Hello, World", {
          format: GreetingFormat,
        });

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            tool_choice: {
              type: "any",
            },
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

    describe("Tool Calling", () => {
      it("processes tool calls correctly", async () => {
        const mockResponse1 = {
          content: [
            { type: "text", text: "Let me help you with that." },
            {
              type: "tool_use",
              id: "tool_1",
              name: "test_tool",
              input: { param: "test" },
            },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 10, output_tokens: 10 },
        };

        const mockResponse2 = {
          content: [{ type: "text", text: "Final response" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 10 },
        };

        const mockCreate = vi
          .fn()
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        vi.mocked(Anthropic).mockImplementation(
          () =>
            ({
              messages: {
                create: mockCreate,
              },
            }) as any,
        );

        const provider = new AnthropicProvider();
        provider["apiKey"] = "test-key";

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

        const response = await provider.operate("Test input", {
          tools: [mockTool],
        });

        expect(response.content).toBe("Final response");
        expect(mockTool.call).toHaveBeenCalledWith({ param: "test" });
      });

      it("handles tool call errors", async () => {
        const mockResponse1 = {
          content: [
            { type: "text", text: "Let me help you with that." },
            {
              type: "tool_use",
              id: "tool_1",
              name: "test_tool",
              input: { param: "test" },
            },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 10, output_tokens: 10 },
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse1);

        vi.mocked(Anthropic).mockImplementation(
          () =>
            ({
              messages: {
                create: mockCreate,
              },
            }) as any,
        );

        const provider = new AnthropicProvider();
        provider["apiKey"] = "test-key";

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
          call: vi.fn().mockRejectedValue(new Error("Tool error")),
        };

        await expect(
          provider.operate("Test input", {
            tools: [mockTool],
          }),
        ).rejects.toThrow("Tool error");
      });

      it("calls beforeEachTool hook before executing a tool", async () => {
        const mockResponse1 = {
          content: [
            { type: "text", text: "Let me help you with that." },
            {
              type: "tool_use",
              id: "tool_1",
              name: "test_tool",
              input: { param: "test" },
            },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 10, output_tokens: 10 },
        };

        const mockResponse2 = {
          content: [{ type: "text", text: "Final response" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 10 },
        };

        const mockCreate = vi
          .fn()
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        vi.mocked(Anthropic).mockImplementation(
          () =>
            ({
              messages: {
                create: mockCreate,
              },
            }) as any,
        );

        const provider = new AnthropicProvider();
        provider["apiKey"] = "test-key";

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

        const beforeEachToolSpy = vi.fn();

        await provider.operate("Test input", {
          tools: [mockTool],
          hooks: {
            beforeEachTool: beforeEachToolSpy,
          },
        });

        expect(beforeEachToolSpy).toHaveBeenCalledWith(
          "test_tool",
          '{"param":"test"}',
        );
        expect(beforeEachToolSpy).toHaveBeenCalledBefore(mockTool.call);
      });

      it("calls afterEachTool hook after executing a tool", async () => {
        const mockResponse1 = {
          content: [
            { type: "text", text: "Let me help you with that." },
            {
              type: "tool_use",
              id: "tool_1",
              name: "test_tool",
              input: { param: "test" },
            },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 10, output_tokens: 10 },
        };

        const mockResponse2 = {
          content: [{ type: "text", text: "Final response" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 10 },
        };

        const mockCreate = vi
          .fn()
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        vi.mocked(Anthropic).mockImplementation(
          () =>
            ({
              messages: {
                create: mockCreate,
              },
            }) as any,
        );

        const provider = new AnthropicProvider();
        provider["apiKey"] = "test-key";

        const toolResult = { result: "test result" };
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
          call: vi.fn().mockResolvedValue(toolResult),
        };

        const afterEachToolSpy = vi.fn();

        await provider.operate("Test input", {
          tools: [mockTool],
          hooks: {
            afterEachTool: afterEachToolSpy,
          },
        });

        expect(afterEachToolSpy).toHaveBeenCalledWith(
          toolResult,
          "test_tool",
          '{"param":"test"}',
        );
        expect(mockTool.call).toHaveBeenCalledBefore(afterEachToolSpy);
      });

      it("calls onToolError hook when tool execution fails", async () => {
        const mockResponse1 = {
          content: [
            { type: "text", text: "Let me help you with that." },
            {
              type: "tool_use",
              id: "tool_1",
              name: "test_tool",
              input: { param: "test" },
            },
          ],
          usage: { input_tokens: 10, output_tokens: 10 },
          stop_reason: "tool_use",
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse1);

        vi.mocked(Anthropic).mockImplementation(
          () =>
            ({
              messages: {
                create: mockCreate,
              },
            }) as any,
        );

        const provider = new AnthropicProvider();
        provider["apiKey"] = "test-key";

        const toolError = new Error("Tool error");
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
          call: vi.fn().mockRejectedValue(toolError),
        };

        const onToolErrorSpy = vi.fn();

        await expect(
          provider.operate("Test input", {
            tools: [mockTool],
            hooks: {
              onToolError: onToolErrorSpy,
            },
          }),
        ).rejects.toThrow("Tool error");

        expect(onToolErrorSpy).toHaveBeenCalledWith(
          toolError,
          "test_tool",
          '{"param":"test"}',
        );
      });
    });

    describe("History Tracking", () => {
      it("maintains conversation history across operate calls", async () => {
        const mockResponse1 = {
          content: [{ type: "text", text: "first response" }],
          usage: { input_tokens: 10, output_tokens: 10 },
        };
        const mockResponse2 = {
          content: [{ type: "text", text: "second response" }],
          usage: { input_tokens: 10, output_tokens: 10 },
        };

        const mockCreate = vi
          .fn()
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        vi.mocked(Anthropic).mockImplementation(
          () =>
            ({
              messages: {
                create: mockCreate,
              },
            }) as any,
        );

        const provider = new AnthropicProvider();
        provider["apiKey"] = "test-key";

        // First call
        const response1 = await provider.operate("first message");
        expect(response1.content).toBe("first response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [
            { role: PROVIDER.ANTHROPIC.ROLE.USER, content: "first message" },
          ],
          model: expect.any(String),
          max_tokens: PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
          stream: false,
          system: undefined,
          tools: [],
          tool_choice: {
            type: "auto",
          },
        });

        // Second call
        const response2 = await provider.operate("second message");
        expect(response2.content).toBe("second response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [
            { role: PROVIDER.ANTHROPIC.ROLE.USER, content: "first message" },
            {
              role: PROVIDER.ANTHROPIC.ROLE.ASSISTANT,
              content: "first response",
            },
            { role: PROVIDER.ANTHROPIC.ROLE.USER, content: "second message" },
          ],
          model: expect.any(String),
          max_tokens: PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
          stream: false,
          system: undefined,
          tools: [],
          tool_choice: {
            type: "auto",
          },
        });
      });

      it("merges provided history with tracked history", async () => {
        const mockResponse = {
          content: [{ type: "text", text: "response" }],
          usage: { input_tokens: 10, output_tokens: 10 },
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
        provider["apiKey"] = "test-key";

        // First call to establish tracked history
        await provider.operate("first message");

        // Second call with additional history
        const additionalHistory: (LlmInputMessage | LlmOutputMessage)[] = [
          {
            role: LlmMessageRole.User,
            content: "previous message",
            type: LlmMessageType.Message,
          },
          {
            role: LlmMessageRole.Assistant,
            content: "previous response",
            type: LlmMessageType.Message,
          },
        ];

        await provider.operate("new message", { history: additionalHistory });

        expect(mockCreate).toHaveBeenLastCalledWith({
          messages: [
            { role: PROVIDER.ANTHROPIC.ROLE.USER, content: "first message" },
            { role: PROVIDER.ANTHROPIC.ROLE.ASSISTANT, content: "response" },
            { role: PROVIDER.ANTHROPIC.ROLE.USER, content: "previous message" },
            {
              role: PROVIDER.ANTHROPIC.ROLE.ASSISTANT,
              content: "previous response",
            },
            { role: PROVIDER.ANTHROPIC.ROLE.USER, content: "new message" },
          ],
          model: expect.any(String),
          max_tokens: PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT,
          stream: false,
          system: undefined,
          tools: [],
          tool_choice: {
            type: "auto",
          },
        });
      });

      it("updates tracked history after each operate call", async () => {
        const mockResponse = {
          content: [{ type: "text", text: "response" }],
          usage: { input_tokens: 10, output_tokens: 10 },
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
        provider["apiKey"] = "test-key";

        // First call
        const response1 = await provider.operate("first message");
        expect(response1.history).toHaveLength(2); // User message + Assistant response

        // Second call
        const response2 = await provider.operate("second message");
        expect(response2.history).toHaveLength(4); // Previous 2 + new user message + new assistant response

        // Verify history content
        const expectedHistory: (LlmInputMessage | LlmOutputMessage)[] = [
          {
            role: LlmMessageRole.User,
            content: "first message",
            type: LlmMessageType.Message,
          },
          {
            role: LlmMessageRole.Assistant,
            content: "response",
            type: LlmMessageType.Message,
          },
          {
            role: LlmMessageRole.User,
            content: "second message",
            type: LlmMessageType.Message,
          },
          {
            role: LlmMessageRole.Assistant,
            content: "response",
            type: LlmMessageType.Message,
          },
        ];

        expect(response2.history).toEqual(expectedHistory);
      });
    });
  });
});
