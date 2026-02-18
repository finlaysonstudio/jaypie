import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  StreamLoop,
  createStreamLoop,
  StreamLoopConfig,
} from "../StreamLoop.js";
import { BaseProviderAdapter } from "../adapters/index.js";
import {
  LlmHistory,
  LlmMessageRole,
  LlmMessageType,
  LlmOperateOptions,
} from "../../types/LlmProvider.interface.js";
import {
  LlmStreamChunk,
  LlmStreamChunkType,
} from "../../types/LlmStreamChunk.interface.js";
import { ErrorCategory, ParsedResponse } from "../types.js";
import { RetryPolicy } from "../retry/RetryPolicy.js";
import { Toolkit } from "../../tools/Toolkit.class.js";

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
      trace: vi.fn(),
      var: vi.fn(),
      warn: vi.fn(),
    })),
  },
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

class MockStreamAdapter extends BaseProviderAdapter {
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

  // Default streaming response - yields text chunks then done
  executeStreamRequest = vi.fn(
    async function* (): AsyncIterable<LlmStreamChunk> {
      yield { type: LlmStreamChunkType.Text, content: "Hello" };
      yield { type: LlmStreamChunkType.Text, content: " world!" };
      yield {
        type: LlmStreamChunkType.Done,
        usage: [
          {
            input: 10,
            output: 20,
            reasoning: 0,
            total: 30,
            provider: "mock",
            model: "mock-model",
          },
        ],
      };
    },
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

function createMockConfig(): StreamLoopConfig {
  return {
    adapter: new MockStreamAdapter(),
    client: {},
  };
}

async function collectChunks(
  iterable: AsyncIterable<LlmStreamChunk>,
): Promise<LlmStreamChunk[]> {
  const chunks: LlmStreamChunk[] = [];
  for await (const chunk of iterable) {
    chunks.push(chunk);
  }
  return chunks;
}

//
//
// Tests
//

describe("StreamLoop", () => {
  let mockAdapter: MockStreamAdapter;
  let mockClient: unknown;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = new MockStreamAdapter();
    mockClient = {};
  });

  // Base Cases
  describe("Base Cases", () => {
    it("exports StreamLoop class", () => {
      expect(StreamLoop).toBeDefined();
      expect(typeof StreamLoop).toBe("function");
    });

    it("exports createStreamLoop factory", () => {
      expect(createStreamLoop).toBeDefined();
      expect(typeof createStreamLoop).toBe("function");
    });

    it("can be instantiated with config", () => {
      const loop = new StreamLoop(createMockConfig());
      expect(loop).toBeInstanceOf(StreamLoop);
    });

    it("createStreamLoop returns StreamLoop instance", () => {
      const loop = createStreamLoop(createMockConfig());
      expect(loop).toBeInstanceOf(StreamLoop);
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    it("yields text chunks from streaming response", async () => {
      const loop = new StreamLoop({
        adapter: mockAdapter,
        client: mockClient,
      });

      const chunks = await collectChunks(loop.execute("Hello"));

      const textChunks = chunks.filter(
        (c) => c.type === LlmStreamChunkType.Text,
      );
      expect(textChunks).toHaveLength(2);
      expect(textChunks[0]).toEqual({
        type: LlmStreamChunkType.Text,
        content: "Hello",
      });
      expect(textChunks[1]).toEqual({
        type: LlmStreamChunkType.Text,
        content: " world!",
      });
    });

    it("yields done chunk at the end", async () => {
      const loop = new StreamLoop({
        adapter: mockAdapter,
        client: mockClient,
      });

      const chunks = await collectChunks(loop.execute("Hello"));

      const doneChunk = chunks.find((c) => c.type === LlmStreamChunkType.Done);
      expect(doneChunk).toBeDefined();
      expect(doneChunk?.type).toBe(LlmStreamChunkType.Done);
    });

    it("accumulates usage in done chunk", async () => {
      const loop = new StreamLoop({
        adapter: mockAdapter,
        client: mockClient,
      });

      const chunks = await collectChunks(loop.execute("Hello"));

      const doneChunk = chunks.find(
        (c) => c.type === LlmStreamChunkType.Done,
      ) as { type: LlmStreamChunkType.Done; usage: unknown[] };
      expect(doneChunk.usage).toHaveLength(1);
    });

    it("processes string input", async () => {
      const loop = new StreamLoop({
        adapter: mockAdapter,
        client: mockClient,
      });

      await collectChunks(loop.execute("Test message"));

      expect(mockAdapter.executeStreamRequest).toHaveBeenCalled();
    });

    it("processes array input", async () => {
      const loop = new StreamLoop({
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

      await collectChunks(loop.execute(input));

      expect(mockAdapter.executeStreamRequest).toHaveBeenCalled();
    });
  });

  // Features
  describe("Features", () => {
    describe("Automatic Tool Execution", () => {
      it("yields tool_call chunks when LLM requests tools", async () => {
        // Setup adapter to stream a tool call
        mockAdapter.executeStreamRequest = vi.fn(
          async function* (): AsyncIterable<LlmStreamChunk> {
            yield {
              type: LlmStreamChunkType.ToolCall,
              toolCall: {
                id: "call-123",
                name: "test_tool",
                arguments: "{}",
              },
            };
            yield {
              type: LlmStreamChunkType.Done,
              usage: [
                {
                  input: 10,
                  output: 20,
                  reasoning: 0,
                  total: 30,
                  provider: "mock",
                  model: "mock-model",
                },
              ],
            };
          },
        );

        const loop = new StreamLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        const chunks = await collectChunks(loop.execute("Call tool"));

        const toolCallChunks = chunks.filter(
          (c) => c.type === LlmStreamChunkType.ToolCall,
        );
        expect(toolCallChunks).toHaveLength(1);
        expect(toolCallChunks[0]).toMatchObject({
          type: LlmStreamChunkType.ToolCall,
          toolCall: {
            id: "call-123",
            name: "test_tool",
          },
        });
      });

      it("automatically executes tools and yields tool_result chunks", async () => {
        const toolCallFn = vi.fn(() => "tool executed successfully");
        const toolkit = new Toolkit([
          {
            name: "test_tool",
            description: "A test tool",
            parameters: { type: "object" },
            type: "function",
            call: toolCallFn,
          },
        ]);

        // First call: yield tool call, then done
        // Second call (after tool execution): yield final text, then done
        let callCount = 0;
        mockAdapter.executeStreamRequest = vi.fn(
          async function* (): AsyncIterable<LlmStreamChunk> {
            callCount++;
            if (callCount === 1) {
              yield {
                type: LlmStreamChunkType.ToolCall,
                toolCall: {
                  id: "call-123",
                  name: "test_tool",
                  arguments: "{}",
                },
              };
              yield {
                type: LlmStreamChunkType.Done,
                usage: [
                  {
                    input: 10,
                    output: 20,
                    reasoning: 0,
                    total: 30,
                    provider: "mock",
                    model: "mock-model",
                  },
                ],
              };
            } else {
              yield {
                type: LlmStreamChunkType.Text,
                content: "Tool result processed!",
              };
              yield {
                type: LlmStreamChunkType.Done,
                usage: [
                  {
                    input: 15,
                    output: 25,
                    reasoning: 0,
                    total: 40,
                    provider: "mock",
                    model: "mock-model",
                  },
                ],
              };
            }
          },
        );

        const loop = new StreamLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        const chunks = await collectChunks(
          loop.execute("Call tool", { tools: toolkit, turns: 3 }),
        );

        // Verify tool was called
        expect(toolCallFn).toHaveBeenCalled();

        // Verify tool_result chunk was yielded
        const toolResultChunks = chunks.filter(
          (c) => c.type === LlmStreamChunkType.ToolResult,
        );
        expect(toolResultChunks).toHaveLength(1);
        expect(toolResultChunks[0]).toMatchObject({
          type: LlmStreamChunkType.ToolResult,
          toolResult: {
            id: "call-123",
            name: "test_tool",
            result: "tool executed successfully",
          },
        });
      });

      it("continues conversation loop after tool execution", async () => {
        const toolCallFn = vi.fn(() => "42");
        const toolkit = new Toolkit([
          {
            name: "calculate",
            description: "Perform a calculation",
            parameters: { type: "object" },
            type: "function",
            call: toolCallFn,
          },
        ]);

        let callCount = 0;
        mockAdapter.executeStreamRequest = vi.fn(
          async function* (): AsyncIterable<LlmStreamChunk> {
            callCount++;
            if (callCount === 1) {
              // First turn: request tool call
              yield {
                type: LlmStreamChunkType.ToolCall,
                toolCall: {
                  id: "call-1",
                  name: "calculate",
                  arguments: '{"expression": "6*7"}',
                },
              };
              yield {
                type: LlmStreamChunkType.Done,
                usage: [
                  {
                    input: 10,
                    output: 5,
                    reasoning: 0,
                    total: 15,
                    provider: "mock",
                    model: "mock-model",
                  },
                ],
              };
            } else {
              // Second turn: final response after tool execution
              yield {
                type: LlmStreamChunkType.Text,
                content: "The answer is 42.",
              };
              yield {
                type: LlmStreamChunkType.Done,
                usage: [
                  {
                    input: 20,
                    output: 10,
                    reasoning: 0,
                    total: 30,
                    provider: "mock",
                    model: "mock-model",
                  },
                ],
              };
            }
          },
        );

        const loop = new StreamLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        const chunks = await collectChunks(
          loop.execute("What is 6 times 7?", { tools: toolkit, turns: 3 }),
        );

        // Verify adapter was called twice (multi-turn)
        expect(mockAdapter.executeStreamRequest).toHaveBeenCalledTimes(2);

        // Verify we got the final text response
        const textChunks = chunks.filter(
          (c) => c.type === LlmStreamChunkType.Text,
        );
        expect(textChunks).toHaveLength(1);
        expect(textChunks[0]).toMatchObject({
          type: LlmStreamChunkType.Text,
          content: "The answer is 42.",
        });

        // Verify usage was accumulated
        const doneChunk = chunks.find(
          (c) => c.type === LlmStreamChunkType.Done,
        ) as { type: LlmStreamChunkType.Done; usage: unknown[] };
        expect(doneChunk.usage).toHaveLength(2);
      });

      it("handles multiple tool calls in sequence", async () => {
        const weatherFn = vi.fn(() => "Sunny, 72°F");
        const timeFn = vi.fn(() => "2:30 PM");
        const toolkit = new Toolkit([
          {
            name: "get_weather",
            description: "Get weather",
            parameters: { type: "object" },
            type: "function",
            call: weatherFn,
          },
          {
            name: "get_time",
            description: "Get time",
            parameters: { type: "object" },
            type: "function",
            call: timeFn,
          },
        ]);

        let callCount = 0;
        mockAdapter.executeStreamRequest = vi.fn(
          async function* (): AsyncIterable<LlmStreamChunk> {
            callCount++;
            if (callCount === 1) {
              // First turn: two tool calls
              yield {
                type: LlmStreamChunkType.ToolCall,
                toolCall: {
                  id: "call-1",
                  name: "get_weather",
                  arguments: "{}",
                },
              };
              yield {
                type: LlmStreamChunkType.ToolCall,
                toolCall: { id: "call-2", name: "get_time", arguments: "{}" },
              };
              yield {
                type: LlmStreamChunkType.Done,
                usage: [
                  {
                    input: 10,
                    output: 10,
                    reasoning: 0,
                    total: 20,
                    provider: "mock",
                    model: "mock-model",
                  },
                ],
              };
            } else {
              // Second turn: final response
              yield {
                type: LlmStreamChunkType.Text,
                content: "It's 2:30 PM and sunny at 72°F.",
              };
              yield {
                type: LlmStreamChunkType.Done,
                usage: [
                  {
                    input: 20,
                    output: 15,
                    reasoning: 0,
                    total: 35,
                    provider: "mock",
                    model: "mock-model",
                  },
                ],
              };
            }
          },
        );

        const loop = new StreamLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        const chunks = await collectChunks(
          loop.execute("What's the weather and time?", {
            tools: toolkit,
            turns: 3,
          }),
        );

        // Both tools should be called
        expect(weatherFn).toHaveBeenCalled();
        expect(timeFn).toHaveBeenCalled();

        // Should have 2 tool_result chunks
        const toolResultChunks = chunks.filter(
          (c) => c.type === LlmStreamChunkType.ToolResult,
        );
        expect(toolResultChunks).toHaveLength(2);
      });

      it("respects turns limit during streaming", async () => {
        const toolkit = new Toolkit([
          {
            name: "infinite_tool",
            description: "Always returns more work",
            parameters: { type: "object" },
            type: "function",
            call: vi.fn(() => "need more"),
          },
        ]);

        // Always return tool calls
        mockAdapter.executeStreamRequest = vi.fn(
          async function* (): AsyncIterable<LlmStreamChunk> {
            yield {
              type: LlmStreamChunkType.ToolCall,
              toolCall: {
                id: "call-n",
                name: "infinite_tool",
                arguments: "{}",
              },
            };
            yield {
              type: LlmStreamChunkType.Done,
              usage: [
                {
                  input: 10,
                  output: 10,
                  reasoning: 0,
                  total: 20,
                  provider: "mock",
                  model: "mock-model",
                },
              ],
            };
          },
        );

        const loop = new StreamLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        const chunks = await collectChunks(
          loop.execute("Do infinite work", { tools: toolkit, turns: 2 }),
        );

        // Should stop at turn limit (2 turns = 2 calls)
        expect(mockAdapter.executeStreamRequest).toHaveBeenCalledTimes(2);

        // Should yield an error chunk about max turns
        const errorChunks = chunks.filter(
          (c) => c.type === LlmStreamChunkType.Error,
        );
        expect(errorChunks).toHaveLength(1);
        expect(errorChunks[0]).toMatchObject({
          type: LlmStreamChunkType.Error,
          error: {
            title: "Too Many Requests",
          },
        });
      });
    });

    describe("Hooks", () => {
      it("calls beforeEachModelRequest hook", async () => {
        const beforeHook = vi.fn();

        const loop = new StreamLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        await collectChunks(
          loop.execute("Hello", {
            hooks: {
              beforeEachModelRequest: beforeHook,
            },
          }),
        );

        expect(beforeHook).toHaveBeenCalled();
      });

      it("calls afterEachModelResponse hook", async () => {
        const afterHook = vi.fn();

        const loop = new StreamLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        await collectChunks(
          loop.execute("Hello", {
            hooks: {
              afterEachModelResponse: afterHook,
            },
          }),
        );

        expect(afterHook).toHaveBeenCalled();
      });

      it("calls beforeEachTool hook before tool execution", async () => {
        const beforeToolHook = vi.fn();
        const toolkit = new Toolkit([
          {
            name: "test_tool",
            description: "Test",
            parameters: { type: "object" },
            type: "function",
            call: vi.fn(() => "result"),
          },
        ]);

        let callCount = 0;
        mockAdapter.executeStreamRequest = vi.fn(
          async function* (): AsyncIterable<LlmStreamChunk> {
            callCount++;
            if (callCount === 1) {
              yield {
                type: LlmStreamChunkType.ToolCall,
                toolCall: { id: "call-1", name: "test_tool", arguments: "{}" },
              };
              yield {
                type: LlmStreamChunkType.Done,
                usage: [
                  {
                    input: 10,
                    output: 10,
                    reasoning: 0,
                    total: 20,
                    provider: "mock",
                    model: "mock-model",
                  },
                ],
              };
            } else {
              yield { type: LlmStreamChunkType.Text, content: "Done" };
              yield {
                type: LlmStreamChunkType.Done,
                usage: [
                  {
                    input: 10,
                    output: 10,
                    reasoning: 0,
                    total: 20,
                    provider: "mock",
                    model: "mock-model",
                  },
                ],
              };
            }
          },
        );

        const loop = new StreamLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        await collectChunks(
          loop.execute("Call tool", {
            tools: toolkit,
            turns: 3,
            hooks: {
              beforeEachTool: beforeToolHook,
            },
          }),
        );

        expect(beforeToolHook).toHaveBeenCalledWith(
          expect.objectContaining({
            toolName: "test_tool",
          }),
        );
      });

      it("calls afterEachTool hook after tool execution", async () => {
        const afterToolHook = vi.fn();
        const toolkit = new Toolkit([
          {
            name: "test_tool",
            description: "Test",
            parameters: { type: "object" },
            type: "function",
            call: vi.fn(() => "my result"),
          },
        ]);

        let callCount = 0;
        mockAdapter.executeStreamRequest = vi.fn(
          async function* (): AsyncIterable<LlmStreamChunk> {
            callCount++;
            if (callCount === 1) {
              yield {
                type: LlmStreamChunkType.ToolCall,
                toolCall: { id: "call-1", name: "test_tool", arguments: "{}" },
              };
              yield {
                type: LlmStreamChunkType.Done,
                usage: [
                  {
                    input: 10,
                    output: 10,
                    reasoning: 0,
                    total: 20,
                    provider: "mock",
                    model: "mock-model",
                  },
                ],
              };
            } else {
              yield { type: LlmStreamChunkType.Text, content: "Done" };
              yield {
                type: LlmStreamChunkType.Done,
                usage: [
                  {
                    input: 10,
                    output: 10,
                    reasoning: 0,
                    total: 20,
                    provider: "mock",
                    model: "mock-model",
                  },
                ],
              };
            }
          },
        );

        const loop = new StreamLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        await collectChunks(
          loop.execute("Call tool", {
            tools: toolkit,
            turns: 3,
            hooks: {
              afterEachTool: afterToolHook,
            },
          }),
        );

        expect(afterToolHook).toHaveBeenCalledWith(
          expect.objectContaining({
            toolName: "test_tool",
            result: "my result",
          }),
        );
      });

      it("calls onToolError hook when tool throws", async () => {
        const onToolErrorHook = vi.fn();
        const toolError = new Error("Tool failed!");
        const toolkit = new Toolkit([
          {
            name: "failing_tool",
            description: "Always fails",
            parameters: { type: "object" },
            type: "function",
            call: vi.fn(() => {
              throw toolError;
            }),
          },
        ]);

        let callCount = 0;
        mockAdapter.executeStreamRequest = vi.fn(
          async function* (): AsyncIterable<LlmStreamChunk> {
            callCount++;
            if (callCount === 1) {
              yield {
                type: LlmStreamChunkType.ToolCall,
                toolCall: {
                  id: "call-1",
                  name: "failing_tool",
                  arguments: "{}",
                },
              };
              yield {
                type: LlmStreamChunkType.Done,
                usage: [
                  {
                    input: 10,
                    output: 10,
                    reasoning: 0,
                    total: 20,
                    provider: "mock",
                    model: "mock-model",
                  },
                ],
              };
            } else {
              yield { type: LlmStreamChunkType.Text, content: "Done" };
              yield {
                type: LlmStreamChunkType.Done,
                usage: [
                  {
                    input: 10,
                    output: 10,
                    reasoning: 0,
                    total: 20,
                    provider: "mock",
                    model: "mock-model",
                  },
                ],
              };
            }
          },
        );

        const loop = new StreamLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        const chunks = await collectChunks(
          loop.execute("Call failing tool", {
            tools: toolkit,
            turns: 3,
            hooks: {
              onToolError: onToolErrorHook,
            },
          }),
        );

        expect(onToolErrorHook).toHaveBeenCalledWith(
          expect.objectContaining({
            toolName: "failing_tool",
            error: toolError,
          }),
        );

        // Should also yield an error chunk
        const errorChunks = chunks.filter(
          (c) => c.type === LlmStreamChunkType.Error,
        );
        expect(errorChunks).toHaveLength(1);
      });
    });

    describe("Error Handling", () => {
      it("yields error chunks for tool execution failures", async () => {
        const toolkit = new Toolkit([
          {
            name: "broken_tool",
            description: "Throws an error",
            parameters: { type: "object" },
            type: "function",
            call: vi.fn(() => {
              throw new Error("Something went wrong");
            }),
          },
        ]);

        let callCount = 0;
        mockAdapter.executeStreamRequest = vi.fn(
          async function* (): AsyncIterable<LlmStreamChunk> {
            callCount++;
            if (callCount === 1) {
              yield {
                type: LlmStreamChunkType.ToolCall,
                toolCall: {
                  id: "call-1",
                  name: "broken_tool",
                  arguments: "{}",
                },
              };
              yield {
                type: LlmStreamChunkType.Done,
                usage: [
                  {
                    input: 10,
                    output: 10,
                    reasoning: 0,
                    total: 20,
                    provider: "mock",
                    model: "mock-model",
                  },
                ],
              };
            } else {
              yield { type: LlmStreamChunkType.Text, content: "Recovered" };
              yield {
                type: LlmStreamChunkType.Done,
                usage: [
                  {
                    input: 10,
                    output: 10,
                    reasoning: 0,
                    total: 20,
                    provider: "mock",
                    model: "mock-model",
                  },
                ],
              };
            }
          },
        );

        const loop = new StreamLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        const chunks = await collectChunks(
          loop.execute("Use broken tool", { tools: toolkit, turns: 3 }),
        );

        const errorChunks = chunks.filter(
          (c) => c.type === LlmStreamChunkType.Error,
        );
        expect(errorChunks).toHaveLength(1);
        expect(errorChunks[0]).toMatchObject({
          type: LlmStreamChunkType.Error,
          error: {
            title: "Bad Function Call",
          },
        });
      });

      it("passes through error chunks from adapter", async () => {
        mockAdapter.executeStreamRequest = vi.fn(
          async function* (): AsyncIterable<LlmStreamChunk> {
            yield {
              type: LlmStreamChunkType.Error,
              error: {
                status: 500,
                title: "Provider Error",
                detail: "Something went wrong",
              },
            };
            yield {
              type: LlmStreamChunkType.Done,
              usage: [],
            };
          },
        );

        const loop = new StreamLoop({
          adapter: mockAdapter,
          client: mockClient,
        });

        const chunks = await collectChunks(loop.execute("Hello"));

        const errorChunks = chunks.filter(
          (c) => c.type === LlmStreamChunkType.Error,
        );
        expect(errorChunks).toHaveLength(1);
        expect(errorChunks[0]).toMatchObject({
          type: LlmStreamChunkType.Error,
          error: {
            status: 500,
            title: "Provider Error",
          },
        });
      });
    });
  });

  // Specific Scenarios
  describe("Specific Scenarios", () => {
    it("passes options to adapter buildRequest", async () => {
      const loop = new StreamLoop({
        adapter: mockAdapter,
        client: mockClient,
      });

      const options: LlmOperateOptions = {
        model: "test-model",
        system: "You are helpful",
        instructions: "Be concise",
      };

      await collectChunks(loop.execute("Hello", options));

      expect(mockAdapter.buildRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "test-model",
          system: "You are helpful",
          instructions: "Be concise",
        }),
      );
    });

    it("uses adapter default model when not specified", async () => {
      const loop = new StreamLoop({
        adapter: mockAdapter,
        client: mockClient,
      });

      await collectChunks(loop.execute("Hello"));

      expect(mockAdapter.buildRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "mock-model",
        }),
      );
    });

    it("formats tools through adapter", async () => {
      const toolkit = new Toolkit([
        {
          name: "my_tool",
          description: "My tool",
          parameters: { type: "object" },
          type: "function",
          call: vi.fn(),
        },
      ]);

      const loop = new StreamLoop({
        adapter: mockAdapter,
        client: mockClient,
      });

      await collectChunks(loop.execute("Hello", { tools: toolkit }));

      expect(mockAdapter.formatTools).toHaveBeenCalledWith(toolkit, undefined);
    });

    it("formats output schema through adapter", async () => {
      const loop = new StreamLoop({
        adapter: mockAdapter,
        client: mockClient,
      });

      const format = { name: String, age: Number };

      await collectChunks(loop.execute("Hello", { format }));

      expect(mockAdapter.formatOutputSchema).toHaveBeenCalledWith(format);
    });
  });

  // Retry Logic
  describe("Retry Logic", () => {
    it("retries on connection error before any chunks are yielded", async () => {
      let callCount = 0;
      mockAdapter.executeStreamRequest = vi.fn(
        async function* (): AsyncIterable<LlmStreamChunk> {
          callCount++;
          if (callCount === 1) {
            throw new Error("read ECONNRESET");
          }
          yield { type: LlmStreamChunkType.Text, content: "Success" };
          yield {
            type: LlmStreamChunkType.Done,
            usage: [
              {
                input: 10,
                output: 5,
                reasoning: 0,
                total: 15,
                provider: "mock",
                model: "mock-model",
              },
            ],
          };
        },
      );

      // Classify ECONNRESET as retryable
      mockAdapter.classifyError = vi.fn(() => ({
        error: new Error("read ECONNRESET"),
        category: ErrorCategory.Retryable,
        shouldRetry: true,
      }));

      const loop = new StreamLoop({
        adapter: mockAdapter,
        client: mockClient,
        retryPolicy: new RetryPolicy({ maxRetries: 3, initialDelayMs: 1 }),
      });

      const chunks = await collectChunks(loop.execute("Hello"));

      // Should have retried and succeeded
      expect(mockAdapter.executeStreamRequest).toHaveBeenCalledTimes(2);
      const textChunks = chunks.filter(
        (c) => c.type === LlmStreamChunkType.Text,
      );
      expect(textChunks).toHaveLength(1);
      expect(textChunks[0]).toMatchObject({ content: "Success" });
    });

    it("emits error chunk when stream fails after chunks were yielded", async () => {
      mockAdapter.executeStreamRequest = vi.fn(
        async function* (): AsyncIterable<LlmStreamChunk> {
          yield { type: LlmStreamChunkType.Text, content: "Partial" };
          throw new Error("connection lost mid-stream");
        },
      );

      mockAdapter.classifyError = vi.fn(() => ({
        error: new Error("connection lost mid-stream"),
        category: ErrorCategory.Retryable,
        shouldRetry: true,
      }));

      const loop = new StreamLoop({
        adapter: mockAdapter,
        client: mockClient,
        retryPolicy: new RetryPolicy({ maxRetries: 3, initialDelayMs: 1 }),
      });

      const chunks = await collectChunks(loop.execute("Hello"));

      // Should NOT have retried (chunks were already yielded)
      expect(mockAdapter.executeStreamRequest).toHaveBeenCalledTimes(1);

      // Should have the partial text + error + done chunks
      const textChunks = chunks.filter(
        (c) => c.type === LlmStreamChunkType.Text,
      );
      expect(textChunks).toHaveLength(1);

      const errorChunks = chunks.filter(
        (c) => c.type === LlmStreamChunkType.Error,
      );
      expect(errorChunks).toHaveLength(1);
      expect(errorChunks[0]).toMatchObject({
        type: LlmStreamChunkType.Error,
        error: { status: 502, title: "Stream Error" },
      });
    });

    it("throws BadGatewayError when retries are exhausted", async () => {
      mockAdapter.executeStreamRequest = vi.fn(
        // eslint-disable-next-line require-yield
        async function* (): AsyncIterable<LlmStreamChunk> {
          throw new Error("persistent failure");
        },
      );

      mockAdapter.classifyError = vi.fn(() => ({
        error: new Error("persistent failure"),
        category: ErrorCategory.Retryable,
        shouldRetry: true,
      }));

      const loop = new StreamLoop({
        adapter: mockAdapter,
        client: mockClient,
        retryPolicy: new RetryPolicy({ maxRetries: 2, initialDelayMs: 1 }),
      });

      await expect(collectChunks(loop.execute("Hello"))).rejects.toThrow(
        "Bad Gateway",
      );

      // Should have attempted 3 times (initial + 2 retries)
      expect(mockAdapter.executeStreamRequest).toHaveBeenCalledTimes(3);
    });

    it("does not retry non-retryable errors", async () => {
      mockAdapter.executeStreamRequest = vi.fn(
        // eslint-disable-next-line require-yield
        async function* (): AsyncIterable<LlmStreamChunk> {
          throw new Error("authentication failed");
        },
      );

      mockAdapter.classifyError = vi.fn(() => ({
        error: new Error("authentication failed"),
        category: ErrorCategory.Unrecoverable,
        shouldRetry: false,
      }));

      const loop = new StreamLoop({
        adapter: mockAdapter,
        client: mockClient,
        retryPolicy: new RetryPolicy({ maxRetries: 3, initialDelayMs: 1 }),
      });

      await expect(collectChunks(loop.execute("Hello"))).rejects.toThrow(
        "Bad Gateway",
      );

      // Should have only attempted once
      expect(mockAdapter.executeStreamRequest).toHaveBeenCalledTimes(1);
    });
  });
});
