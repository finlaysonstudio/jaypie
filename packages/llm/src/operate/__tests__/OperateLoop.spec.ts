import { describe, expect, it, vi, beforeEach, Mock } from "vitest";

import { log } from "@jaypie/logger";

import {
  OperateLoop,
  createOperateLoop,
  OperateLoopConfig,
} from "../OperateLoop.js";
import { BaseProviderAdapter } from "../adapters/index.js";
import {
  LlmHistory,
  LlmMessageRole,
  LlmMessageType,
  LlmOperateOptions,
  LlmProgressEvent,
  LlmProgressEventType,
  LlmResponseStatus,
} from "../../types/LlmProvider.interface.js";
import { ErrorCategory, ParsedResponse, StandardToolCall } from "../types.js";
import { Toolkit } from "../../tools/Toolkit.class.js";
import { JsonObject } from "@jaypie/types";

//
//
// Mock
//

vi.mock("@jaypie/kit", () => ({
  JAYPIE: {
    LIB: {
      LLM: "@jaypie/llm",
    },
  },
  placeholders: vi.fn((str: string) => str),
  resolveValue: vi.fn((val) => val),
  sleep: vi.fn(() => Promise.resolve()),
}));

vi.mock("@jaypie/logger", () => ({
  log: {
    lib: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
      trace: Object.assign(vi.fn(), { var: vi.fn() }),
      var: vi.fn(),
      warn: vi.fn(),
    })),
    tally: vi.fn(),
  },
}));

vi.mock("@jaypie/errors", () => ({
  JaypieError: class JaypieError extends Error {
    isJaypieError = true;
    status = 500;
    title = "Internal Error";
    constructor(message = "Internal Error") {
      super(message);
    }
  },
  BadGatewayError: class BadGatewayError extends Error {
    status = 502;
    title = "Bad Gateway";
    constructor() {
      super("Bad Gateway");
    }
  },
  TooManyRequestsError: class TooManyRequestsError extends Error {
    status = 429;
    title = "Too Many Requests";
    constructor() {
      super("Too Many Requests");
    }
  },
}));

//
//
// Fixtures
//

class MockAdapter extends BaseProviderAdapter {
  readonly name = "mock";
  readonly defaultModel = "mock-model";

  buildRequest = vi.fn((request) => request);
  formatTools = vi.fn((toolkit) =>
    toolkit.tools.map((t: { name: string; description: string }) => ({
      name: t.name,
      description: t.description,
      parameters: {},
    })),
  );
  formatOutputSchema = vi.fn((schema) => schema);
  executeRequest = vi.fn(() =>
    Promise.resolve({
      content: [{ type: "text", text: "Hello!" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 20 },
    }),
  );
  parseResponse = vi.fn((response): ParsedResponse => ({
    content: "Hello!",
    hasToolCalls: false,
    stopReason: "end_turn",
    usage: {
      input: 10,
      output: 20,
      reasoning: 0,
      total: 30,
      provider: "mock",
      model: "mock-model",
    },
    raw: response,
  }));
  extractToolCalls = vi.fn((): StandardToolCall[] => []);
  extractUsage = vi.fn(() => ({
    input: 10,
    output: 20,
    reasoning: 0,
    total: 30,
    provider: "mock",
    model: "mock-model",
  }));
  formatToolResult = vi.fn((toolCall, result) => ({
    type: "tool_result",
    tool_use_id: toolCall.callId,
    content: result.output,
  }));
  appendToolResult = vi.fn((request) => request);
  responseToHistoryItems = vi.fn((): LlmHistory => [
    {
      content: "Hello!",
      role: LlmMessageRole.Assistant,
      type: LlmMessageType.Message,
    },
  ]);
  classifyError = vi.fn(() => ({
    error: new Error("Test"),
    category: ErrorCategory.Unknown,
    shouldRetry: true,
  }));
  isComplete = vi.fn(() => true);
}

function createMockConfig(): OperateLoopConfig {
  return {
    adapter: new MockAdapter(),
    client: {},
  };
}

//
//
// Tests
//

describe("OperateLoop", () => {
  let mockAdapter: MockAdapter;
  let mockClient: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = new MockAdapter();
    mockClient = {};
  });

  // Base Cases
  describe("Base Cases", () => {
    it("exports OperateLoop class", () => {
      expect(OperateLoop).toBeDefined();
      expect(typeof OperateLoop).toBe("function");
    });

    it("exports createOperateLoop factory", () => {
      expect(createOperateLoop).toBeDefined();
      expect(typeof createOperateLoop).toBe("function");
    });

    it("can be instantiated with config", () => {
      const loop = new OperateLoop(createMockConfig());
      expect(loop).toBeInstanceOf(OperateLoop);
    });

    it("createOperateLoop returns OperateLoop instance", () => {
      const loop = createOperateLoop(createMockConfig());
      expect(loop).toBeInstanceOf(OperateLoop);
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    it("executes a simple request and returns response", async () => {
      const loop = new OperateLoop({
        adapter: mockAdapter,
        client: mockClient,
      });

      const result = await loop.execute("Hello");

      expect(result).toBeDefined();
      expect(result.provider).toBe("mock");
      expect(result.model).toBe("mock-model");
      expect(result.status).toBe(LlmResponseStatus.Completed);
    });

    it("processes string input", async () => {
      const loop = new OperateLoop({
        adapter: mockAdapter,
        client: mockClient,
      });

      await loop.execute("Test message");

      expect(mockAdapter.executeRequest).toHaveBeenCalled();
    });

    it("processes array input", async () => {
      const loop = new OperateLoop({
        adapter: mockAdapter,
        client: mockClient,
      });

      const input: LlmHistory = [
        {
          content: "Hello",
          role: LlmMessageRole.User,
          type: LlmMessageType.Message,
        },
      ];

      await loop.execute(input);

      expect(mockAdapter.executeRequest).toHaveBeenCalled();
    });

    it("returns content from adapter response", async () => {
      const loop = new OperateLoop({
        adapter: mockAdapter,
        client: mockClient,
      });

      const result = await loop.execute("Hello");

      expect(result.content).toBe("Hello!");
    });

    it("tracks usage from adapter", async () => {
      const loop = new OperateLoop({
        adapter: mockAdapter,
        client: mockClient,
      });

      const result = await loop.execute("Hello");

      expect(result.usage).toHaveLength(1);
      expect(result.usage[0].input).toBe(10);
      expect(result.usage[0].output).toBe(20);
    });
  });

  // Features
  describe("Features", () => {
    describe("Tool Calling", () => {
      it("calls tools when adapter returns tool calls", async () => {
        const toolCallFn = vi.fn(() => "tool result");
        const toolkit = new Toolkit([
          {
            name: "test_tool",
            description: "A test tool",
            parameters: { type: "object" },
            type: "function",
            call: toolCallFn,
          },
        ]);

        // Setup adapter to return tool call on first request
        let callCount = 0;
        mockAdapter.parseResponse = vi.fn((response): ParsedResponse => {
          callCount++;
          if (callCount === 1) {
            return {
              content: undefined,
              hasToolCalls: true,
              stopReason: "tool_use",
              usage: {
                input: 10,
                output: 20,
                reasoning: 0,
                total: 30,
                provider: "mock",
                model: "mock-model",
              },
              raw: response,
            };
          }
          return {
            content: "Done!",
            hasToolCalls: false,
            stopReason: "end_turn",
            usage: {
              input: 10,
              output: 20,
              reasoning: 0,
              total: 30,
              provider: "mock",
              model: "mock-model",
            },
            raw: response,
          };
        }) as Mock;

        mockAdapter.extractToolCalls = vi.fn((): StandardToolCall[] => [
          {
            callId: "call-123",
            name: "test_tool",
            arguments: "{}",
            raw: {},
          },
        ]);

        const loop = new OperateLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        const result = await loop.execute("Call the tool", {
          tools: toolkit,
          turns: 3,
        });

        expect(toolCallFn).toHaveBeenCalled();
        expect(result.status).toBe(LlmResponseStatus.Completed);
      });

      it("respects turns limit", async () => {
        // Always return tool calls
        mockAdapter.parseResponse = vi.fn((response): ParsedResponse => ({
          content: undefined,
          hasToolCalls: true,
          stopReason: "tool_use",
          usage: {
            input: 10,
            output: 20,
            reasoning: 0,
            total: 30,
            provider: "mock",
            model: "mock-model",
          },
          raw: response,
        }));

        mockAdapter.extractToolCalls = vi.fn((): StandardToolCall[] => [
          {
            callId: "call-123",
            name: "test_tool",
            arguments: "{}",
            raw: {},
          },
        ]);

        const toolkit = new Toolkit([
          {
            name: "test_tool",
            description: "A test tool",
            parameters: { type: "object" },
            type: "function",
            call: vi.fn(() => "result"),
          },
        ]);

        const loop = new OperateLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        const result = await loop.execute("Call the tool", {
          tools: toolkit,
          turns: 2,
        });

        expect(result.status).toBe(LlmResponseStatus.Incomplete);
        expect(result.error).toBeDefined();
        expect(result.error?.title).toBe("Too Many Requests");
      });
    });

    describe("Report Tally", () => {
      it("tallies turns and usage on completion", async () => {
        const loop = new OperateLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        await loop.execute("Hello");

        expect(log.tally).toHaveBeenCalledWith({
          llm: {
            operates: 1,
            toolCalls: 0,
            turns: 1,
            usage: {
              "mock:mock-model": {
                input: 10,
                output: 20,
                reasoning: 0,
                total: 30,
              },
            },
          },
        });
      });

      it("tallies tool calls across turns", async () => {
        const toolkit = new Toolkit([
          {
            name: "test_tool",
            description: "A test tool",
            parameters: { type: "object" },
            type: "function",
            call: vi.fn(() => "tool result"),
          },
        ]);

        let callCount = 0;
        mockAdapter.parseResponse = vi.fn((response): ParsedResponse => {
          callCount++;
          return {
            content: callCount === 1 ? undefined : "Done!",
            hasToolCalls: callCount === 1,
            stopReason: callCount === 1 ? "tool_use" : "end_turn",
            usage: {
              input: 10,
              output: 20,
              reasoning: 0,
              total: 30,
              provider: "mock",
              model: "mock-model",
            },
            raw: response,
          };
        }) as Mock;
        mockAdapter.extractToolCalls = vi.fn((): StandardToolCall[] => [
          {
            callId: "call-123",
            name: "test_tool",
            arguments: "{}",
            raw: {},
          },
        ]);

        const loop = new OperateLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        await loop.execute("Call the tool", { tools: toolkit, turns: 3 });

        expect(log.tally).toHaveBeenCalledWith({
          llm: {
            operates: 1,
            toolCalls: 1,
            tools: { test_tool: 1 },
            turns: 2,
            usage: {
              "mock:mock-model": {
                input: 20,
                output: 40,
                reasoning: 0,
                total: 60,
              },
            },
          },
        });
      });
    });

    describe("Hooks", () => {
      it("calls beforeEachModelRequest hook", async () => {
        const beforeHook = vi.fn();

        const loop = new OperateLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        await loop.execute("Hello", {
          hooks: {
            beforeEachModelRequest: beforeHook,
          },
        });

        expect(beforeHook).toHaveBeenCalled();
      });

      it("calls afterEachModelResponse hook", async () => {
        const afterHook = vi.fn();

        const loop = new OperateLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        await loop.execute("Hello", {
          hooks: {
            afterEachModelResponse: afterHook,
          },
        });

        expect(afterHook).toHaveBeenCalled();
      });

      it("calls beforeEachTool hook", async () => {
        const beforeToolHook = vi.fn();

        // Setup for tool call
        let callCount = 0;
        mockAdapter.parseResponse = vi.fn((response): ParsedResponse => {
          callCount++;
          if (callCount === 1) {
            return {
              content: undefined,
              hasToolCalls: true,
              stopReason: "tool_use",
              usage: {
                input: 10,
                output: 20,
                reasoning: 0,
                total: 30,
                provider: "mock",
                model: "mock-model",
              },
              raw: response,
            };
          }
          return {
            content: "Done!",
            hasToolCalls: false,
            stopReason: "end_turn",
            usage: {
              input: 10,
              output: 20,
              reasoning: 0,
              total: 30,
              provider: "mock",
              model: "mock-model",
            },
            raw: response,
          };
        }) as Mock;

        mockAdapter.extractToolCalls = vi.fn((): StandardToolCall[] => [
          {
            callId: "call-123",
            name: "test_tool",
            arguments: "{}",
            raw: {},
          },
        ]);

        const toolkit = new Toolkit([
          {
            name: "test_tool",
            description: "A test tool",
            parameters: { type: "object" },
            type: "function",
            call: vi.fn(() => "result"),
          },
        ]);

        const loop = new OperateLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        await loop.execute("Call tool", {
          tools: toolkit,
          turns: 3,
          hooks: {
            beforeEachTool: beforeToolHook,
          },
        });

        expect(beforeToolHook).toHaveBeenCalled();
      });

      it("passes resolved tool message to beforeEachTool and afterEachTool hooks", async () => {
        const beforeToolHook = vi.fn();
        const afterToolHook = vi.fn();

        let callCount = 0;
        mockAdapter.parseResponse = vi.fn((response): ParsedResponse => {
          callCount++;
          if (callCount === 1) {
            return {
              content: undefined,
              hasToolCalls: true,
              stopReason: "tool_use",
              usage: {
                input: 10,
                output: 20,
                reasoning: 0,
                total: 30,
                provider: "mock",
                model: "mock-model",
              },
              raw: response,
            };
          }
          return {
            content: "Done!",
            hasToolCalls: false,
            stopReason: "end_turn",
            usage: {
              input: 10,
              output: 20,
              reasoning: 0,
              total: 30,
              provider: "mock",
              model: "mock-model",
            },
            raw: response,
          };
        }) as Mock;

        mockAdapter.extractToolCalls = vi.fn((): StandardToolCall[] => [
          {
            callId: "call-123",
            name: "test_tool",
            arguments: JSON.stringify({ city: "NYC" }),
            raw: {},
          },
        ]);

        const toolkit = new Toolkit([
          {
            name: "test_tool",
            description: "A test tool",
            parameters: { type: "object" },
            type: "function",
            call: vi.fn(() => "result"),
            message: ({ city }: { city?: string } = {}) =>
              `Checking weather in ${city}`,
          },
        ]);

        const loop = new OperateLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        await loop.execute("Call tool", {
          tools: toolkit,
          turns: 3,
          hooks: {
            afterEachTool: afterToolHook,
            beforeEachTool: beforeToolHook,
          },
        });

        expect(beforeToolHook).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "Checking weather in NYC",
            toolName: "test_tool",
          }),
        );
        expect(afterToolHook).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "Checking weather in NYC",
            result: "result",
            toolName: "test_tool",
          }),
        );
      });

      it("logs at warn level when tool throws, not error", async () => {
        const { log: mockLog } = await import("@jaypie/logger");
        const mockLogger = {
          debug: vi.fn(),
          error: vi.fn(),
          trace: Object.assign(vi.fn(), { var: vi.fn() }),
          var: vi.fn(),
          warn: vi.fn(),
        };
        (mockLog.lib as Mock).mockReturnValue(mockLogger);

        let callCount = 0;
        mockAdapter.parseResponse = vi.fn((response): ParsedResponse => {
          callCount++;
          if (callCount === 1) {
            return {
              content: undefined,
              hasToolCalls: true,
              stopReason: "tool_use",
              usage: {
                input: 10,
                output: 20,
                reasoning: 0,
                total: 30,
                provider: "mock",
                model: "mock-model",
              },
              raw: response,
            };
          }
          return {
            content: "Done!",
            hasToolCalls: false,
            stopReason: "end_turn",
            usage: {
              input: 10,
              output: 20,
              reasoning: 0,
              total: 30,
              provider: "mock",
              model: "mock-model",
            },
            raw: response,
          };
        }) as Mock;

        mockAdapter.extractToolCalls = vi.fn((): StandardToolCall[] => [
          {
            callId: "call-123",
            name: "test_tool",
            arguments: "{}",
            raw: {},
          },
        ]);

        const toolkit = new Toolkit([
          {
            name: "test_tool",
            description: "A test tool",
            parameters: { type: "object" },
            type: "function",
            call: vi.fn(() => {
              throw new Error("refused: not in allowlist");
            }),
          },
        ]);

        const loop = new OperateLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        await loop.execute("Call the tool", { tools: toolkit, turns: 3 });

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining("test_tool"),
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
      });
    });

    describe("Progress", () => {
      it("emits start, model_request, model_response, and done events in order", async () => {
        const events: LlmProgressEvent[] = [];
        const loop = new OperateLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        const result = await loop.execute("Hello", {
          onProgress: (event) => {
            events.push(event);
          },
        });

        expect(result.status).toBe(LlmResponseStatus.Completed);
        expect(events.map(({ type }) => type)).toEqual([
          LlmProgressEventType.Start,
          LlmProgressEventType.ModelRequest,
          LlmProgressEventType.ModelResponse,
          LlmProgressEventType.Done,
        ]);
        expect(events[0].model).toBe("mock-model");
        expect(events[0].provider).toBe("mock");
        expect(events[events.length - 1].content).toBe("Hello!");
        expect(events[events.length - 1].usage).toHaveLength(1);
      });

      it("emits tool_call and tool_result events", async () => {
        let callCount = 0;
        mockAdapter.parseResponse = vi.fn((response): ParsedResponse => {
          callCount++;
          if (callCount === 1) {
            return {
              content: undefined,
              hasToolCalls: true,
              stopReason: "tool_use",
              usage: {
                input: 10,
                output: 20,
                reasoning: 0,
                total: 30,
                provider: "mock",
                model: "mock-model",
              },
              raw: response,
            };
          }
          return {
            content: "Done!",
            hasToolCalls: false,
            stopReason: "end_turn",
            usage: {
              input: 10,
              output: 20,
              reasoning: 0,
              total: 30,
              provider: "mock",
              model: "mock-model",
            },
            raw: response,
          };
        }) as Mock;
        mockAdapter.extractToolCalls = vi.fn((): StandardToolCall[] => [
          {
            callId: "call-1",
            name: "test_tool",
            arguments: "{}",
            raw: {},
          },
        ]);
        const toolkit = new Toolkit([
          {
            name: "test_tool",
            description: "A test tool",
            parameters: { type: "object" },
            type: "function",
            call: vi.fn(() => "tool result"),
            message: "Running the test tool",
          },
        ]);

        const events: LlmProgressEvent[] = [];
        const loop = new OperateLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        await loop.execute("Call the tool", {
          onProgress: (event) => {
            events.push(event);
          },
          tools: toolkit,
          turns: 3,
        });

        const toolCallEvent = events.find(
          ({ type }) => type === LlmProgressEventType.ToolCall,
        );
        expect(toolCallEvent?.tool).toEqual({
          arguments: "{}",
          message: "Running the test tool",
          name: "test_tool",
        });
        const toolResultEvent = events.find(
          ({ type }) => type === LlmProgressEventType.ToolResult,
        );
        expect(toolResultEvent?.tool?.name).toBe("test_tool");
        const modelResponseEvent = events.find(
          ({ type }) => type === LlmProgressEventType.ModelResponse,
        );
        expect(modelResponseEvent?.toolCalls).toEqual([
          { arguments: "{}", name: "test_tool" },
        ]);
      });

      it("emits tool_error when a tool throws", async () => {
        let callCount = 0;
        mockAdapter.parseResponse = vi.fn((response): ParsedResponse => {
          callCount++;
          return {
            content: callCount === 1 ? undefined : "Done!",
            hasToolCalls: callCount === 1,
            stopReason: callCount === 1 ? "tool_use" : "end_turn",
            usage: {
              input: 10,
              output: 20,
              reasoning: 0,
              total: 30,
              provider: "mock",
              model: "mock-model",
            },
            raw: response,
          };
        }) as Mock;
        mockAdapter.extractToolCalls = vi.fn((): StandardToolCall[] => [
          {
            callId: "call-1",
            name: "test_tool",
            arguments: "{}",
            raw: {},
          },
        ]);
        const toolkit = new Toolkit([
          {
            name: "test_tool",
            description: "A test tool",
            parameters: { type: "object" },
            type: "function",
            call: vi.fn(() => {
              throw new Error("boom");
            }),
          },
        ]);

        const events: LlmProgressEvent[] = [];
        const loop = new OperateLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        await loop.execute("Call the tool", {
          onProgress: (event) => {
            events.push(event);
          },
          tools: toolkit,
          turns: 3,
        });

        const toolErrorEvent = events.find(
          ({ type }) => type === LlmProgressEventType.ToolError,
        );
        expect(toolErrorEvent?.error).toBe("boom");
        expect(toolErrorEvent?.tool?.name).toBe("test_tool");
      });

      it("does not interrupt the loop when onProgress throws", async () => {
        const loop = new OperateLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        const result = await loop.execute("Hello", {
          onProgress: () => {
            throw new Error("Progress failure");
          },
        });

        expect(result.status).toBe(LlmResponseStatus.Completed);
        expect(result.content).toBe("Hello!");
      });
    });

    describe("Structured Output", () => {
      it("handles structured output from adapter", async () => {
        mockAdapter.hasStructuredOutput = vi.fn(() => true);
        mockAdapter.extractStructuredOutput = vi.fn(() => ({
          name: "John",
          age: 30,
        }));

        const loop = new OperateLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        const result = await loop.execute("Get data", {
          format: { type: "object" },
        });

        expect(result.content).toEqual({ name: "John", age: 30 });
      });

      it("backfills declared array fields omitted from structured output", async () => {
        mockAdapter.hasStructuredOutput = vi.fn(() => true);
        mockAdapter.extractStructuredOutput = vi.fn(() => ({
          "Merchant Request": "refund",
        }));

        const loop = new OperateLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        const result = await loop.execute("Get data", {
          format: {
            "Merchant Request": String,
            "Merchant Attachments": [String],
            "Recommended Actions": [String],
          },
        });

        expect(result.content).toEqual({
          "Merchant Request": "refund",
          "Merchant Attachments": [],
          "Recommended Actions": [],
        });
      });

      it("backfills declared array fields omitted from parsed content", async () => {
        mockAdapter.parseResponse = vi.fn((response): ParsedResponse => ({
          content: { name: "Jane" } as JsonObject,
          hasToolCalls: false,
          stopReason: "end_turn",
          usage: {
            input: 10,
            output: 20,
            reasoning: 0,
            total: 30,
            provider: "mock",
            model: "mock-model",
          },
          raw: response,
        }));

        const loop = new OperateLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        const result = await loop.execute("Get data", {
          format: { name: String, tags: [String] },
        });

        expect(result.content).toEqual({ name: "Jane", tags: [] });
      });

      it("repairs quote-wrapped multi-word keys in structured output", async () => {
        mockAdapter.hasStructuredOutput = vi.fn(() => true);
        mockAdapter.extractStructuredOutput = vi.fn(() => ({
          '"Merchant Request"': "refund",
          Confidence: 5,
          '"Recommended Actions"': ["call"],
        }));

        const loop = new OperateLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        const result = await loop.execute("Get data", {
          format: {
            "Merchant Request": String,
            Confidence: Number,
            "Recommended Actions": [String],
          },
        });

        expect(result.content).toEqual({
          "Merchant Request": "refund",
          Confidence: 5,
          "Recommended Actions": ["call"],
        });
      });

      it("repairs quote-wrapped multi-word keys in parsed content", async () => {
        mockAdapter.parseResponse = vi.fn((response): ParsedResponse => ({
          content: { '"Full Name"': "Jane" } as JsonObject,
          hasToolCalls: false,
          stopReason: "end_turn",
          usage: {
            input: 10,
            output: 20,
            reasoning: 0,
            total: 30,
            provider: "mock",
            model: "mock-model",
          },
          raw: response,
        }));

        const loop = new OperateLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        const result = await loop.execute("Get data", {
          format: { "Full Name": String },
        });

        expect(result.content).toEqual({ "Full Name": "Jane" });
      });
    });
  });

  // Specific Scenarios
  describe("Specific Scenarios", () => {
    it("handles options.model override", async () => {
      const loop = new OperateLoop({
        adapter: mockAdapter,
        client: mockClient,
      });

      const result = await loop.execute("Hello", {
        model: "custom-model",
      });

      expect(result.model).toBe("custom-model");
    });

    it("passes options to adapter", async () => {
      const loop = new OperateLoop({
        adapter: mockAdapter,
        client: mockClient,
      });

      const options: LlmOperateOptions = {
        model: "test-model",
        system: "You are helpful",
        instructions: "Be concise",
      };

      await loop.execute("Hello", options);

      expect(mockAdapter.buildRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "test-model",
          system: "You are helpful",
          instructions: "Be concise",
        }),
      );
    });
  });

  // Logger Context
  describe("Logger Context", () => {
    it("calls getLogger() at execute time, not module load time", async () => {
      // Import the mocked logger to inspect calls
      const { log: mockLog } = await import("@jaypie/logger");
      const libSpy = mockLog.lib as Mock;

      // Clear any calls from module initialization
      libSpy.mockClear();

      const loop = new OperateLoop({
        adapter: mockAdapter,
        client: mockClient,
      });

      // lib() should not have been called yet (no module-level log)
      expect(libSpy).not.toHaveBeenCalled();

      await loop.execute("Hello");

      // lib() should be called during execute() to capture request-scoped tags
      expect(libSpy).toHaveBeenCalledWith({ lib: "@jaypie/llm" });
    });
  });

  // Structured output contract enforcement
  describe("Format Contract Enforcement", () => {
    const format = {
      type: "object",
      properties: { total: { type: "number" } },
    } as JsonObject;

    it("salvages prose that is itself JSON", async () => {
      mockAdapter.parseResponse.mockReturnValueOnce({
        content: '{"total": 21}',
        hasToolCalls: false,
        stopReason: "end_turn",
        raw: {},
      } as ParsedResponse);
      const loop = new OperateLoop({
        adapter: mockAdapter,
        client: mockClient,
      });

      const response = await loop.execute("Roll dice", { format });

      expect(response.content).toEqual({ total: 21 });
      expect(mockAdapter.executeRequest).toHaveBeenCalledTimes(1);
    });

    it("salvages fenced JSON", async () => {
      mockAdapter.parseResponse.mockReturnValueOnce({
        content: '```json\n{"total": 21}\n```',
        hasToolCalls: false,
        stopReason: "end_turn",
        raw: {},
      } as ParsedResponse);
      const loop = new OperateLoop({
        adapter: mockAdapter,
        client: mockClient,
      });

      const response = await loop.execute("Roll dice", { format });

      expect(response.content).toEqual({ total: 21 });
    });

    it("takes a corrective turn when the adapter supports structured output retry", async () => {
      Object.defineProperty(mockAdapter, "supportsStructuredOutputRetry", {
        value: true,
      });
      mockAdapter.parseResponse
        .mockReturnValueOnce({
          content: "You rolled a total of 21!",
          hasToolCalls: false,
          stopReason: "end_turn",
          raw: {},
        } as ParsedResponse)
        .mockReturnValueOnce({
          content: undefined,
          hasToolCalls: true,
          stopReason: "tool_calls",
          raw: {},
        } as ParsedResponse);
      mockAdapter.hasStructuredOutput = vi
        .fn()
        .mockReturnValueOnce(false)
        .mockReturnValue(true);
      mockAdapter.extractStructuredOutput = vi.fn(() => ({ total: 21 }));
      const loop = new OperateLoop({
        adapter: mockAdapter,
        client: mockClient,
      });

      const response = await loop.execute("Roll dice", { format, turns: 3 });

      expect(response.content).toEqual({ total: 21 });
      expect(mockAdapter.executeRequest).toHaveBeenCalledTimes(2);
      // The corrective request is flagged so adapters can restrict tools
      const secondBuild = mockAdapter.buildRequest.mock.calls[1][0];
      expect(secondBuild.structuredOutputRetry).toBe(true);
      // Corrective user message was appended to the conversation
      const lastMessage = secondBuild.messages[secondBuild.messages.length - 1];
      expect(lastMessage.role).toBe(LlmMessageRole.User);
      expect(lastMessage.content).toContain("structured_output");
    });

    it("returns prose unchanged when the adapter does not support retry", async () => {
      mockAdapter.parseResponse.mockReturnValueOnce({
        content: "You rolled a total of 21!",
        hasToolCalls: false,
        stopReason: "end_turn",
        raw: {},
      } as ParsedResponse);
      const loop = new OperateLoop({
        adapter: mockAdapter,
        client: mockClient,
      });

      const response = await loop.execute("Roll dice", { format, turns: 3 });

      expect(response.content).toBe("You rolled a total of 21!");
      expect(mockAdapter.executeRequest).toHaveBeenCalledTimes(1);
    });

    it("stops retrying at the turn budget", async () => {
      Object.defineProperty(mockAdapter, "supportsStructuredOutputRetry", {
        value: true,
      });
      mockAdapter.parseResponse.mockReturnValue({
        content: "Still prose.",
        hasToolCalls: false,
        stopReason: "end_turn",
        raw: {},
      } as ParsedResponse);
      const loop = new OperateLoop({
        adapter: mockAdapter,
        client: mockClient,
      });

      const response = await loop.execute("Roll dice", { format, turns: 2 });

      expect(response.content).toBe("Still prose.");
      expect(mockAdapter.executeRequest).toHaveBeenCalledTimes(2);
    });
  });
});
