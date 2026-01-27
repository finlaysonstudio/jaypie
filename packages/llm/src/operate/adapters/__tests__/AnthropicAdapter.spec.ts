import { describe, expect, it, vi } from "vitest";

import { AnthropicAdapter, anthropicAdapter } from "../AnthropicAdapter.js";
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

vi.mock("@anthropic-ai/sdk", () => ({
  Anthropic: vi.fn(),
  APIConnectionError: class APIConnectionError extends Error {
    constructor(..._args: any[]) {
      super("Connection error");
      this.name = "APIConnectionError";
    }
  },
  APIConnectionTimeoutError: class APIConnectionTimeoutError extends Error {
    constructor(..._args: any[]) {
      super("Timeout");
      this.name = "APIConnectionTimeoutError";
    }
  },
  AuthenticationError: class AuthenticationError extends Error {
    constructor(..._args: any[]) {
      super("Auth error");
      this.name = "AuthenticationError";
    }
  },
  BadRequestError: class BadRequestError extends Error {
    constructor(..._args: any[]) {
      super("Bad request");
      this.name = "BadRequestError";
    }
  },
  InternalServerError: class InternalServerError extends Error {
    constructor(..._args: any[]) {
      super("Internal error");
      this.name = "InternalServerError";
    }
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(..._args: any[]) {
      super("Not found");
      this.name = "NotFoundError";
    }
  },
  PermissionDeniedError: class PermissionDeniedError extends Error {
    constructor(..._args: any[]) {
      super("Permission denied");
      this.name = "PermissionDeniedError";
    }
  },
  RateLimitError: class RateLimitError extends Error {
    constructor(..._args: any[]) {
      super("Rate limit");
      this.name = "RateLimitError";
    }
  },
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

describe("AnthropicAdapter", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("exports AnthropicAdapter class", () => {
      expect(AnthropicAdapter).toBeDefined();
      expect(typeof AnthropicAdapter).toBe("function");
    });

    it("exports anthropicAdapter singleton", () => {
      expect(anthropicAdapter).toBeDefined();
      expect(anthropicAdapter).toBeInstanceOf(AnthropicAdapter);
    });

    it("has correct name", () => {
      expect(anthropicAdapter.name).toBe(PROVIDER.ANTHROPIC.NAME);
    });

    it("has correct default model", () => {
      expect(anthropicAdapter.defaultModel).toBe(
        PROVIDER.ANTHROPIC.MODEL.DEFAULT,
      );
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    describe("buildRequest", () => {
      it("builds basic request", () => {
        const request: OperateRequest = {
          model: PROVIDER.ANTHROPIC.MODEL.LARGE,
          messages: [
            {
              content: "Hello",
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
            },
          ],
        };

        const result = anthropicAdapter.buildRequest(request);

        expect(result.model).toBe(PROVIDER.ANTHROPIC.MODEL.LARGE);
        expect(result.messages).toHaveLength(1);
        // Type property should be removed for Anthropic
        expect(
          (result.messages[0] as unknown as Record<string, unknown>).type,
        ).toBeUndefined();
      });

      it("includes system when provided", () => {
        const request: OperateRequest = {
          model: PROVIDER.ANTHROPIC.MODEL.LARGE,
          messages: [],
          system: "You are helpful",
        };

        const result = anthropicAdapter.buildRequest(request);

        expect(result.system).toBe("You are helpful");
      });

      it("filters out system messages from messages array", () => {
        // Anthropic only accepts system as a top-level field, not as a message role
        const request: OperateRequest = {
          model: PROVIDER.ANTHROPIC.MODEL.LARGE,
          messages: [
            {
              content: "You are a helpful assistant",
              role: LlmMessageRole.System,
              type: LlmMessageType.Message,
            },
            {
              content: "Hello",
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
            },
          ],
          system: "You are a helpful assistant",
        };

        const result = anthropicAdapter.buildRequest(request);

        // System message should be filtered out from messages
        expect(result.messages).toHaveLength(1);
        expect(result.messages[0].role).toBe("user");
        expect(result.messages[0].content).toBe("Hello");
        // System should only be in the top-level field
        expect(result.system).toBe("You are a helpful assistant");
      });

      it("appends instructions to last message", () => {
        const request: OperateRequest = {
          model: PROVIDER.ANTHROPIC.MODEL.LARGE,
          messages: [
            {
              content: "Hello",
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
            },
          ],
          instructions: "Be concise",
        };

        const result = anthropicAdapter.buildRequest(request);

        expect(result.messages[0].content).toContain("Hello");
        expect(result.messages[0].content).toContain("Be concise");
      });

      it("includes tools when provided", () => {
        const request: OperateRequest = {
          model: PROVIDER.ANTHROPIC.MODEL.LARGE,
          messages: [],
          tools: [
            {
              name: "test_tool",
              description: "A test tool",
              parameters: { type: "object" },
            },
          ],
        };

        const result = anthropicAdapter.buildRequest(request);

        expect(result.tools).toHaveLength(1);
        expect(result.tool_choice).toEqual({ type: "auto" });
      });

      it("handles FunctionCall messages from StreamLoop (issue #165)", () => {
        const request: OperateRequest = {
          model: PROVIDER.ANTHROPIC.MODEL.LARGE,
          messages: [
            {
              role: LlmMessageRole.User,
              content: "List items",
              type: LlmMessageType.Message,
            },
            // This is how StreamLoop adds tool calls to history
            {
              type: LlmMessageType.FunctionCall,
              name: "list_items",
              arguments: "{}",
              call_id: "toolu_123",
              id: "toolu_123",
            } as any,
          ],
        };

        const result = anthropicAdapter.buildRequest(request);

        expect(result.messages).toHaveLength(2);
        expect(result.messages[0].role).toBe("user");
        expect(result.messages[1].role).toBe("assistant");
        expect(result.messages[1].content).toEqual([
          {
            type: "tool_use",
            id: "toolu_123",
            name: "list_items",
            input: {},
          },
        ]);
      });

      it("handles FunctionCallOutput messages from StreamLoop (issue #165)", () => {
        const request: OperateRequest = {
          model: PROVIDER.ANTHROPIC.MODEL.LARGE,
          messages: [
            {
              role: LlmMessageRole.User,
              content: "List items",
              type: LlmMessageType.Message,
            },
            {
              type: LlmMessageType.FunctionCall,
              name: "list_items",
              arguments: "{}",
              call_id: "toolu_123",
              id: "toolu_123",
            } as any,
            // This is how StreamLoop adds tool results to history
            {
              type: LlmMessageType.FunctionCallOutput,
              output: '{"items":[{"id":"1","name":"test"}]}',
              call_id: "toolu_123",
              name: "list_items",
            } as any,
          ],
        };

        const result = anthropicAdapter.buildRequest(request);

        expect(result.messages).toHaveLength(3);
        expect(result.messages[2].role).toBe("user");
        expect(result.messages[2].content).toEqual([
          {
            type: "tool_result",
            tool_use_id: "toolu_123",
            content: '{"items":[{"id":"1","name":"test"}]}',
          },
        ]);
      });

      it("handles complete multi-turn conversation with tools (issue #165)", () => {
        const request: OperateRequest = {
          model: PROVIDER.ANTHROPIC.MODEL.LARGE,
          messages: [
            {
              role: LlmMessageRole.User,
              content: "List items",
              type: LlmMessageType.Message,
            },
            {
              type: LlmMessageType.FunctionCall,
              name: "list_items",
              arguments: "{}",
              call_id: "toolu_123",
              id: "toolu_123",
            } as any,
            {
              type: LlmMessageType.FunctionCallOutput,
              output: '{"items":[{"id":"1"}]}',
              call_id: "toolu_123",
              name: "list_items",
            } as any,
          ],
        };

        // This should not throw "Cannot read properties of undefined (reading 'map')"
        const result = anthropicAdapter.buildRequest(request);

        expect(result.messages).toHaveLength(3);
        // First message: user request
        expect(result.messages[0].role).toBe("user");
        // Second message: assistant tool use
        expect(result.messages[1].role).toBe("assistant");
        // Third message: user tool result
        expect(result.messages[2].role).toBe("user");
      });
    });

    describe("parseResponse", () => {
      it("parses response with text content", () => {
        const response = {
          content: [{ type: "text", text: "Hello there!" }],
          stop_reason: "end_turn",
          model: PROVIDER.ANTHROPIC.MODEL.LARGE,
          usage: {
            input_tokens: 10,
            output_tokens: 20,
          },
        };

        const result = anthropicAdapter.parseResponse(response);

        expect(result.content).toBe("Hello there!");
        expect(result.hasToolCalls).toBe(false);
        expect(result.stopReason).toBe("end_turn");
      });

      it("detects tool use", () => {
        const response = {
          content: [
            { type: "tool_use", id: "tool-123", name: "test", input: {} },
          ],
          stop_reason: "tool_use",
          model: PROVIDER.ANTHROPIC.MODEL.LARGE,
          usage: {
            input_tokens: 10,
            output_tokens: 20,
          },
        };

        const result = anthropicAdapter.parseResponse(response);

        expect(result.hasToolCalls).toBe(true);
      });
    });

    describe("extractToolCalls", () => {
      it("extracts tool calls from response", () => {
        const response = {
          content: [
            {
              type: "tool_use",
              id: "tool-123",
              name: "test_tool",
              input: { key: "value" },
            },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 10, output_tokens: 20 },
        };

        const result = anthropicAdapter.extractToolCalls(response);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("test_tool");
        expect(result[0].callId).toBe("tool-123");
        expect(result[0].arguments).toBe('{"key":"value"}');
      });

      it("returns empty array when no tool calls", () => {
        const response = {
          content: [{ type: "text", text: "Hello" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 20 },
        };

        const result = anthropicAdapter.extractToolCalls(response);

        expect(result).toHaveLength(0);
      });
    });

    describe("extractUsage", () => {
      it("extracts usage from response", () => {
        const response = {
          usage: {
            input_tokens: 100,
            output_tokens: 200,
          },
        };

        const result = anthropicAdapter.extractUsage(
          response,
          PROVIDER.ANTHROPIC.MODEL.LARGE,
        );

        expect(result.input).toBe(100);
        expect(result.output).toBe(200);
        expect(result.total).toBe(300);
        expect(result.reasoning).toBe(0); // Anthropic doesn't expose this
        expect(result.provider).toBe(PROVIDER.ANTHROPIC.NAME);
        expect(result.model).toBe(PROVIDER.ANTHROPIC.MODEL.LARGE);
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

        const result = anthropicAdapter.formatTools(toolkit);

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

        const result = anthropicAdapter.formatTools(toolkit, schema);

        expect(result).toHaveLength(2);
        expect(result[1].name).toBe("structured_output");
      });
    });

    describe("formatToolResult", () => {
      it("formats tool result correctly", () => {
        const toolCall = {
          callId: "tool-123",
          name: "test_tool",
          arguments: "{}",
          raw: {},
        };
        const result = {
          callId: "tool-123",
          output: '{"result": "success"}',
          success: true,
        };

        const formatted = anthropicAdapter.formatToolResult(toolCall, result);

        expect(formatted.tool_use_id).toBe("tool-123");
        expect(formatted.content).toBe('{"result": "success"}');
        expect(formatted.type).toBe("tool_result");
      });
    });

    describe("isComplete", () => {
      it("returns true when stop reason is not tool_use", () => {
        const response = {
          content: [{ type: "text", text: "Done" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 20 },
        };

        expect(anthropicAdapter.isComplete(response)).toBe(true);
      });

      it("returns false when stop reason is tool_use", () => {
        const response = {
          content: [{ type: "tool_use", id: "123", name: "test", input: {} }],
          stop_reason: "tool_use",
          usage: { input_tokens: 10, output_tokens: 20 },
        };

        expect(anthropicAdapter.isComplete(response)).toBe(false);
      });
    });

    describe("hasStructuredOutput", () => {
      it("returns true when structured_output tool is used", () => {
        const response = {
          content: [
            {
              type: "tool_use",
              id: "123",
              name: "structured_output",
              input: { key: "value" },
            },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 10, output_tokens: 20 },
        };

        expect(anthropicAdapter.hasStructuredOutput(response)).toBe(true);
      });

      it("returns false for regular tool use", () => {
        const response = {
          content: [
            {
              type: "tool_use",
              id: "123",
              name: "other_tool",
              input: {},
            },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 10, output_tokens: 20 },
        };

        expect(anthropicAdapter.hasStructuredOutput(response)).toBe(false);
      });
    });

    describe("extractStructuredOutput", () => {
      it("extracts structured output from response", () => {
        const response = {
          content: [
            {
              type: "tool_use",
              id: "123",
              name: "structured_output",
              input: { name: "John", age: 30 },
            },
          ],
          stop_reason: "tool_use",
          usage: { input_tokens: 10, output_tokens: 20 },
        };

        const result = anthropicAdapter.extractStructuredOutput(response);

        expect(result).toEqual({ name: "John", age: 30 });
      });

      it("returns undefined for non-structured responses", () => {
        const response = {
          content: [{ type: "text", text: "Hello" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 20 },
        };

        const result = anthropicAdapter.extractStructuredOutput(response);

        expect(result).toBeUndefined();
      });
    });

    describe("classifyError", () => {
      it("classifies rate limit error", async () => {
        const { RateLimitError } = await import("@anthropic-ai/sdk");
        // @ts-expect-error Mock doesn't require constructor args
        const error = new RateLimitError();

        const result = anthropicAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.RateLimit);
        expect(result.shouldRetry).toBe(false);
      });

      it("classifies retryable error", async () => {
        const { InternalServerError } = await import("@anthropic-ai/sdk");
        // @ts-expect-error Mock doesn't require constructor args
        const error = new InternalServerError();

        const result = anthropicAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Retryable);
        expect(result.shouldRetry).toBe(true);
      });

      it("classifies unrecoverable error", async () => {
        const { AuthenticationError } = await import("@anthropic-ai/sdk");
        // @ts-expect-error Mock doesn't require constructor args
        const error = new AuthenticationError();

        const result = anthropicAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Unrecoverable);
        expect(result.shouldRetry).toBe(false);
      });

      it("classifies unknown error as retryable", () => {
        const error = new Error("Unknown error");

        const result = anthropicAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Unknown);
        expect(result.shouldRetry).toBe(true);
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

      const result = anthropicAdapter.buildRequest(request);

      expect(result.model).toBe(PROVIDER.ANTHROPIC.MODEL.DEFAULT);
    });

    it("sets tool_choice to any when structured output tool present", () => {
      const request: OperateRequest = {
        model: PROVIDER.ANTHROPIC.MODEL.LARGE,
        messages: [],
        tools: [
          {
            name: "structured_output",
            description: "Structured output",
            parameters: { type: "object" },
          },
        ],
      };

      const result = anthropicAdapter.buildRequest(request);

      expect(result.tool_choice).toEqual({ type: "any" });
    });
  });
});
