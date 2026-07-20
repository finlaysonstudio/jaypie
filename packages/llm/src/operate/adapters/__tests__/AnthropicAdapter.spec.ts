import { beforeEach, describe, expect, it, vi } from "vitest";

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
      expect(anthropicAdapter.defaultModel).toBe(PROVIDER.ANTHROPIC.DEFAULT);
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
          cache: false,
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
          cache: false,
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

      describe("max_tokens resolution (issue #402)", () => {
        it("defaults non-streaming requests to the non-streaming maximum", () => {
          const request: OperateRequest = {
            model: "claude-opus-4-8",
            messages: [],
          };

          const result = anthropicAdapter.buildRequest(request);

          expect(result.max_tokens).toBe(16384);
        });

        it("defaults streaming requests to the model maximum output", () => {
          const request: OperateRequest = {
            model: "claude-opus-4-8",
            messages: [],
            stream: true,
          };

          const result = anthropicAdapter.buildRequest(request);

          expect(result.max_tokens).toBe(128000);
        });

        it("resolves streaming Claude Haiku to its lower maximum", () => {
          const request: OperateRequest = {
            model: "claude-haiku-4-5",
            messages: [],
            stream: true,
          };

          const result = anthropicAdapter.buildRequest(request);

          expect(result.max_tokens).toBe(64000);
        });

        it("falls back to the default for unknown models", () => {
          const request: OperateRequest = {
            model: "unknown-model",
            messages: [],
            stream: true,
          };

          const result = anthropicAdapter.buildRequest(request);

          expect(result.max_tokens).toBe(PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT);
        });

        it("respects providerOptions max_tokens override", () => {
          const request: OperateRequest = {
            model: "claude-opus-4-8",
            messages: [],
            providerOptions: { max_tokens: 4096 },
            stream: true,
          };

          const result = anthropicAdapter.buildRequest(request);

          expect(result.max_tokens).toBe(4096);
        });
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

      it("does not inject a structured_output tool when schema provided", () => {
        // Native output_config.format replaces the legacy fake-tool injection.
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

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("test");
      });
    });

    describe("formatOutputSchema", () => {
      // Inputs use type:"json_schema" so the adapter skips its Zod path
      // and runs the input through the sanitizer directly.
      it("forces additionalProperties:false on objects", () => {
        const result = anthropicAdapter.formatOutputSchema({
          type: "json_schema",
          properties: { name: { type: "string" } },
        });

        expect(result.additionalProperties).toBe(false);
      });

      it("strips $schema", () => {
        const result = anthropicAdapter.formatOutputSchema({
          $schema: "http://json-schema.org/draft-07/schema#",
          type: "json_schema",
          properties: {},
        });

        expect(result.$schema).toBeUndefined();
      });

      it("moves unsupported numeric constraints into description", () => {
        const result = anthropicAdapter.formatOutputSchema({
          type: "json_schema",
          properties: {
            age: { type: "number", minimum: 0, maximum: 120 },
          },
        });

        const age = (result.properties as { age: { description?: string } })
          .age;
        expect(age.description).toContain("minimum: 0");
        expect(age.description).toContain("maximum: 120");
        expect((age as Record<string, unknown>).minimum).toBeUndefined();
        expect((age as Record<string, unknown>).maximum).toBeUndefined();
      });

      it("moves minLength and maxLength into description", () => {
        const result = anthropicAdapter.formatOutputSchema({
          type: "json_schema",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 50 },
          },
        });

        const name = (result.properties as { name: { description?: string } })
          .name;
        expect(name.description).toContain("minLength: 1");
        expect(name.description).toContain("maxLength: 50");
        expect((name as Record<string, unknown>).minLength).toBeUndefined();
        expect((name as Record<string, unknown>).maxLength).toBeUndefined();
      });

      it("strips unsupported string formats but keeps supported ones", () => {
        const result = anthropicAdapter.formatOutputSchema({
          type: "json_schema",
          properties: {
            email: { type: "string", format: "email" },
            ssn: { type: "string", format: "ssn" },
          },
        });

        const props = result.properties as {
          email: { format?: string };
          ssn: { format?: string; description?: string };
        };
        expect(props.email.format).toBe("email");
        expect(props.ssn.format).toBeUndefined();
        expect(props.ssn.description).toContain("ssn");
      });

      it("passes minItems through only when 0 or 1", () => {
        const result = anthropicAdapter.formatOutputSchema({
          type: "json_schema",
          properties: {
            tags: { type: "array", items: { type: "string" }, minItems: 1 },
            badItems: {
              type: "array",
              items: { type: "string" },
              minItems: 5,
            },
          },
        });

        const props = result.properties as {
          tags: { minItems?: number };
          badItems: { minItems?: number; description?: string };
        };
        expect(props.tags.minItems).toBe(1);
        expect(props.badItems.minItems).toBeUndefined();
        expect(props.badItems.description).toContain("minItems: 5");
      });

      it("converts oneOf to anyOf at nested levels", () => {
        const result = anthropicAdapter.formatOutputSchema({
          type: "json_schema",
          properties: {
            value: {
              oneOf: [{ type: "string" }, { type: "number" }],
            },
          },
        });

        const value = result.properties as {
          value: { anyOf?: unknown; oneOf?: unknown };
        };
        expect(value.value.anyOf).toBeDefined();
        expect(value.value.oneOf).toBeUndefined();
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
      it("returns true when native output_config response is annotated", () => {
        const response = {
          __jaypieStructuredOutput: true,
          content: [{ type: "text", text: '{"name":"John"}' }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 20 },
        };

        expect(anthropicAdapter.hasStructuredOutput(response)).toBe(true);
      });

      it("returns false on annotated response with refusal", () => {
        const response = {
          __jaypieStructuredOutput: true,
          content: [{ type: "text", text: "I cannot help with that." }],
          stop_reason: "refusal",
          usage: { input_tokens: 10, output_tokens: 20 },
        };

        expect(anthropicAdapter.hasStructuredOutput(response)).toBe(false);
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

      describe("Fallback Path", () => {
        it("returns true when legacy structured_output tool is used", () => {
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
      });
    });

    describe("extractStructuredOutput", () => {
      it("parses JSON from native output_config text block", () => {
        const response = {
          __jaypieStructuredOutput: true,
          content: [{ type: "text", text: '{"name":"John","age":30}' }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 20 },
        };

        expect(anthropicAdapter.extractStructuredOutput(response)).toEqual({
          name: "John",
          age: 30,
        });
      });

      it("returns undefined when stop_reason is refusal", () => {
        const response = {
          __jaypieStructuredOutput: true,
          content: [{ type: "text", text: "I cannot help with that." }],
          stop_reason: "refusal",
          usage: { input_tokens: 10, output_tokens: 20 },
        };

        expect(
          anthropicAdapter.extractStructuredOutput(response),
        ).toBeUndefined();
      });

      it("returns undefined when stop_reason is max_tokens", () => {
        const response = {
          __jaypieStructuredOutput: true,
          content: [{ type: "text", text: '{"partial":' }],
          stop_reason: "max_tokens",
          usage: { input_tokens: 10, output_tokens: 20 },
        };

        expect(
          anthropicAdapter.extractStructuredOutput(response),
        ).toBeUndefined();
      });

      it("returns undefined on annotated response with invalid JSON", () => {
        const response = {
          __jaypieStructuredOutput: true,
          content: [{ type: "text", text: "not json" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 20 },
        };

        expect(
          anthropicAdapter.extractStructuredOutput(response),
        ).toBeUndefined();
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

      describe("Fallback Path", () => {
        it("extracts structured output from legacy tool_use block", () => {
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

          expect(anthropicAdapter.extractStructuredOutput(response)).toEqual({
            name: "John",
            age: 30,
          });
        });
      });
    });

    describe("classifyError", () => {
      it("classifies grammar-compilation timeout as retryable (#422)", () => {
        const result = anthropicAdapter.classifyError(
          new Error("Grammar compilation timed out."),
        );
        expect(result.category).toBe(ErrorCategory.Retryable);
        expect(result.shouldRetry).toBe(true);
      });

      it("classifies a credit-balance failure as terminal quota (billing)", () => {
        const result = anthropicAdapter.classifyError(
          new Error("Your credit balance is too low to access the API"),
        );
        expect(result.category).toBe(ErrorCategory.Quota);
        expect(result.reason).toBe("billing");
        expect(result.shouldRetry).toBe(false);
      });

      it("classifies rate limit error", async () => {
        const { RateLimitError } =
          await import("../../../providers/anthropic/client.js");
        // @ts-expect-error Mock doesn't require constructor args
        const error = new RateLimitError();

        const result = anthropicAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.RateLimit);
        expect(result.shouldRetry).toBe(false);
      });

      it("classifies retryable error", async () => {
        const { InternalServerError } =
          await import("../../../providers/anthropic/client.js");
        // @ts-expect-error Mock doesn't require constructor args
        const error = new InternalServerError();

        const result = anthropicAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Retryable);
        expect(result.shouldRetry).toBe(true);
      });

      it("classifies unrecoverable error", async () => {
        const { AuthenticationError } =
          await import("../../../providers/anthropic/client.js");
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

      it("classifies ECONNRESET as retryable", () => {
        const error = new Error("read ECONNRESET");
        (error as unknown as { code: string }).code = "ECONNRESET";

        const result = anthropicAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Retryable);
        expect(result.shouldRetry).toBe(true);
      });

      it("classifies TypeError: terminated with ECONNRESET cause as retryable", () => {
        const cause = new Error("read ECONNRESET");
        (cause as unknown as { code: string }).code = "ECONNRESET";
        const error = new TypeError("terminated");
        (error as unknown as { cause: Error }).cause = cause;

        const result = anthropicAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Retryable);
        expect(result.shouldRetry).toBe(true);
      });
    });
  });

  // AbortSignal Support
  describe("AbortSignal Support", () => {
    describe("executeRequest", () => {
      it("passes signal to SDK call when provided", async () => {
        const mockCreate = vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "Hi" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 1, output_tokens: 1 },
        });
        const mockClient = { messages: { create: mockCreate } };
        const request = {
          model: "claude-sonnet-4-20250514",
          messages: [{ role: "user", content: "Hello" }],
          max_tokens: 1024,
          stream: false,
        };
        const controller = new AbortController();

        await anthropicAdapter.executeRequest(
          mockClient,
          request,
          controller.signal,
        );

        expect(mockCreate).toHaveBeenCalledTimes(1);
        const [, options] = mockCreate.mock.calls[0];
        expect(options).toEqual({ signal: controller.signal });
      });

      it("does not pass options when no signal provided", async () => {
        const mockCreate = vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "Hi" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 1, output_tokens: 1 },
        });
        const mockClient = { messages: { create: mockCreate } };
        const request = {
          model: "claude-sonnet-4-20250514",
          messages: [{ role: "user", content: "Hello" }],
          max_tokens: 1024,
          stream: false,
        };

        await anthropicAdapter.executeRequest(mockClient, request);

        expect(mockCreate).toHaveBeenCalledTimes(1);
        const [, options] = mockCreate.mock.calls[0];
        expect(options).toBeUndefined();
      });

      it("suppresses errors after signal is aborted", async () => {
        const controller = new AbortController();
        controller.abort("retry");

        const mockCreate = vi
          .fn()
          .mockRejectedValue(new TypeError("terminated"));
        const mockClient = { messages: { create: mockCreate } };
        const request = {
          model: "claude-sonnet-4-20250514",
          messages: [],
          max_tokens: 1024,
          stream: false,
        };

        const result = await anthropicAdapter.executeRequest(
          mockClient,
          request,
          controller.signal,
        );

        expect(result).toBeUndefined();
      });

      it("throws errors when signal is not aborted", async () => {
        const controller = new AbortController();

        const mockCreate = vi.fn().mockRejectedValue(new Error("real error"));
        const mockClient = { messages: { create: mockCreate } };
        const request = {
          model: "claude-sonnet-4-20250514",
          messages: [],
          max_tokens: 1024,
          stream: false,
        };

        await expect(
          anthropicAdapter.executeRequest(
            mockClient,
            request,
            controller.signal,
          ),
        ).rejects.toThrow("real error");
      });
    });
  });

  // Temperature-deprecation retry
  describe("Temperature deprecation retry", () => {
    beforeEach(() => {
      anthropicAdapter.clearRuntimeNoTemperatureModels();
    });

    it("retries without temperature when Anthropic rejects it with 400", async () => {
      const { BadRequestError } =
        await import("../../../providers/anthropic/client.js");
      // @ts-expect-error Mock doesn't require constructor args
      const error = new BadRequestError();
      (error as unknown as { status: number }).status = 400;
      error.message =
        '400 {"type":"error","error":{"type":"invalid_request_error","message":"`temperature` is deprecated for this model."}}';

      const successResponse = {
        content: [{ type: "text", text: "Hi" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      };
      const mockCreate = vi.fn();
      mockCreate.mockRejectedValueOnce(error as unknown as Error);
      mockCreate.mockResolvedValueOnce(successResponse);
      const mockClient = { messages: { create: mockCreate } };
      const request = {
        model: "claude-opus-4-7",
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 1024,
        stream: false,
        temperature: 0,
      };

      const result = await anthropicAdapter.executeRequest(mockClient, request);

      expect(result as unknown).toBe(successResponse);
      expect(mockCreate).toHaveBeenCalledTimes(2);
      const retryRequest = mockCreate.mock.calls[1][0] as {
        temperature?: number;
      };
      expect(retryRequest.temperature).toBeUndefined();
    });

    it("caches the model so subsequent buildRequest strips temperature", async () => {
      const { BadRequestError } =
        await import("../../../providers/anthropic/client.js");
      // @ts-expect-error Mock doesn't require constructor args
      const error = new BadRequestError();
      (error as unknown as { status: number }).status = 400;
      error.message = "`temperature` is deprecated for this model.";

      const mockCreate = vi.fn();
      mockCreate.mockRejectedValueOnce(error as unknown as Error);
      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "Hi" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      });
      const mockClient = { messages: { create: mockCreate } };
      await anthropicAdapter.executeRequest(mockClient, {
        model: "claude-sonnet-9-mystery",
        messages: [],
        max_tokens: 1024,
        stream: false,
        temperature: 0.5,
      });

      const result = anthropicAdapter.buildRequest({
        model: "claude-sonnet-9-mystery",
        messages: [],
        temperature: 0.5,
      });

      expect(result.temperature).toBeUndefined();
    });

    it("does not retry on 400 unrelated to temperature", async () => {
      const { BadRequestError } =
        await import("../../../providers/anthropic/client.js");
      // @ts-expect-error Mock doesn't require constructor args
      const error = new BadRequestError();
      (error as unknown as { status: number }).status = 400;
      error.message = "some other bad-request reason";

      const mockCreate = vi.fn();
      mockCreate.mockRejectedValue(error as unknown as Error);
      const mockClient = { messages: { create: mockCreate } };

      let thrown: unknown;
      try {
        await anthropicAdapter.executeRequest(mockClient, {
          model: "claude-opus-4-6",
          messages: [],
          max_tokens: 1024,
          stream: false,
          temperature: 0.2,
        });
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBe(error);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("does not retry when request has no temperature", async () => {
      const { BadRequestError } =
        await import("../../../providers/anthropic/client.js");
      // @ts-expect-error Mock doesn't require constructor args
      const error = new BadRequestError();
      (error as unknown as { status: number }).status = 400;
      error.message = "`temperature` is deprecated for this model.";

      const mockCreate = vi.fn();
      mockCreate.mockRejectedValue(error as unknown as Error);
      const mockClient = { messages: { create: mockCreate } };

      let thrown: unknown;
      try {
        await anthropicAdapter.executeRequest(mockClient, {
          model: "claude-opus-4-7",
          messages: [],
          max_tokens: 1024,
          stream: false,
        });
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBe(error);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe("Structured-output fallback", () => {
    beforeEach(() => {
      anthropicAdapter.clearRuntimeNoStructuredOutputModels();
    });

    it("retries with fake-tool emulation when output_config is rejected", async () => {
      const { BadRequestError } =
        await import("../../../providers/anthropic/client.js");
      // @ts-expect-error Mock doesn't require constructor args
      const error = new BadRequestError();
      (error as unknown as { status: number }).status = 400;
      error.message =
        '400 {"type":"error","error":{"type":"invalid_request_error","message":"`output_config` is not supported by this model."}}';

      const successResponse = {
        content: [
          {
            type: "tool_use",
            id: "abc",
            name: "structured_output",
            input: { ok: true },
          },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 1, output_tokens: 1 },
      };
      const mockCreate = vi.fn();
      mockCreate.mockRejectedValueOnce(error as unknown as Error);
      mockCreate.mockResolvedValueOnce(successResponse);
      const mockClient = {
        messages: { create: mockCreate },
      };

      const request = {
        model: "claude-old-3",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1024,
        stream: false,
        output_config: {
          format: {
            type: "json_schema",
            schema: { type: "object", properties: {} },
          },
        },
      };

      const result = await anthropicAdapter.executeRequest(mockClient, request);

      expect(result as unknown).toBe(successResponse);
      expect(mockCreate).toHaveBeenCalledTimes(2);

      const fallbackBody = mockCreate.mock.calls[1][0] as {
        output_config?: unknown;
        tools?: { name: string }[];
        tool_choice?: { type: string };
      };
      expect(fallbackBody.output_config).toBeUndefined();
      expect(
        fallbackBody.tools?.some((t) => t.name === "structured_output"),
      ).toBe(true);
      expect(fallbackBody.tool_choice).toEqual({ type: "any" });
    });

    it("caches the model so subsequent buildRequest uses fake-tool path", async () => {
      const { BadRequestError } =
        await import("../../../providers/anthropic/client.js");
      // @ts-expect-error Mock doesn't require constructor args
      const error = new BadRequestError();
      (error as unknown as { status: number }).status = 400;
      error.message = "output_config is not supported";

      const mockCreate = vi.fn();
      mockCreate.mockRejectedValueOnce(error as unknown as Error);
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            id: "x",
            name: "structured_output",
            input: {},
          },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 1, output_tokens: 1 },
      });
      const mockClient = {
        messages: { create: mockCreate },
      };

      await anthropicAdapter.executeRequest(mockClient, {
        model: "claude-legacy",
        messages: [],
        max_tokens: 1024,
        stream: false,
        output_config: {
          format: {
            type: "json_schema",
            schema: { type: "object", properties: {} },
          },
        },
      });

      const built = anthropicAdapter.buildRequest({
        model: "claude-legacy",
        messages: [],
        format: { type: "object", properties: {} },
      });

      const builtTyped = built as unknown as {
        output_config?: unknown;
        tools?: { name: string }[];
        tool_choice?: { type: string };
      };
      expect(builtTyped.output_config).toBeUndefined();
      expect(
        builtTyped.tools?.some((t) => t.name === "structured_output"),
      ).toBe(true);
      expect(builtTyped.tool_choice).toEqual({ type: "any" });
    });

    it("does not fall back when 400 mentions citations", async () => {
      const { BadRequestError } =
        await import("../../../providers/anthropic/client.js");
      // @ts-expect-error Mock doesn't require constructor args
      const error = new BadRequestError();
      (error as unknown as { status: number }).status = 400;
      error.message =
        "output_config is incompatible with citations enabled on this request";

      const mockCreate = vi.fn();
      mockCreate.mockRejectedValue(error as unknown as Error);
      const mockClient = {
        messages: { create: mockCreate },
      };

      let thrown: unknown;
      try {
        await anthropicAdapter.executeRequest(mockClient, {
          model: "claude-opus-4-7",
          messages: [],
          max_tokens: 1024,
          stream: false,
          output_config: {
            format: {
              type: "json_schema",
              schema: { type: "object", properties: {} },
            },
          },
        });
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBe(error);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("does not fall back when 400 says output_format is deprecated", async () => {
      // The API renamed `output_format` to `output_config.format`. If
      // adapter code somehow sends the old field, the API returns a 400
      // mentioning "deprecated" — that's a code-path bug and should
      // propagate, NOT silently engage the fake-tool fallback.
      const { BadRequestError } =
        await import("../../../providers/anthropic/client.js");
      // @ts-expect-error Mock doesn't require constructor args
      const error = new BadRequestError();
      (error as unknown as { status: number }).status = 400;
      error.message =
        "output_format: This field is deprecated. Use 'output_config.format' instead.";

      const mockCreate = vi.fn();
      mockCreate.mockRejectedValue(error as unknown as Error);
      const mockClient = {
        messages: { create: mockCreate },
      };

      let thrown: unknown;
      try {
        await anthropicAdapter.executeRequest(mockClient, {
          model: "claude-opus-4-7",
          messages: [],
          max_tokens: 1024,
          stream: false,
          output_config: {
            format: {
              type: "json_schema",
              schema: { type: "object", properties: {} },
            },
          },
        });
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBe(error);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("does not fall back when 400 is unrelated to structured output", async () => {
      const { BadRequestError } =
        await import("../../../providers/anthropic/client.js");
      // @ts-expect-error Mock doesn't require constructor args
      const error = new BadRequestError();
      (error as unknown as { status: number }).status = 400;
      error.message = "some other bad-request reason";

      const mockCreate = vi.fn();
      mockCreate.mockRejectedValue(error as unknown as Error);
      const mockClient = {
        messages: { create: mockCreate },
      };

      let thrown: unknown;
      try {
        await anthropicAdapter.executeRequest(mockClient, {
          model: "claude-opus-4-7",
          messages: [],
          max_tokens: 1024,
          stream: false,
          output_config: {
            format: {
              type: "json_schema",
              schema: { type: "object", properties: {} },
            },
          },
        });
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBe(error);
      expect(mockCreate).toHaveBeenCalledTimes(1);
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

      expect(result.model).toBe(PROVIDER.ANTHROPIC.DEFAULT);
    });

    it("sets temperature on request when provided", () => {
      const request: OperateRequest = {
        model: PROVIDER.ANTHROPIC.DEFAULT,
        messages: [
          {
            content: "Hello",
            role: LlmMessageRole.User,
            type: LlmMessageType.Message,
          },
        ],
        temperature: 0.7,
      };

      const result = anthropicAdapter.buildRequest(request);

      expect(result.temperature).toBe(0.7);
    });

    it("temperature takes precedence over providerOptions", () => {
      const request: OperateRequest = {
        model: PROVIDER.ANTHROPIC.DEFAULT,
        messages: [],
        providerOptions: { temperature: 0.3 },
        temperature: 0.9,
      };

      const result = anthropicAdapter.buildRequest(request);

      expect(result.temperature).toBe(0.9);
    });

    it("does not set temperature when not provided", () => {
      const request: OperateRequest = {
        model: PROVIDER.ANTHROPIC.MODEL.LARGE,
        messages: [],
      };

      const result = anthropicAdapter.buildRequest(request);

      expect(result.temperature).toBeUndefined();
    });

    describe("models that do not support temperature", () => {
      beforeEach(() => {
        anthropicAdapter.clearRuntimeNoTemperatureModels();
      });

      it("strips temperature for claude-opus-4-7", () => {
        const request: OperateRequest = {
          model: "claude-opus-4-7",
          messages: [],
          temperature: 0,
        };

        const result = anthropicAdapter.buildRequest(request);

        expect(result.temperature).toBeUndefined();
      });

      it("strips temperature for dated claude-opus-4-7 variant", () => {
        const request: OperateRequest = {
          model: "claude-opus-4-7-20250801",
          messages: [],
          temperature: 0.5,
        };

        const result = anthropicAdapter.buildRequest(request);

        expect(result.temperature).toBeUndefined();
      });

      it("strips temperature for future claude-opus-5 models", () => {
        const request: OperateRequest = {
          model: "claude-opus-5-0",
          messages: [],
          temperature: 0.3,
        };

        const result = anthropicAdapter.buildRequest(request);

        expect(result.temperature).toBeUndefined();
      });

      it("strips temperature from providerOptions for unsupported models", () => {
        const request: OperateRequest = {
          model: "claude-opus-4-8",
          messages: [],
          providerOptions: { temperature: 0.4 },
        };

        const result = anthropicAdapter.buildRequest(request);

        expect(result.temperature).toBeUndefined();
      });

      it("keeps temperature for claude-opus-4-6 (still supported)", () => {
        const request: OperateRequest = {
          model: "claude-opus-4-6",
          messages: [],
          temperature: 0.2,
        };

        const result = anthropicAdapter.buildRequest(request);

        expect(result.temperature).toBe(0.2);
      });

      it("keeps temperature for claude-sonnet-4-5 (still supported)", () => {
        const request: OperateRequest = {
          model: "claude-sonnet-4-5",
          messages: [],
          temperature: 0.2,
        };

        const result = anthropicAdapter.buildRequest(request);

        expect(result.temperature).toBe(0.2);
      });

      it("strips temperature for models cached at runtime", () => {
        const adapter = new AnthropicAdapter();
        adapter.rememberModelRejectsTemperature("claude-sonnet-9-future");

        const result = adapter.buildRequest({
          model: "claude-sonnet-9-future",
          messages: [],
          temperature: 0.7,
        });

        expect(result.temperature).toBeUndefined();
      });
    });

    it("uses tool_choice:auto for real tools", () => {
      const request: OperateRequest = {
        model: PROVIDER.ANTHROPIC.MODEL.LARGE,
        messages: [],
        tools: [
          {
            name: "search",
            description: "Search",
            parameters: { type: "object" },
          },
        ],
      };

      const result = anthropicAdapter.buildRequest(request);

      expect(result.tool_choice).toEqual({ type: "auto" });
    });

    it("emits output_config.format when format is provided", () => {
      const request: OperateRequest = {
        model: PROVIDER.ANTHROPIC.MODEL.LARGE,
        messages: [],
        format: {
          type: "object",
          properties: { name: { type: "string" } },
          additionalProperties: false,
        },
      };

      const result = anthropicAdapter.buildRequest(request);

      const params = result as unknown as {
        output_config?: {
          format: { type: string; schema: { type: string } };
        };
        tool_choice?: { type: string };
      };
      expect(params.output_config).toEqual({
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: { name: { type: "string" } },
            additionalProperties: false,
          },
        },
      });
      // No tool_choice forced when only structured output is requested
      expect(params.tool_choice).toBeUndefined();
    });

    it("does not emit output_config when format is absent", () => {
      const request: OperateRequest = {
        model: PROVIDER.ANTHROPIC.MODEL.LARGE,
        messages: [],
      };

      const result = anthropicAdapter.buildRequest(request);

      const params = result as unknown as { output_config?: unknown };
      expect(params.output_config).toBeUndefined();
    });
  });
});
