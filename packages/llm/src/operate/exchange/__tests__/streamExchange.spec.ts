import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StreamLoop, StreamLoopConfig } from "../../StreamLoop.js";
import { BaseProviderAdapter } from "../../adapters/index.js";
import {
  LlmExchangeEnvelope,
  LlmMessageType,
  LlmResponseStatus,
} from "../../../types/LlmProvider.interface.js";
import {
  LlmStreamChunk,
  LlmStreamChunkType,
} from "../../../types/LlmStreamChunk.interface.js";
import { ErrorCategory, ParsedResponse } from "../../types.js";
import { Toolkit } from "../../../tools/Toolkit.class.js";
import { persistExchange } from "../../../observability/exchangeStore.js";

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

vi.mock("../../../observability/exchangeStore.js", () => ({
  persistExchange: vi.fn(),
}));

//
//
// Fixtures
//

const MOCK_USAGE = {
  input: 10,
  model: "mock-model",
  output: 20,
  provider: "mock",
  reasoning: 0,
  total: 30,
};

class MockStreamAdapter extends BaseProviderAdapter {
  readonly name = "mock";
  readonly defaultModel = "mock-model";

  buildRequest = vi.fn((request) => request);
  formatTools = vi.fn((toolkit) =>
    toolkit.tools.map((tool: { description: string; name: string }) => ({
      description: tool.description,
      name: tool.name,
      parameters: {},
    })),
  );
  formatOutputSchema = vi.fn((schema) => schema);
  executeRequest = vi.fn(() => Promise.resolve({}));
  executeStreamRequest = vi.fn(
    async function* (): AsyncIterable<LlmStreamChunk> {
      yield { content: "Hello", type: LlmStreamChunkType.Text };
      yield { content: " world!", type: LlmStreamChunkType.Text };
      yield { type: LlmStreamChunkType.Done, usage: [MOCK_USAGE] };
    },
  );
  parseResponse = vi.fn((response): ParsedResponse => ({
    content: "Hello!",
    hasToolCalls: false,
    raw: response,
    stopReason: "end_turn",
    usage: MOCK_USAGE,
  }));
  extractToolCalls = vi.fn(() => []);
  extractUsage = vi.fn(() => MOCK_USAGE);
  formatToolResult = vi.fn(() => ({}));
  appendToolResult = vi.fn((request) => request);
  responseToHistoryItems = vi.fn(() => []);
  classifyError = vi.fn((error: unknown) => ({
    category: ErrorCategory.Unrecoverable,
    error,
    shouldRetry: false,
  }));
  isComplete = vi.fn(() => true);
  isRetryableError = vi.fn(() => false);
}

function createConfig(adapter?: MockStreamAdapter): StreamLoopConfig {
  return {
    adapter: adapter ?? new MockStreamAdapter(),
    client: {},
  };
}

async function drain(iterable: AsyncIterable<LlmStreamChunk>): Promise<void> {
  for await (const _chunk of iterable) {
    // consume
  }
}

//
//
// Tests
//

describe("Stream Exchange Capture (Issue #471)", () => {
  const DEFAULT_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...process.env };
    delete process.env.LLM_EXCHANGE_ENABLED;
  });

  afterEach(() => {
    process.env = DEFAULT_ENV;
  });

  describe("Base Cases", () => {
    it("does not fire onExchange when none is passed", async () => {
      const loop = new StreamLoop(createConfig());
      await drain(loop.execute("Hello"));
      expect(persistExchange).not.toHaveBeenCalled();
    });
  });

  describe("Happy Paths", () => {
    it("fires onExchange once when the stream completes", async () => {
      // Arrange
      const onExchange = vi.fn();
      const loop = new StreamLoop(createConfig());
      // Act
      await drain(loop.execute("Hello", { onExchange }));
      // Assert
      expect(onExchange).toHaveBeenCalledOnce();
      const envelope = onExchange.mock.calls[0][0] as LlmExchangeEnvelope;
      expect(envelope.response.status).toBe(LlmResponseStatus.Completed);
      expect(envelope.request.input).toBe("Hello");
    });

    it("carries usage, resolution, and timing", async () => {
      // Arrange
      const onExchange = vi.fn();
      const loop = new StreamLoop(createConfig());
      // Act
      await drain(loop.execute("Hello", { model: "mock-model", onExchange }));
      // Assert
      const envelope = onExchange.mock.calls[0][0] as LlmExchangeEnvelope;
      expect(envelope.response.usage).toEqual([MOCK_USAGE]);
      expect(envelope.response.usageTotals).toEqual({
        "mock:mock-model": MOCK_USAGE,
      });
      expect(envelope.resolution).toEqual({
        fallbackAttempts: 1,
        fallbackUsed: false,
        model: "mock-model",
        provider: "mock",
        retries: 0,
      });
      expect(envelope.timing.duration).toBeNumber();
      expect(envelope.timing.startedAt).toBeString();
    });

    it("records the streamed text as content and history delta", async () => {
      // Arrange
      const onExchange = vi.fn();
      const loop = new StreamLoop(createConfig());
      // Act
      await drain(loop.execute("Hello", { onExchange }));
      // Assert
      const envelope = onExchange.mock.calls[0][0] as LlmExchangeEnvelope;
      expect(envelope.response.content).toBe("Hello world!");
      expect(envelope.response.historyDelta).toHaveLength(1);
      expect(envelope.response.historyDelta[0]).toMatchObject({
        content: "Hello world!",
      });
    });

    it("persists the envelope when LLM_EXCHANGE_ENABLED is set", async () => {
      // Arrange
      process.env.LLM_EXCHANGE_ENABLED = "true";
      const loop = new StreamLoop(createConfig());
      // Act
      await drain(loop.execute("Hello"));
      // Assert
      expect(persistExchange).toHaveBeenCalledOnce();
    });
  });

  describe("Features", () => {
    it("records tool calls and results in the history delta", async () => {
      // Arrange
      const adapter = new MockStreamAdapter();
      let turn = 0;
      adapter.executeStreamRequest = vi.fn(
        async function* (): AsyncIterable<LlmStreamChunk> {
          turn++;
          if (turn === 1) {
            yield {
              toolCall: {
                arguments: JSON.stringify({}),
                id: "call_1",
                name: "mock_tool",
              },
              type: LlmStreamChunkType.ToolCall,
            };
            yield { type: LlmStreamChunkType.Done, usage: [MOCK_USAGE] };
            return;
          }
          yield { content: "Done!", type: LlmStreamChunkType.Text };
          yield { type: LlmStreamChunkType.Done, usage: [MOCK_USAGE] };
        },
      );
      const toolkit = new Toolkit([
        {
          call: async () => "tool result",
          description: "A mock tool",
          name: "mock_tool",
          parameters: { properties: {}, type: "object" },
          type: "function",
        },
      ]);
      const onExchange = vi.fn();
      const loop = new StreamLoop(createConfig(adapter));
      // Act
      await drain(loop.execute("Hello", { onExchange, tools: toolkit }));
      // Assert
      const envelope = onExchange.mock.calls[0][0] as LlmExchangeEnvelope;
      const types = envelope.response.historyDelta.map(
        (item) => (item as { type?: string }).type,
      );
      expect(types).toEqual([
        LlmMessageType.FunctionCall,
        LlmMessageType.FunctionCallOutput,
        LlmMessageType.Message,
      ]);
      expect(envelope.request.tools).toEqual(["mock_tool"]);
      expect(envelope.response.content).toBe("Done!");
    });

    it("settles an incomplete envelope when the consumer stops reading", async () => {
      // Arrange
      const onExchange = vi.fn();
      const loop = new StreamLoop(createConfig());
      // Act
      for await (const chunk of loop.execute("Hello", { onExchange })) {
        if (chunk.type === LlmStreamChunkType.Text) {
          break;
        }
      }
      // Assert
      expect(onExchange).toHaveBeenCalledOnce();
      const envelope = onExchange.mock.calls[0][0] as LlmExchangeEnvelope;
      expect(envelope.response.status).toBe(LlmResponseStatus.Incomplete);
    });
  });

  describe("Error Conditions", () => {
    it("settles an envelope carrying the error when the stream throws", async () => {
      // Arrange
      const adapter = new MockStreamAdapter();
      adapter.executeStreamRequest = vi.fn(
        // eslint-disable-next-line require-yield
        async function* (): AsyncIterable<LlmStreamChunk> {
          throw new Error("provider exploded");
        },
      );
      const onExchange = vi.fn();
      const loop = new StreamLoop(createConfig(adapter));
      // Act
      await expect(
        drain(loop.execute("Hello", { onExchange })),
      ).rejects.toThrow();
      // Assert
      expect(onExchange).toHaveBeenCalledOnce();
      const envelope = onExchange.mock.calls[0][0] as LlmExchangeEnvelope;
      expect(envelope.response.status).toBe(LlmResponseStatus.Incomplete);
      expect(envelope.response.error?.detail).toBe("provider exploded");
    });

    it("does not interrupt the stream when onExchange throws", async () => {
      // Arrange
      const onExchange = vi.fn(() => {
        throw new Error("callback exploded");
      });
      const loop = new StreamLoop(createConfig());
      // Act
      const chunks: LlmStreamChunk[] = [];
      for await (const chunk of loop.execute("Hello", { onExchange })) {
        chunks.push(chunk);
      }
      // Assert
      expect(chunks.at(-1)?.type).toBe(LlmStreamChunkType.Done);
    });
  });
});
