import { getEnvSecret } from "@jaypie/aws";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod/v4";
import { generateText, generateObject } from "ai";
import { OpenRouterProvider } from "../OpenRouterProvider.class.js";
import { PROVIDER } from "../../../constants.js";
import {
  LlmMessageType,
  LlmInputMessage,
  LlmOutputMessage,
  LlmMessageRole,
  LlmResponseStatus,
} from "../../../types/LlmProvider.interface.js";
import { Toolkit } from "../../../tools/Toolkit.class.js";

vi.mock("ai", async () => {
  const actual = await vi.importActual("ai");
  return {
    ...actual,
    generateText: vi.fn(),
    generateObject: vi.fn(),
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

describe("OpenRouterProvider", () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();

    vi.mocked(getEnvSecret).mockResolvedValue("test-api-key");
  });

  describe("Base Cases", () => {
    it("is a Class", () => {
      expect(OpenRouterProvider).toBeFunction();
    });

    it("can be instantiated", () => {
      const provider = new OpenRouterProvider();
      expect(provider).toBeInstanceOf(OpenRouterProvider);
    });

    it("accepts a model parameter", () => {
      const provider = new OpenRouterProvider(
        PROVIDER.OPENROUTER.MODEL.DEEPSEEK_V3,
      );
      expect(provider["model"]).toBe(PROVIDER.OPENROUTER.MODEL.DEEPSEEK_V3);
    });

    it("accepts an apiKey parameter", () => {
      const provider = new OpenRouterProvider(
        PROVIDER.OPENROUTER.MODEL.DEFAULT,
        {
          apiKey: "test-key",
        },
      );
      expect(provider["apiKey"]).toBe("test-key");
    });
  });

  describe("Error Conditions", () => {
    beforeEach(() => {
      vi.mocked(getEnvSecret).mockResolvedValue(null as unknown as string);
    });

    it("throws ConfigurationError when API key is missing", async () => {
      const provider = new OpenRouterProvider();
      expect(async () => provider.send("test")).toThrowConfigurationError();
    });
  });

  describe("Happy Paths", () => {
    beforeEach(() => {
      vi.mocked(getEnvSecret).mockResolvedValue("test-key");
    });

    it("sends messages to OpenRouter", async () => {
      const mockResponse = {
        text: "test response",
      } as any;

      vi.mocked(generateText).mockResolvedValue(mockResponse);

      const provider = new OpenRouterProvider();
      const response = await provider.send("test message");

      expect(response).toBe("test response");
      expect(vi.mocked(generateText)).toHaveBeenCalledWith({
        messages: [
          { role: PROVIDER.OPENROUTER.ROLE.USER, content: "test message" },
        ],
        model: expect.any(Object),
        maxTokens: PROVIDER.OPENROUTER.MAX_TOKENS.DEFAULT,
        system: undefined,
      });
    });

    it("includes system message when provided", async () => {
      const mockResponse = {
        text: "test response",
      } as any;

      vi.mocked(generateText).mockResolvedValue(mockResponse);

      const provider = new OpenRouterProvider();
      const response = await provider.send("test message", {
        system: "You are a test assistant",
      });

      expect(response).toBe("test response");
      expect(vi.mocked(generateText)).toHaveBeenCalledWith({
        messages: [
          { role: PROVIDER.OPENROUTER.ROLE.USER, content: "test message" },
        ],
        model: expect.any(Object),
        maxTokens: PROVIDER.OPENROUTER.MAX_TOKENS.DEFAULT,
        system: "You are a test assistant",
      });
    });
  });

  describe("Features", () => {
    describe("Structured Output", () => {
      it("uses generateObject for structured output", async () => {
        const mockResponse = {
          object: {
            salutation: "Hello",
            name: "World",
          },
        } as any;

        vi.mocked(generateObject).mockResolvedValue(mockResponse);

        const provider = new OpenRouterProvider();
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

        expect(vi.mocked(generateObject)).toHaveBeenCalledWith({
          messages: [
            { role: PROVIDER.OPENROUTER.ROLE.USER, content: "Hello, World" },
          ],
          model: expect.any(Object),
          maxTokens: PROVIDER.OPENROUTER.MAX_TOKENS.DEFAULT,
          system: undefined,
          schema: expect.objectContaining({
            jsonSchema: expect.objectContaining({
              type: "object",
              properties: {
                salutation: { type: "string" },
                name: { type: "string" },
              },
              required: ["salutation", "name"],
            }),
          }),
        });
      });
    });

    describe("Message Options", () => {
      it("applies placeholders to system message", async () => {
        const mockResponse = {
          text: "test response",
        } as any;

        vi.mocked(generateText).mockResolvedValue(mockResponse);

        const provider = new OpenRouterProvider();
        const response = await provider.send("test message", {
          system: "You are a {{role}}",
          data: { role: "test assistant" },
        });

        expect(response).toBe("test response");
        expect(vi.mocked(generateText)).toHaveBeenCalledWith({
          messages: [
            { role: PROVIDER.OPENROUTER.ROLE.USER, content: "test message" },
          ],
          model: expect.any(Object),
          maxTokens: PROVIDER.OPENROUTER.MAX_TOKENS.DEFAULT,
          system: "You are a test assistant",
        });
      });

      it("applies placeholders to user message", async () => {
        const mockResponse = {
          text: "test response",
        } as any;

        vi.mocked(generateText).mockResolvedValue(mockResponse);

        const provider = new OpenRouterProvider();
        const response = await provider.send("Hello, {{name}}", {
          data: { name: "World" },
        });

        expect(response).toBe("test response");
        expect(vi.mocked(generateText)).toHaveBeenCalledWith({
          messages: [
            { role: PROVIDER.OPENROUTER.ROLE.USER, content: "Hello, World" },
          ],
          model: expect.any(Object),
          maxTokens: PROVIDER.OPENROUTER.MAX_TOKENS.DEFAULT,
        });
      });

      it("respects placeholders.message option", async () => {
        const mockResponse = {
          text: "test response",
        } as any;

        vi.mocked(generateText).mockResolvedValue(mockResponse);

        const provider = new OpenRouterProvider();
        const response = await provider.send("Hello, {{name}}", {
          data: { name: "World" },
          placeholders: { message: false },
        });

        expect(response).toBe("test response");
        expect(vi.mocked(generateText)).toHaveBeenCalledWith({
          messages: [
            { role: PROVIDER.OPENROUTER.ROLE.USER, content: "Hello, {{name}}" },
          ],
          model: expect.any(Object),
          maxTokens: PROVIDER.OPENROUTER.MAX_TOKENS.DEFAULT,
        });
      });

      it("respects placeholders.system option", async () => {
        const mockResponse = {
          text: "test response",
        } as any;

        vi.mocked(generateText).mockResolvedValue(mockResponse);

        const provider = new OpenRouterProvider();
        const response = await provider.send("test message", {
          system: "You are a {{role}}",
          data: { role: "test assistant" },
          placeholders: { system: false },
        });

        expect(response).toBe("test response");
        expect(vi.mocked(generateText)).toHaveBeenCalledWith({
          messages: [
            { role: PROVIDER.OPENROUTER.ROLE.USER, content: "test message" },
          ],
          model: expect.any(Object),
          maxTokens: PROVIDER.OPENROUTER.MAX_TOKENS.DEFAULT,
          system: "You are a {{role}}",
        });
      });
    });
  });

  describe("Operate Features", () => {
    describe("Structured Output", () => {
      it("operate returns structured output with history", async () => {
        const mockResponse = {
          text: "",
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          toolCalls: [
            {
              toolName: "structured_output",
              args: {
                salutation: "Hello",
                name: "World",
              },
            },
          ],
        } as any;

        vi.mocked(generateText).mockResolvedValue(mockResponse);

        const provider = new OpenRouterProvider();
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
          text: "",
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          toolCalls: [
            {
              toolName: "structured_output",
              args: {
                salutation: "Hello",
                name: "World",
              },
            },
          ],
        } as any;

        const mockResponse2 = {
          text: "",
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          toolCalls: [
            {
              toolName: "structured_output",
              args: {
                salutation: "Goodbye",
                name: "World",
              },
            },
          ],
        } as any;

        vi.mocked(generateText).mockResolvedValueOnce(mockResponse1);
        vi.mocked(generateText).mockResolvedValueOnce(mockResponse2);

        const provider = new OpenRouterProvider();
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

      it("sets toolChoice to 'required' when structured output is requested", async () => {
        const mockResponse = {
          text: "",
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          toolCalls: [
            {
              toolName: "structured_output",
              args: {
                salutation: "Hello",
                name: "World",
              },
            },
          ],
        } as any;

        vi.mocked(generateText).mockResolvedValue(mockResponse);

        const provider = new OpenRouterProvider();
        provider["apiKey"] = "test-key";

        const GreetingFormat = z.object({
          salutation: z.string(),
          name: z.string(),
        });

        await provider.operate("Hello, World", {
          format: GreetingFormat,
        });

        expect(vi.mocked(generateText)).toHaveBeenCalledWith(
          expect.objectContaining({
            toolChoice: "required",
          }),
        );
      });
    });

    describe("Message Options", () => {
      it("applies placeholders to system message", async () => {
        const mockResponse = {
          text: "test response",
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          toolCalls: [],
        } as any;

        vi.mocked(generateText).mockResolvedValue(mockResponse);

        const provider = new OpenRouterProvider();
        const response = await provider.operate("test message", {
          system: "You are a {{role}}",
          data: { role: "test assistant" },
        });

        expect(response.content).toBe("test response");
        expect(vi.mocked(generateText)).toHaveBeenCalledWith({
          messages: [
            { role: PROVIDER.OPENROUTER.ROLE.USER, content: "test message" },
          ],
          model: expect.any(Object),
          maxSteps: 9999,
          maxTokens: PROVIDER.OPENROUTER.MAX_TOKENS.DEFAULT,
          system: "You are a test assistant",
          tools: {},
          toolChoice: "auto",
        });
      });

      it("applies placeholders to user message", async () => {
        const mockResponse = {
          text: "test response",
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          toolCalls: [],
        } as any;

        vi.mocked(generateText).mockResolvedValue(mockResponse);

        const provider = new OpenRouterProvider();
        const response = await provider.operate("Hello, {{name}}", {
          data: { name: "World" },
        });

        expect(response.content).toBe("test response");
        expect(vi.mocked(generateText)).toHaveBeenCalledWith({
          messages: [
            { role: PROVIDER.OPENROUTER.ROLE.USER, content: "Hello, World" },
          ],
          model: expect.any(Object),
          maxSteps: 9999,
          maxTokens: PROVIDER.OPENROUTER.MAX_TOKENS.DEFAULT,
          tools: {},
          toolChoice: "auto",
        });
      });

      it("respects placeholders.input option", async () => {
        const mockResponse = {
          text: "test response",
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          toolCalls: [],
        } as any;

        vi.mocked(generateText).mockResolvedValue(mockResponse);

        const provider = new OpenRouterProvider();
        const response = await provider.operate("Hello, {{name}}", {
          data: { name: "World" },
          placeholders: { input: false },
        });

        expect(response.content).toBe("test response");
        expect(vi.mocked(generateText)).toHaveBeenCalledWith({
          messages: [
            { role: PROVIDER.OPENROUTER.ROLE.USER, content: "Hello, {{name}}" },
          ],
          model: expect.any(Object),
          maxSteps: 9999,
          tools: {},
          toolChoice: "auto",
          maxTokens: PROVIDER.OPENROUTER.MAX_TOKENS.DEFAULT,
        });
      });

      it("respects placeholders.system option", async () => {
        const mockResponse = {
          text: "test response",
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          toolCalls: [],
        } as any;

        vi.mocked(generateText).mockResolvedValue(mockResponse);

        const provider = new OpenRouterProvider();
        const response = await provider.operate("test message", {
          system: "You are a {{role}}",
          data: { role: "test assistant" },
          placeholders: { system: false },
        });

        expect(response.content).toBe("test response");
        expect(vi.mocked(generateText)).toHaveBeenCalledWith({
          messages: [
            { role: PROVIDER.OPENROUTER.ROLE.USER, content: "test message" },
          ],
          model: expect.any(Object),
          maxSteps: 9999,
          maxTokens: PROVIDER.OPENROUTER.MAX_TOKENS.DEFAULT,
          system: "You are a {{role}}",
          tools: {},
          toolChoice: "auto",
        });
      });
    });

    describe("Tool Calling", () => {
      it("processes tool calls correctly", async () => {
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

        // Mock generateText to simulate tool execution
        vi.mocked(generateText).mockImplementation(async (options: any) => {
          // Simulate the AI SDK calling the tool's execute function
          const toolResult = await options.tools.test_tool.execute(
            { param: "test" },
            { toolCallId: "test", messages: [] },
          );
          return {
            text: "Final response",
            toolCalls: [
              {
                toolName: "test_tool",
                args: { param: "test" },
              },
            ],
            toolResults: [
              {
                toolName: "test_tool",
                result: toolResult,
              },
            ],
            usage: {
              promptTokens: 10,
              completionTokens: 10,
              totalTokens: 20,
            },
            finishReason: "stop",
          } as any;
        });

        const provider = new OpenRouterProvider();
        provider["apiKey"] = "test-key";

        const response = await provider.operate("Test input", {
          tools: [mockTool],
        });

        expect(response.content).toBe("Final response");
        expect(mockTool.call).toHaveBeenCalledWith({ param: "test" });
      });

      it("calls beforeEachTool hook before executing a tool", async () => {
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

        vi.mocked(generateText).mockImplementation(async (options: any) => {
          const toolResult = await options.tools.test_tool.execute(
            { param: "test" },
            { toolCallId: "test", messages: [] },
          );
          return {
            text: "Final response",
            toolCalls: [
              {
                toolName: "test_tool",
                args: { param: "test" },
              },
            ],
            toolResults: [
              {
                toolName: "test_tool",
                result: toolResult,
              },
            ],
            usage: {
              promptTokens: 10,
              completionTokens: 10,
              totalTokens: 20,
            },
            finishReason: "stop",
          } as any;
        });

        const provider = new OpenRouterProvider();
        provider["apiKey"] = "test-key";

        await provider.operate("Test input", {
          tools: [mockTool],
          hooks: {
            beforeEachTool: beforeEachToolSpy,
          },
        });

        expect(beforeEachToolSpy).toHaveBeenCalledWith({
          toolName: "test_tool",
          args: '{"param":"test"}',
        });
        expect(beforeEachToolSpy).toHaveBeenCalledBefore(mockTool.call);
      });

      it("calls afterEachTool hook after executing a tool", async () => {
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

        const afterEachToolSpy = vi.fn();

        vi.mocked(generateText).mockImplementation(async (options: any) => {
          const toolResult = await options.tools.test_tool.execute(
            { param: "test" },
            { toolCallId: "test", messages: [] },
          );
          return {
            text: "Final response",
            toolCalls: [
              {
                toolName: "test_tool",
                args: { param: "test" },
              },
            ],
            toolResults: [
              {
                toolName: "test_tool",
                result: toolResult,
              },
            ],
            usage: {
              promptTokens: 10,
              completionTokens: 10,
              totalTokens: 20,
            },
            finishReason: "stop",
          } as any;
        });

        const provider = new OpenRouterProvider();
        provider["apiKey"] = "test-key";

        await provider.operate("Test input", {
          tools: [mockTool],
          hooks: {
            afterEachTool: afterEachToolSpy,
          },
        });

        expect(afterEachToolSpy).toHaveBeenCalledWith({
          toolName: "test_tool",
          args: '{"param":"test"}',
          result: '{"result":"test result"}',
        });
        expect(mockTool.call).toHaveBeenCalledBefore(afterEachToolSpy);
      });

      it("calls onToolError hook when tool execution fails", async () => {
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

        const onToolErrorSpy = vi.fn();

        // Mock generateText to simulate tool execution error with hooks
        vi.mocked(generateText).mockImplementation(async (options: any) => {
          await options.tools.test_tool.execute(
            { param: "test" },
            { toolCallId: "test", messages: [] },
          );
        });

        const provider = new OpenRouterProvider();
        provider["apiKey"] = "test-key";

        await expect(
          provider.operate("Test input", {
            tools: [mockTool],
            hooks: {
              onToolError: onToolErrorSpy,
            },
          }),
        ).rejects.toThrow("Tool error");

        expect(onToolErrorSpy).toHaveBeenCalledWith({
          error: expect.any(Error),
          toolName: "test_tool",
          args: '{"param":"test"}',
        });
      });

      it("accepts a Toolkit object in tools field", async () => {
        const mockResponse = {
          text: "test response",
          toolCalls: [],
          toolResults: [],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          finishReason: "stop",
        } as any;

        vi.mocked(generateText).mockResolvedValue(mockResponse);

        const provider = new OpenRouterProvider();
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

        const toolkit = new Toolkit([mockTool], { explain: true });

        await provider.operate("Test input", {
          tools: toolkit,
        });

        expect(vi.mocked(generateText)).toHaveBeenCalledWith(
          expect.objectContaining({
            tools: expect.objectContaining({
              test_tool: expect.objectContaining({
                name: "test_tool",
                parameters: expect.any(Object),
                type: "function",
                execute: expect.any(Function),
              }),
            }),
          }),
        );
      });
    });

    describe("History Tracking", () => {
      it("maintains conversation history across operate calls", async () => {
        const mockResponse1 = {
          text: "first response",
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          toolCalls: [],
        } as any;
        const mockResponse2 = {
          text: "second response",
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          toolCalls: [],
        } as any;

        vi.mocked(generateText).mockResolvedValueOnce(mockResponse1);
        vi.mocked(generateText).mockResolvedValueOnce(mockResponse2);

        const provider = new OpenRouterProvider();
        provider["apiKey"] = "test-key";

        // First call
        const response1 = await provider.operate("first message");
        expect(response1.content).toBe("first response");
        expect(vi.mocked(generateText)).toHaveBeenLastCalledWith({
          messages: [
            { role: PROVIDER.OPENROUTER.ROLE.USER, content: "first message" },
          ],
          model: expect.any(Object),
          maxSteps: 9999,
          maxTokens: PROVIDER.OPENROUTER.MAX_TOKENS.DEFAULT,
          system: undefined,
          tools: {},
          toolChoice: "auto",
        });

        // Second call
        const response2 = await provider.operate("second message");
        expect(response2.content).toBe("second response");
        expect(vi.mocked(generateText)).toHaveBeenLastCalledWith({
          messages: [
            { role: PROVIDER.OPENROUTER.ROLE.USER, content: "first message" },
            {
              role: PROVIDER.OPENROUTER.ROLE.ASSISTANT,
              content: "first response",
            },
            { role: PROVIDER.OPENROUTER.ROLE.USER, content: "second message" },
          ],
          model: expect.any(Object),
          maxSteps: 9999,
          maxTokens: PROVIDER.OPENROUTER.MAX_TOKENS.DEFAULT,
          system: undefined,
          tools: {},
          toolChoice: "auto",
        });

        expect(vi.mocked(generateText)).toHaveBeenCalledTimes(2);
      });

      it("merges provided history with tracked history", async () => {
        const mockResponse = {
          text: "response",
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          toolCalls: [],
        } as any;

        vi.mocked(generateText).mockResolvedValue(mockResponse);

        const provider = new OpenRouterProvider();
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

        expect(vi.mocked(generateText)).toHaveBeenLastCalledWith({
          messages: [
            { role: PROVIDER.OPENROUTER.ROLE.USER, content: "first message" },
            { role: PROVIDER.OPENROUTER.ROLE.ASSISTANT, content: "response" },
            {
              role: PROVIDER.OPENROUTER.ROLE.USER,
              content: "previous message",
            },
            {
              role: PROVIDER.OPENROUTER.ROLE.ASSISTANT,
              content: "previous response",
            },
            { role: PROVIDER.OPENROUTER.ROLE.USER, content: "new message" },
          ],
          model: expect.any(Object),
          maxSteps: 9999,
          maxTokens: PROVIDER.OPENROUTER.MAX_TOKENS.DEFAULT,
          system: undefined,
          tools: {},
          toolChoice: "auto",
        });
      });

      it("updates tracked history after each operate call", async () => {
        const mockResponse = {
          text: "response",
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          toolCalls: [],
        } as any;

        vi.mocked(generateText).mockResolvedValue(mockResponse);

        const provider = new OpenRouterProvider();
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

    describe.todo("LlmOperateOptions", () => {
      it("applies data to input message", async () => {
        const mockResponse = {
          content: [{ type: "text", text: "test response" }],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        // vi.mocked(Anthropic).mockImplementation(
        //   () =>
        //     ({
        //       messages: {
        //         create: mockCreate,
        //       },
        //     }) as any,
        // );

        const provider = new OpenRouterProvider();
        provider["apiKey"] = "test-key";

        await provider.operate("Hello, {{name}}", {
          data: { name: "World" },
        });

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [
              { role: PROVIDER.ANTHROPIC.ROLE.USER, content: "Hello, World" },
            ],
          }),
        );
      });

      it("applies data to instructions", async () => {
        const mockResponse = {
          content: [{ type: "text", text: "test response" }],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          toolCalls: [],
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        // vi.mocked(Anthropic).mockImplementation(
        //   () =>
        //     ({
        //       messages: {
        //         create: mockCreate,
        //       },
        //     }) as any,
        // );

        const provider = new OpenRouterProvider();
        provider["apiKey"] = "test-key";

        await provider.operate("test message", {
          data: { role: "test assistant" },
          instructions: "You are a {{role}}",
        });

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [
              {
                role: PROVIDER.ANTHROPIC.ROLE.USER,
                content: "test message\n\nYou are a test assistant",
              },
            ],
          }),
        );
      });

      it("applies data to system message", async () => {
        const mockResponse = {
          content: [{ type: "text", text: "test response" }],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        // vi.mocked(Anthropic).mockImplementation(
        //   () =>
        //     ({
        //       messages: {
        //         create: mockCreate,
        //       },
        //     }) as any,
        // );

        const provider = new OpenRouterProvider();
        provider["apiKey"] = "test-key";

        await provider.operate("test message", {
          data: { role: "test assistant" },
          system: "You are a {{role}}",
        });

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            system: "You are a test assistant",
          }),
        );
      });

      it("respects placeholders.input option", async () => {
        const mockResponse = {
          content: [{ type: "text", text: "test response" }],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        // vi.mocked(Anthropic).mockImplementation(
        //   () =>
        //     ({
        //       messages: {
        //         create: mockCreate,
        //       },
        //     }) as any,
        // );

        const provider = new OpenRouterProvider();
        provider["apiKey"] = "test-key";

        await provider.operate("Hello, {{name}}", {
          data: { name: "World" },
          placeholders: { input: false },
        });

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [
              {
                role: PROVIDER.ANTHROPIC.ROLE.USER,
                content: "Hello, {{name}}",
              },
            ],
          }),
        );
      });

      it("respects placeholders.instructions option", async () => {
        const mockResponse = {
          content: [{ type: "text", text: "test response" }],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        // vi.mocked(Anthropic).mockImplementation(
        //   () =>
        //     ({
        //       messages: {
        //         create: mockCreate,
        //       },
        //     }) as any,
        // );

        const provider = new OpenRouterProvider();
        provider["apiKey"] = "test-key";

        await provider.operate("test message", {
          data: { role: "test assistant" },
          instructions: "You are a {{role}}",
          placeholders: { instructions: false },
        });

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [
              {
                role: PROVIDER.ANTHROPIC.ROLE.USER,
                content: "test message\n\nYou are a {{role}}",
              },
            ],
          }),
        );
      });

      it("respects placeholders.system option", async () => {
        const mockResponse = {
          content: [{ type: "text", text: "test response" }],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        // vi.mocked(Anthropic).mockImplementation(
        //   () =>
        //     ({
        //       messages: {
        //         create: mockCreate,
        //       },
        //     }) as any,
        // );

        const provider = new OpenRouterProvider();
        provider["apiKey"] = "test-key";

        await provider.operate("test message", {
          data: { role: "test assistant" },
          system: "You are a {{role}}",
          placeholders: { system: false },
        });

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            system: "You are a {{role}}",
          }),
        );
      });

      it("applies providerOptions to the request", async () => {
        const mockResponse = {
          content: [{ type: "text", text: "test response" }],
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        // vi.mocked(Anthropic).mockImplementation(
        //   () =>
        //     ({
        //       messages: {
        //         create: mockCreate,
        //       },
        //     }) as any,
        // );

        const provider = new OpenRouterProvider();
        provider["apiKey"] = "test-key";

        await provider.operate("test message", {
          providerOptions: {
            temperature: 0.7,
            top_p: 0.9,
          },
        });

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            temperature: 0.7,
            top_p: 0.9,
          }),
        );
      });

      it("applies turns option to limit conversation turns", async () => {
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
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse1);
        // vi.mocked(Anthropic).mockImplementation(
        //   () =>
        //     ({
        //       messages: {
        //         create: mockCreate,
        //       },
        //     }) as any,
        // );

        const provider = new OpenRouterProvider();
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
          turns: 1,
        });

        expect(response.status).toBe(LlmResponseStatus.Incomplete);
        expect(response.error?.detail).toContain("exceeded 1 turns");
      });

      it("applies explain option to tool calls", async () => {
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
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        };

        const mockResponse2 = {
          content: [{ type: "text", text: "Final response" }],
          stop_reason: "end_turn",
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        };

        const mockCreate = vi
          .fn()
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        // vi.mocked(Anthropic).mockImplementation(
        //   () =>
        //     ({
        //       messages: {
        //         create: mockCreate,
        //       },
        //     }) as any,
        // );

        const provider = new OpenRouterProvider();
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

        await provider.operate("Test input", {
          tools: [mockTool],
          explain: true,
        });

        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            tools: expect.arrayContaining([
              expect.objectContaining({
                input_schema: expect.objectContaining({
                  properties: expect.objectContaining({
                    __Explanation: expect.any(Object),
                  }),
                }),
              }),
            ]),
          }),
        );
      });
    });
  });
});
