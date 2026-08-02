import { beforeEach, describe, expect, it, vi } from "vitest";

import { OperateLoop, OperateLoopConfig } from "../OperateLoop.js";
import { StreamLoop, StreamLoopConfig } from "../StreamLoop.js";
import { BaseProviderAdapter } from "../adapters/index.js";
import { LlmAbortError } from "../../errors/LlmError.js";
import {
  LlmStreamChunk,
  LlmStreamChunkType,
} from "../../types/LlmStreamChunk.interface.js";
import { ErrorCategory, ParsedResponse } from "../types.js";

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

//
//
// Fixtures
//

const ABORT_STATUS = 499;

const MOCK_USAGE = {
  input: 10,
  model: "mock-model",
  output: 20,
  provider: "mock",
  reasoning: 0,
  total: 30,
};

/** Rejects as a provider request does when its AbortSignal fires. */
function whenAborted(signal?: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    const fail = () => reject(new Error("The operation was aborted"));
    if (signal?.aborted) {
      fail();
      return;
    }
    signal?.addEventListener("abort", fail);
  });
}

class MockAdapter extends BaseProviderAdapter {
  readonly name = "mock";
  readonly defaultModel = "mock-model";

  buildRequest = vi.fn((request) => request);
  formatTools = vi.fn(() => []);
  formatOutputSchema = vi.fn((schema) => schema);
  executeRequest = vi.fn(
    (
      _client: unknown,
      _request: unknown,
      _signal?: AbortSignal,
    ): Promise<unknown> =>
      Promise.resolve({ content: [{ text: "Hello!", type: "text" }] }),
  );
  executeStreamRequest = vi.fn(async function* (
    _client: unknown,
    _request: unknown,
    _signal?: AbortSignal,
  ): AsyncIterable<LlmStreamChunk> {
    yield { content: "Hello", type: LlmStreamChunkType.Text };
    yield { type: LlmStreamChunkType.Done, usage: [MOCK_USAGE] };
  });
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
    category: ErrorCategory.Retryable,
    error,
    shouldRetry: true,
  }));
  isComplete = vi.fn(() => true);
  isRetryableError = vi.fn(() => true);
}

function operateConfig(adapter: MockAdapter): OperateLoopConfig {
  return { adapter, client: {} };
}

function streamConfig(adapter: MockAdapter): StreamLoopConfig {
  return { adapter, client: {} };
}

async function collect(
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

describe("Caller AbortSignal (Issue #472)", () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new MockAdapter();
  });

  describe("operate()", () => {
    it("rejects with LlmAbortError when the signal is already aborted", async () => {
      // Arrange
      const controller = new AbortController();
      controller.abort();
      const loop = new OperateLoop(operateConfig(adapter));
      // Act
      const promise = loop.execute("Hello", { signal: controller.signal });
      // Assert
      await expect(promise).rejects.toThrow(LlmAbortError);
      expect(adapter.executeRequest).not.toHaveBeenCalled();
    });

    it("links the caller signal into the request signal", async () => {
      // Arrange
      let requestSignal: AbortSignal | undefined;
      adapter.executeRequest = vi.fn(
        (_client: unknown, _request: unknown, signal?: AbortSignal) => {
          requestSignal = signal;
          return Promise.resolve({ content: [{ text: "Hi", type: "text" }] });
        },
      );
      const controller = new AbortController();
      const loop = new OperateLoop(operateConfig(adapter));
      // Act
      await loop.execute("Hello", { signal: controller.signal });
      controller.abort();
      // Assert
      expect(requestSignal?.aborted).toBe(true);
    });

    it("rejects with LlmAbortError and does not retry an aborted request", async () => {
      // Arrange
      const controller = new AbortController();
      adapter.executeRequest = vi.fn(
        (_client: unknown, _request: unknown, signal?: AbortSignal) => {
          controller.abort("client disconnected");
          return whenAborted(signal);
        },
      );
      const loop = new OperateLoop(operateConfig(adapter));
      // Act
      const promise = loop.execute("Hello", { signal: controller.signal });
      // Assert
      const error = (await promise.catch((thrown) => thrown)) as LlmAbortError;
      expect(error).toBeInstanceOf(LlmAbortError);
      expect(error.status).toBe(ABORT_STATUS);
      expect(error.message).toContain("client disconnected");
      expect(adapter.executeRequest).toHaveBeenCalledOnce();
    });

    it("settles the exchange when the caller aborts", async () => {
      // Arrange
      const controller = new AbortController();
      controller.abort();
      const onExchange = vi.fn();
      const loop = new OperateLoop(operateConfig(adapter));
      // Act
      const thrown = await loop
        .execute("Hello", { onExchange, signal: controller.signal })
        .catch((error) => error);
      // Assert — the loop attaches the envelope for the facade to emit
      expect(thrown.exchange).toBeDefined();
      expect(thrown.exchange.response.error.status).toBe(ABORT_STATUS);
    });
  });

  describe("stream()", () => {
    it("yields an abort error chunk when the signal is already aborted", async () => {
      // Arrange
      const controller = new AbortController();
      controller.abort();
      const loop = new StreamLoop(streamConfig(adapter));
      // Act
      const chunks = await collect(
        loop.execute("Hello", { signal: controller.signal }),
      );
      // Assert
      expect(adapter.executeStreamRequest).not.toHaveBeenCalled();
      expect(chunks[0]).toMatchObject({
        error: { status: ABORT_STATUS },
        type: LlmStreamChunkType.Error,
      });
      expect(chunks.at(-1)?.type).toBe(LlmStreamChunkType.Done);
    });

    it("links the caller signal into the stream request signal", async () => {
      // Arrange
      let requestSignal: AbortSignal | undefined;
      adapter.executeStreamRequest = vi.fn(async function* (
        _client: unknown,
        _request: unknown,
        signal?: AbortSignal,
      ): AsyncIterable<LlmStreamChunk> {
        requestSignal = signal;
        yield { content: "Hello", type: LlmStreamChunkType.Text };
        yield { type: LlmStreamChunkType.Done, usage: [MOCK_USAGE] };
      });
      const controller = new AbortController();
      const loop = new StreamLoop(streamConfig(adapter));
      // Act
      await collect(loop.execute("Hello", { signal: controller.signal }));
      controller.abort();
      // Assert
      expect(requestSignal?.aborted).toBe(true);
    });

    it("stops without retrying when the caller aborts mid-stream", async () => {
      // Arrange
      const controller = new AbortController();
      adapter.executeStreamRequest = vi.fn(async function* (
        _client: unknown,
        _request: unknown,
        signal?: AbortSignal,
      ): AsyncIterable<LlmStreamChunk> {
        yield { content: "Hel", type: LlmStreamChunkType.Text };
        controller.abort("client disconnected");
        await whenAborted(signal);
      });
      const loop = new StreamLoop(streamConfig(adapter));
      // Act
      const chunks = await collect(
        loop.execute("Hello", { signal: controller.signal }),
      );
      // Assert
      expect(adapter.executeStreamRequest).toHaveBeenCalledOnce();
      const errorChunk = chunks.find(
        (chunk) => chunk.type === LlmStreamChunkType.Error,
      );
      expect(errorChunk).toMatchObject({
        error: { status: ABORT_STATUS },
      });
      expect(chunks.at(-1)?.type).toBe(LlmStreamChunkType.Done);
    });

    it("aborts the provider request when the consumer stops reading", async () => {
      // Arrange
      let requestSignal: AbortSignal | undefined;
      adapter.executeStreamRequest = vi.fn(async function* (
        _client: unknown,
        _request: unknown,
        signal?: AbortSignal,
      ): AsyncIterable<LlmStreamChunk> {
        requestSignal = signal;
        yield { content: "Hello", type: LlmStreamChunkType.Text };
        yield { content: " world", type: LlmStreamChunkType.Text };
        yield { type: LlmStreamChunkType.Done, usage: [MOCK_USAGE] };
      });
      const loop = new StreamLoop(streamConfig(adapter));
      // Act
      for await (const chunk of loop.execute("Hello")) {
        if (chunk.type === LlmStreamChunkType.Text) {
          break;
        }
      }
      // Assert
      expect(requestSignal?.aborted).toBe(true);
    });

    it("settles an incomplete exchange when the caller aborts", async () => {
      // Arrange
      const controller = new AbortController();
      controller.abort();
      const onExchange = vi.fn();
      const loop = new StreamLoop(streamConfig(adapter));
      // Act
      await collect(
        loop.execute("Hello", { onExchange, signal: controller.signal }),
      );
      // Assert
      expect(onExchange).toHaveBeenCalledOnce();
      const envelope = onExchange.mock.calls[0][0];
      expect(envelope.response.error.status).toBe(ABORT_STATUS);
    });
  });
});
