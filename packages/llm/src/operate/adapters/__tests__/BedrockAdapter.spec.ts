import { beforeEach, describe, expect, it, vi } from "vitest";

import { BedrockAdapter, bedrockAdapter } from "../BedrockAdapter.js";
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

vi.mock("@aws-sdk/client-bedrock-runtime", () => ({
  BedrockRuntimeClient: vi.fn(),
  ConverseCommand: vi.fn((input) => input),
  ConverseStreamCommand: vi.fn((input) => input),
}));

//
//
// Fixtures
//

const mockConverseResponse = {
  output: {
    message: {
      role: "assistant",
      content: [{ text: "Hello, world!" }],
    },
  },
  stopReason: "end_turn",
  usage: {
    inputTokens: 10,
    outputTokens: 5,
    totalTokens: 15,
  },
};

const mockToolUseResponse = {
  output: {
    message: {
      role: "assistant",
      content: [
        {
          toolUse: {
            toolUseId: "tool-123",
            name: "get_weather",
            input: { city: "NYC" },
          },
        },
      ],
    },
  },
  stopReason: "tool_use",
  usage: {
    inputTokens: 20,
    outputTokens: 8,
    totalTokens: 28,
  },
};

const baseRequest: OperateRequest = {
  messages: [{ role: LlmMessageRole.User, content: "Hello" }],
  model: PROVIDER.BEDROCK.MODEL.DEFAULT,
};

//
//
// Tests
//

describe("BedrockAdapter", () => {
  let adapter: BedrockAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new BedrockAdapter();
  });

  describe("Base Cases", () => {
    it("Adapter instance exists", () => {
      expect(adapter).toBeDefined();
      expect(bedrockAdapter).toBeDefined();
    });

    it("Has correct name", () => {
      expect(adapter.name).toBe(PROVIDER.BEDROCK.NAME);
    });

    it("Has correct default model", () => {
      expect(adapter.defaultModel).toBe(PROVIDER.BEDROCK.MODEL.DEFAULT);
    });
  });

  describe("buildRequest", () => {
    it("Builds a basic request with modelId and messages", () => {
      const result = adapter.buildRequest(baseRequest) as {
        modelId: string;
        messages: Array<{ role: string; content: Array<{ text: string }> }>;
      };

      expect(result.modelId).toBe(PROVIDER.BEDROCK.MODEL.DEFAULT);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content[0].text).toBe("Hello");
    });

    it("Includes system prompt when provided", () => {
      const result = adapter.buildRequest({
        ...baseRequest,
        system: "You are helpful.",
      }) as { system: Array<{ text: string }> };

      expect(result.system).toEqual([{ text: "You are helpful." }]);
    });

    it("Sets temperature in inferenceConfig when provided", () => {
      const result = adapter.buildRequest({
        ...baseRequest,
        temperature: 0.5,
      }) as { inferenceConfig: { temperature: number } };

      expect(result.inferenceConfig.temperature).toBe(0.5);
    });

    it("Skips system role messages", () => {
      const result = adapter.buildRequest({
        ...baseRequest,
        messages: [
          { role: "system" as LlmMessageRole, content: "System prompt" },
          { role: LlmMessageRole.User, content: "Hello" },
        ],
      }) as { messages: Array<{ role: string }> };

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
    });

    it("Converts FunctionCall messages to assistant toolUse", () => {
      const result = adapter.buildRequest({
        ...baseRequest,
        messages: [
          {
            type: LlmMessageType.FunctionCall,
            call_id: "call-1",
            name: "get_weather",
            arguments: '{"city":"NYC"}',
            id: "call-1",
            status: "pending",
          } as unknown as (typeof baseRequest.messages)[number],
        ],
      }) as {
        messages: Array<{
          role: string;
          content: Array<{
            toolUse: { toolUseId: string; name: string; input: object };
          }>;
        }>;
      };

      expect(result.messages[0].role).toBe("assistant");
      expect(result.messages[0].content[0].toolUse.toolUseId).toBe("call-1");
      expect(result.messages[0].content[0].toolUse.name).toBe("get_weather");
      expect(result.messages[0].content[0].toolUse.input).toEqual({
        city: "NYC",
      });
    });

    it("Converts FunctionCallOutput messages to user toolResult", () => {
      const result = adapter.buildRequest({
        ...baseRequest,
        messages: [
          {
            type: LlmMessageType.FunctionCallOutput,
            call_id: "call-1",
            output: "Sunny and 72°F",
          } as unknown as (typeof baseRequest.messages)[number],
        ],
      }) as {
        messages: Array<{
          role: string;
          content: Array<{
            toolResult: { toolUseId: string; content: Array<{ text: string }> };
          }>;
        }>;
      };

      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content[0].toolResult.toolUseId).toBe("call-1");
      expect(result.messages[0].content[0].toolResult.content[0].text).toBe(
        "Sunny and 72°F",
      );
    });

    it("Includes toolConfig when tools are provided", () => {
      const result = adapter.buildRequest({
        ...baseRequest,
        tools: [
          {
            name: "get_weather",
            description: "Get weather",
            parameters: {
              type: "object",
              properties: { city: { type: "string" } },
            },
          },
        ],
      }) as {
        toolConfig: {
          tools: Array<{
            toolSpec: {
              name: string;
              description: string;
              inputSchema: { json: object };
            };
          }>;
        };
      };

      expect(result.toolConfig.tools).toHaveLength(1);
      expect(result.toolConfig.tools[0].toolSpec.name).toBe("get_weather");
      expect(result.toolConfig.tools[0].toolSpec.description).toBe(
        "Get weather",
      );
    });
  });

  describe("formatTools", () => {
    it("Converts Toolkit tools to ProviderToolDefinition format", () => {
      const toolkit = new Toolkit([
        {
          name: "my_tool",
          description: "Does something",
          type: "function",
          parameters: {
            type: "object",
            properties: { param: { type: "string" } },
          },
          call: async () => "result",
        },
      ]);

      const result = adapter.formatTools(toolkit);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("my_tool");
      expect(result[0].description).toBe("Does something");
    });
  });

  describe("parseResponse", () => {
    it("Extracts text content from response", () => {
      const result = adapter.parseResponse(mockConverseResponse);

      expect(result.content).toBe("Hello, world!");
      expect(result.hasToolCalls).toBe(false);
      expect(result.stopReason).toBe("end_turn");
    });

    it("Detects tool calls from stop reason", () => {
      const result = adapter.parseResponse(mockToolUseResponse);

      expect(result.hasToolCalls).toBe(true);
      expect(result.stopReason).toBe("tool_use");
    });
  });

  describe("extractToolCalls", () => {
    it("Extracts tool calls from response content", () => {
      const toolCalls = adapter.extractToolCalls(mockToolUseResponse);

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].callId).toBe("tool-123");
      expect(toolCalls[0].name).toBe("get_weather");
      expect(toolCalls[0].arguments).toBe('{"city":"NYC"}');
    });

    it("Returns empty array when no tool calls", () => {
      const toolCalls = adapter.extractToolCalls(mockConverseResponse);
      expect(toolCalls).toHaveLength(0);
    });
  });

  describe("extractUsage", () => {
    it("Extracts token counts from response", () => {
      const usage = adapter.extractUsage(
        mockConverseResponse,
        PROVIDER.BEDROCK.MODEL.DEFAULT,
      );

      expect(usage.input).toBe(10);
      expect(usage.output).toBe(5);
      expect(usage.total).toBe(15);
      expect(usage.provider).toBe(PROVIDER.BEDROCK.NAME);
    });

    it("Handles missing usage gracefully", () => {
      const usage = adapter.extractUsage(
        { output: { message: { content: [] } }, stopReason: "end_turn" },
        PROVIDER.BEDROCK.MODEL.DEFAULT,
      );

      expect(usage.input).toBe(0);
      expect(usage.output).toBe(0);
      expect(usage.total).toBe(0);
    });
  });

  describe("formatToolResult", () => {
    it("Formats tool result as Bedrock toolResult block", () => {
      const toolCall = {
        callId: "call-1",
        name: "get_weather",
        arguments: "{}",
        raw: {},
      };
      const result = {
        callId: "call-1",
        name: "get_weather",
        output: "Sunny",
        success: true,
      };

      const formatted = adapter.formatToolResult(toolCall, result) as {
        toolResult: { toolUseId: string; content: Array<{ text: string }> };
      };

      expect(formatted.toolResult.toolUseId).toBe("call-1");
      expect(formatted.toolResult.content[0].text).toBe("Sunny");
    });
  });

  describe("appendToolResult", () => {
    it("Appends assistant toolUse and user toolResult messages", () => {
      const request = {
        modelId: PROVIDER.BEDROCK.MODEL.DEFAULT,
        messages: [{ role: "user", content: [{ text: "Hello" }] }],
      };
      const toolCall = {
        callId: "call-1",
        name: "get_weather",
        arguments: "{}",
        raw: { toolUse: { toolUseId: "call-1", name: "get_weather" } },
      };
      const result = {
        callId: "call-1",
        name: "get_weather",
        output: "Sunny",
        success: true,
      };

      const updated = adapter.appendToolResult(request, toolCall, result) as {
        messages: Array<{ role: string }>;
      };

      expect(updated.messages).toHaveLength(3);
      expect(updated.messages[1].role).toBe("assistant");
      expect(updated.messages[2].role).toBe("user");
    });
  });

  describe("responseToHistoryItems", () => {
    it("Returns text history item for completed response", () => {
      const history = adapter.responseToHistoryItems(mockConverseResponse);
      expect(history).toHaveLength(1);
      expect((history[0] as { content: string }).content).toBe("Hello, world!");
    });

    it("Returns empty array for tool_use stop reason", () => {
      const history = adapter.responseToHistoryItems(mockToolUseResponse);
      expect(history).toHaveLength(0);
    });
  });

  describe("classifyError", () => {
    it("Classifies throttling as rate limit", () => {
      const error = new Error("ThrottlingException: Too many requests");
      Object.defineProperty(error, "constructor", {
        value: { name: "ThrottlingException" },
      });
      const mockError = { constructor: { name: "ThrottlingException" } };
      const classified = adapter.classifyError(mockError);
      expect(classified.category).toBe(ErrorCategory.RateLimit);
      expect(classified.shouldRetry).toBe(false);
    });

    it("Classifies access denied as unrecoverable", () => {
      const mockError = {
        constructor: { name: "AccessDeniedException" },
        message: "AccessDeniedException",
      };
      const classified = adapter.classifyError(mockError);
      expect(classified.category).toBe(ErrorCategory.Unrecoverable);
      expect(classified.shouldRetry).toBe(false);
    });

    it("Classifies service unavailable as retryable", () => {
      const mockError = {
        constructor: { name: "ServiceUnavailableException" },
        message: "ServiceUnavailableException",
      };
      const classified = adapter.classifyError(mockError);
      expect(classified.category).toBe(ErrorCategory.Retryable);
      expect(classified.shouldRetry).toBe(true);
    });

    it("Returns unknown for unrecognized errors", () => {
      const classified = adapter.classifyError(new Error("Unknown error"));
      expect(classified.category).toBe(ErrorCategory.Unknown);
      expect(classified.shouldRetry).toBe(true);
    });
  });

  describe("isComplete", () => {
    it("Returns true for end_turn stop reason", () => {
      expect(adapter.isComplete(mockConverseResponse)).toBe(true);
    });

    it("Returns false for tool_use stop reason", () => {
      expect(adapter.isComplete(mockToolUseResponse)).toBe(false);
    });
  });
});
