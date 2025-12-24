import { describe, expect, it, vi } from "vitest";

import { OpenRouterAdapter, openRouterAdapter } from "../OpenRouterAdapter.js";
import { PROVIDER } from "../../../constants.js";
import { Toolkit } from "../../../tools/Toolkit.class.js";
import { ErrorCategory, OperateRequest } from "../../types.js";
import {
  LlmMessageRole,
  LlmMessageType,
} from "../../../types/LlmProvider.interface.js";

//
//
// Mock
//

vi.mock("@openrouter/sdk", () => ({
  OpenRouter: vi.fn(),
}));

vi.mock("zod/v4", () => ({
  z: {
    ZodType: class ZodType {},
    toJSONSchema: vi.fn(() => ({ type: "object", properties: {} })),
  },
}));

//
//
// Tests
//

describe("OpenRouterAdapter", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("exports OpenRouterAdapter class", () => {
      expect(OpenRouterAdapter).toBeDefined();
      expect(typeof OpenRouterAdapter).toBe("function");
    });

    it("exports openRouterAdapter singleton", () => {
      expect(openRouterAdapter).toBeDefined();
      expect(openRouterAdapter).toBeInstanceOf(OpenRouterAdapter);
    });

    it("has correct name", () => {
      expect(openRouterAdapter.name).toBe(PROVIDER.OPENROUTER.NAME);
    });

    it("has correct default model", () => {
      expect(openRouterAdapter.defaultModel).toBe(
        PROVIDER.OPENROUTER.MODEL.DEFAULT,
      );
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    describe("buildRequest", () => {
      it("builds basic request", () => {
        const request: OperateRequest = {
          model: "openai/gpt-4",
          messages: [
            {
              content: "Hello",
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
            },
          ],
        };

        const result = openRouterAdapter.buildRequest(request);

        expect(result.model).toBe("openai/gpt-4");
        expect(result.messages).toHaveLength(1);
      });

      it("includes system message when provided", () => {
        const request: OperateRequest = {
          model: "openai/gpt-4",
          messages: [
            {
              content: "Hello",
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
            },
          ],
          system: "You are helpful",
        };

        const result = openRouterAdapter.buildRequest(request);

        expect(result.messages[0].role).toBe("system");
        expect(result.messages[0].content).toBe("You are helpful");
      });

      it("appends instructions to last message", () => {
        const request: OperateRequest = {
          model: "openai/gpt-4",
          messages: [
            {
              content: "Hello",
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
            },
          ],
          instructions: "Be concise",
        };

        const result = openRouterAdapter.buildRequest(request);

        expect(result.messages[0].content).toContain("Hello");
        expect(result.messages[0].content).toContain("Be concise");
      });

      it("includes tools when provided", () => {
        const request: OperateRequest = {
          model: "openai/gpt-4",
          messages: [],
          tools: [
            {
              name: "test_tool",
              description: "A test tool",
              parameters: { type: "object" },
            },
          ],
        };

        const result = openRouterAdapter.buildRequest(request);

        expect(result.tools).toHaveLength(1);
        expect(result.tools![0].type).toBe("function");
        expect(result.tools![0].function.name).toBe("test_tool");
        expect(result.tool_choice).toBe("auto");
      });

      it("includes user when provided", () => {
        const request: OperateRequest = {
          model: "openai/gpt-4",
          messages: [],
          user: "user-123",
        };

        const result = openRouterAdapter.buildRequest(request);

        expect(result.user).toBe("user-123");
      });
    });

    describe("parseResponse", () => {
      it("parses response with text content", () => {
        const response = {
          id: "resp-123",
          model: "openai/gpt-4",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "Hello there!",
              },
              finishReason: "stop",
            },
          ],
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
        };

        const result = openRouterAdapter.parseResponse(response);

        expect(result.content).toBe("Hello there!");
        expect(result.hasToolCalls).toBe(false);
        expect(result.stopReason).toBe("stop");
      });

      it("detects tool use", () => {
        const response = {
          id: "resp-123",
          model: "openai/gpt-4",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: null,
                toolCalls: [
                  {
                    id: "call-123",
                    type: "function",
                    function: { name: "test", arguments: "{}" },
                  },
                ],
              },
              finishReason: "toolCalls",
            },
          ],
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
        };

        const result = openRouterAdapter.parseResponse(response);

        expect(result.hasToolCalls).toBe(true);
      });
    });

    describe("extractToolCalls", () => {
      it("extracts tool calls from response", () => {
        const response = {
          id: "resp-123",
          model: "openai/gpt-4",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: null,
                toolCalls: [
                  {
                    id: "call-123",
                    type: "function",
                    function: {
                      name: "test_tool",
                      arguments: '{"key":"value"}',
                    },
                  },
                ],
              },
              finishReason: "toolCalls",
            },
          ],
        };

        const result = openRouterAdapter.extractToolCalls(response);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("test_tool");
        expect(result[0].callId).toBe("call-123");
        expect(result[0].arguments).toBe('{"key":"value"}');
      });

      it("returns empty array when no tool calls", () => {
        const response = {
          id: "resp-123",
          model: "openai/gpt-4",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "Hello",
              },
              finishReason: "stop",
            },
          ],
        };

        const result = openRouterAdapter.extractToolCalls(response);

        expect(result).toHaveLength(0);
      });
    });

    describe("extractUsage", () => {
      it("extracts usage from response", () => {
        const response = {
          usage: {
            promptTokens: 100,
            completionTokens: 200,
            totalTokens: 300,
          },
        };

        const result = openRouterAdapter.extractUsage(response, "openai/gpt-4");

        expect(result.input).toBe(100);
        expect(result.output).toBe(200);
        expect(result.total).toBe(300);
        expect(result.reasoning).toBe(0);
        expect(result.provider).toBe(PROVIDER.OPENROUTER.NAME);
        expect(result.model).toBe("openai/gpt-4");
      });

      it("returns zeros when usage is missing", () => {
        const response = {};

        const result = openRouterAdapter.extractUsage(response, "openai/gpt-4");

        expect(result.input).toBe(0);
        expect(result.output).toBe(0);
        expect(result.total).toBe(0);
      });
    });
  });

  // Features
  describe("Features", () => {
    describe("formatTools", () => {
      it("formats toolkit to provider definitions", () => {
        const toolkit = new Toolkit([
          {
            name: "test",
            description: "Test tool",
            parameters: { type: "object" },
            type: "function",
            call: vi.fn(),
          },
        ]);

        const result = openRouterAdapter.formatTools(toolkit);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("test");
        expect(result[0].description).toBe("Test tool");
      });

      it("adds structured output tool when schema provided", () => {
        const toolkit = new Toolkit([
          {
            name: "test",
            description: "Test tool",
            parameters: { type: "object" },
            type: "function",
            call: vi.fn(),
          },
        ]);
        const schema = {
          type: "object",
          properties: { name: { type: "string" } },
        };

        const result = openRouterAdapter.formatTools(toolkit, schema);

        expect(result).toHaveLength(2);
        expect(result[1].name).toBe("structured_output");
      });
    });

    describe("formatToolResult", () => {
      it("formats tool result correctly", () => {
        const toolCall = {
          callId: "call-123",
          name: "test_tool",
          arguments: "{}",
          raw: {},
        };
        const result = {
          callId: "call-123",
          output: '{"result": "success"}',
          success: true,
        };

        const formatted = openRouterAdapter.formatToolResult(toolCall, result);

        expect(formatted.toolCallId).toBe("call-123");
        expect(formatted.content).toBe('{"result": "success"}');
        expect(formatted.role).toBe("tool");
      });
    });

    describe("appendToolResult", () => {
      it("appends assistant message and tool result", () => {
        const request = {
          model: "openai/gpt-4",
          messages: [{ role: "user", content: "Hello" }],
        };
        const toolCall = {
          callId: "call-123",
          name: "test_tool",
          arguments: "{}",
          raw: {
            id: "call-123",
            type: "function",
            function: { name: "test_tool", arguments: "{}" },
          },
        };
        const result = {
          callId: "call-123",
          output: '{"result": "success"}',
          success: true,
        };

        const updated = openRouterAdapter.appendToolResult(
          request,
          toolCall,
          result,
        );

        expect(updated.messages).toHaveLength(3);
        expect(updated.messages[1].role).toBe("assistant");
        // SDK uses camelCase
        expect(updated.messages[1].toolCalls).toBeDefined();
        expect(updated.messages[2].role).toBe("tool");
        expect(updated.messages[2].toolCallId).toBe("call-123");
      });
    });

    describe("isComplete", () => {
      it("returns true when no tool calls", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: "Done",
              },
              finishReason: "stop",
            },
          ],
        };

        expect(openRouterAdapter.isComplete(response)).toBe(true);
      });

      it("returns false when tool calls present", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                toolCalls: [
                  {
                    id: "call-123",
                    type: "function",
                    function: { name: "test", arguments: "{}" },
                  },
                ],
              },
              finishReason: "toolCalls",
            },
          ],
        };

        expect(openRouterAdapter.isComplete(response)).toBe(false);
      });
    });

    describe("hasStructuredOutput", () => {
      it("returns true when structured_output tool is used", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                toolCalls: [
                  {
                    id: "call-123",
                    type: "function",
                    function: {
                      name: "structured_output",
                      arguments: '{"key":"value"}',
                    },
                  },
                ],
              },
              finishReason: "toolCalls",
            },
          ],
        };

        expect(openRouterAdapter.hasStructuredOutput(response)).toBe(true);
      });

      it("returns false for regular tool use", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                toolCalls: [
                  {
                    id: "call-123",
                    type: "function",
                    function: { name: "other_tool", arguments: "{}" },
                  },
                ],
              },
              finishReason: "toolCalls",
            },
          ],
        };

        expect(openRouterAdapter.hasStructuredOutput(response)).toBe(false);
      });

      it("returns false when no tool calls", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: "Hello",
              },
              finishReason: "stop",
            },
          ],
        };

        expect(openRouterAdapter.hasStructuredOutput(response)).toBe(false);
      });
    });

    describe("extractStructuredOutput", () => {
      it("extracts structured output from response", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                toolCalls: [
                  {
                    id: "call-123",
                    type: "function",
                    function: {
                      name: "structured_output",
                      arguments: '{"name":"John","age":30}',
                    },
                  },
                ],
              },
              finishReason: "toolCalls",
            },
          ],
        };

        const result = openRouterAdapter.extractStructuredOutput(response);

        expect(result).toEqual({ name: "John", age: 30 });
      });

      it("returns undefined for non-structured responses", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: "Hello",
              },
              finishReason: "stop",
            },
          ],
        };

        const result = openRouterAdapter.extractStructuredOutput(response);

        expect(result).toBeUndefined();
      });

      it("returns undefined for invalid JSON", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                toolCalls: [
                  {
                    id: "call-123",
                    type: "function",
                    function: {
                      name: "structured_output",
                      arguments: "not valid json",
                    },
                  },
                ],
              },
              finishReason: "toolCalls",
            },
          ],
        };

        const result = openRouterAdapter.extractStructuredOutput(response);

        expect(result).toBeUndefined();
      });
    });

    describe("classifyError", () => {
      it("classifies rate limit error by status code", () => {
        const error = { status: 429, message: "Too many requests" };

        const result = openRouterAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.RateLimit);
        expect(result.shouldRetry).toBe(false);
      });

      it("classifies retryable error by status code", () => {
        const error = { status: 500, message: "Internal server error" };

        const result = openRouterAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Retryable);
        expect(result.shouldRetry).toBe(true);
      });

      it("classifies 502 as retryable", () => {
        const error = { status: 502, message: "Bad gateway" };

        const result = openRouterAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Retryable);
        expect(result.shouldRetry).toBe(true);
      });

      it("classifies 503 as retryable", () => {
        const error = { status: 503, message: "Service unavailable" };

        const result = openRouterAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Retryable);
        expect(result.shouldRetry).toBe(true);
      });

      it("classifies unrecoverable error by status code", () => {
        const error = { status: 401, message: "Unauthorized" };

        const result = openRouterAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Unrecoverable);
        expect(result.shouldRetry).toBe(false);
      });

      it("classifies 400 as unrecoverable", () => {
        const error = { status: 400, message: "Bad request" };

        const result = openRouterAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Unrecoverable);
        expect(result.shouldRetry).toBe(false);
      });

      it("classifies rate limit error by message", () => {
        const error = new Error("Rate limit exceeded");

        const result = openRouterAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.RateLimit);
        expect(result.shouldRetry).toBe(false);
      });

      it("classifies unknown error as retryable", () => {
        const error = new Error("Unknown error");

        const result = openRouterAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Unknown);
        expect(result.shouldRetry).toBe(true);
      });
    });

    describe("responseToHistoryItems", () => {
      it("returns assistant message for text response", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: "Hello there!",
              },
              finishReason: "stop",
            },
          ],
        };

        const result = openRouterAdapter.responseToHistoryItems(response);

        expect(result).toHaveLength(1);
        expect((result[0] as { content: string }).content).toBe("Hello there!");
        expect((result[0] as { role: string }).role).toBe(
          LlmMessageRole.Assistant,
        );
      });

      it("returns empty array for tool use response", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                toolCalls: [
                  {
                    id: "call-123",
                    type: "function",
                    function: { name: "test", arguments: "{}" },
                  },
                ],
              },
              finishReason: "toolCalls",
            },
          ],
        };

        const result = openRouterAdapter.responseToHistoryItems(response);

        expect(result).toHaveLength(0);
      });
    });
  });

  // Specific Scenarios
  describe("Specific Scenarios", () => {
    it("uses default model when not specified", () => {
      const request: OperateRequest = {
        model: "",
        messages: [],
      };

      const result = openRouterAdapter.buildRequest(request);

      expect(result.model).toBe(PROVIDER.OPENROUTER.MODEL.DEFAULT);
    });

    it("sets tool_choice to required when structured output tool present", () => {
      const request: OperateRequest = {
        model: "openai/gpt-4",
        messages: [],
        tools: [
          {
            name: "structured_output",
            description: "Structured output",
            parameters: { type: "object" },
          },
        ],
      };

      const result = openRouterAdapter.buildRequest(request);

      expect(result.tool_choice).toBe("required");
    });

    it("handles multiple tool calls in a single response", () => {
      const response = {
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              toolCalls: [
                {
                  id: "call-1",
                  type: "function",
                  function: { name: "tool_1", arguments: '{"a":1}' },
                },
                {
                  id: "call-2",
                  type: "function",
                  function: { name: "tool_2", arguments: '{"b":2}' },
                },
              ],
            },
            finishReason: "toolCalls",
          },
        ],
      };

      const result = openRouterAdapter.extractToolCalls(response);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("tool_1");
      expect(result[1].name).toBe("tool_2");
    });

    it("converts messages with different roles correctly", () => {
      const request: OperateRequest = {
        model: "openai/gpt-4",
        messages: [
          {
            content: "System prompt",
            role: "system" as any,
          },
          {
            content: "User message",
            role: "user" as any,
          },
          {
            content: "Assistant response",
            role: "assistant" as any,
          },
        ],
      };

      const result = openRouterAdapter.buildRequest(request);

      expect(result.messages[0].role).toBe("system");
      expect(result.messages[1].role).toBe("user");
      expect(result.messages[2].role).toBe("assistant");
    });
  });
});
