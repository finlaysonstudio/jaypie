import { describe, expect, it, vi, beforeEach, Mock } from "vitest";

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
  LlmResponseStatus,
} from "../../types/LlmProvider.interface.js";
import { ErrorCategory, ParsedResponse, StandardToolCall } from "../types.js";
import { Toolkit } from "../../tools/Toolkit.class.js";

//
//
// Mock
//

vi.mock("@jaypie/core", () => ({
  JAYPIE: {
    LIB: {
      LLM: "@jaypie/llm",
    },
  },
  log: {
    lib: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
      trace: vi.fn(),
      var: vi.fn(),
      warn: vi.fn(),
    })),
  },
  placeholders: vi.fn((str: string) => str),
  resolveValue: vi.fn((val) => val),
  sleep: vi.fn(() => Promise.resolve()),
}));

vi.mock("@jaypie/errors", () => ({
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
  parseResponse = vi.fn(
    (response): ParsedResponse => ({
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
    }),
  );
  extractToolCalls = vi.fn(() => []);
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
  responseToHistoryItems = vi.fn(
    (): LlmHistory => [
      {
        content: "Hello!",
        role: LlmMessageRole.Assistant,
        type: LlmMessageType.Message,
      },
    ],
  );
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
        mockAdapter.parseResponse = vi.fn(
          (response): ParsedResponse => ({
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
          }),
        );

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
    });
  });

  // Specific Scenarios
  describe("Specific Scenarios", () => {
    it("uses custom maxRetries from config", () => {
      const loop = new OperateLoop({
        adapter: mockAdapter,
        client: mockClient,
        maxRetries: 10,
      });

      // The loop is created with custom maxRetries
      expect(loop).toBeInstanceOf(OperateLoop);
    });

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
});
