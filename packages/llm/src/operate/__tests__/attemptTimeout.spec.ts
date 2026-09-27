import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OperateLoop, OperateLoopConfig } from "../OperateLoop.js";
import { StreamLoop, StreamLoopConfig } from "../StreamLoop.js";
import { BaseProviderAdapter } from "../adapters/index.js";
import { LlmTimeoutError, LlmTransientError } from "../../errors/LlmError.js";
import {
  LlmStreamChunk,
  LlmStreamChunkType,
} from "../../types/LlmStreamChunk.interface.js";
import { resolveAttemptTimeout } from "../../util/attemptTimeout.js";
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

vi.mock("../../util/abortableSleep.js", () => ({
  abortableSleep: vi.fn(() => Promise.resolve()),
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
const TIMEOUT_MS = 1000;

/**
 * A request that never answers. Like the real adapters, it swallows the
 * abort error and resolves empty once its signal fires.
 */
function hangUntilAborted(signal?: AbortSignal): Promise<undefined> {
  return new Promise((resolve) => {
    signal?.addEventListener("abort", () => resolve(undefined));
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
  // A real classifier does not recognize the timeout; the loops must not ask
  classifyError = vi.fn((error: unknown) => ({
    category: ErrorCategory.Unrecoverable,
    error,
    shouldRetry: false,
  }));
  isComplete = vi.fn(() => true);
  isRetryableError = vi.fn(() => false);
}

function operateConfig(adapter: MockAdapter): OperateLoopConfig {
  return { adapter, client: {} };
}

function streamConfig(adapter: MockAdapter): StreamLoopConfig {
  return { adapter, client: {} };
}

//
//
// Tests
//

describe("Attempt timeout (Issue #595)", () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("resolveAttemptTimeout", () => {
    it("applies no deadline when unset, false, zero, or not finite", () => {
      expect(resolveAttemptTimeout()).toBeUndefined();
      expect(resolveAttemptTimeout(false)).toBeUndefined();
      expect(resolveAttemptTimeout(0)).toBeUndefined();
      expect(resolveAttemptTimeout(Infinity)).toBeUndefined();
    });

    it("passes a positive deadline through", () => {
      expect(resolveAttemptTimeout(TIMEOUT_MS)).toBe(TIMEOUT_MS);
    });
  });

  describe("operate()", () => {
    it("rejects a stalled attempt with LlmTimeoutError and aborts it", async () => {
      let requestSignal: AbortSignal | undefined;
      adapter.executeRequest = vi.fn(
        (_client: unknown, _request: unknown, signal?: AbortSignal) => {
          requestSignal = signal;
          return hangUntilAborted(signal);
        },
      );
      const loop = new OperateLoop(operateConfig(adapter));

      const promise = loop.execute("Hello", {
        retry: { transient: false },
        timeout: TIMEOUT_MS,
      });
      const settled = promise.catch((thrown) => thrown);
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
      const error = await settled;

      expect(error).toBeInstanceOf(LlmTimeoutError);
      expect(error).toBeInstanceOf(LlmTransientError);
      expect(error.timeoutMs).toBe(TIMEOUT_MS);
      expect(requestSignal?.aborted).toBe(true);
      expect(adapter.parseResponse).not.toHaveBeenCalled();
    });

    it("retries a timed-out attempt on the transient budget", async () => {
      adapter.executeRequest = vi
        .fn()
        .mockImplementationOnce(
          (_client: unknown, _request: unknown, signal?: AbortSignal) =>
            hangUntilAborted(signal),
        )
        .mockResolvedValueOnce({ content: [{ text: "Hi", type: "text" }] });
      const loop = new OperateLoop(operateConfig(adapter));

      const promise = loop.execute("Hello", { timeout: TIMEOUT_MS });
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
      const response = await promise;

      expect(response.content).toBe("Hello!");
      expect(adapter.executeRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe("stream()", () => {
    it("retries a stream that stalls before its first chunk", async () => {
      adapter.executeStreamRequest = vi
        .fn()
        .mockImplementationOnce(async function* (
          _client: unknown,
          _request: unknown,
          signal?: AbortSignal,
        ): AsyncIterable<LlmStreamChunk> {
          await hangUntilAborted(signal);
          yield* [];
        })
        .mockImplementationOnce(
          async function* (): AsyncIterable<LlmStreamChunk> {
            yield { content: "Hello", type: LlmStreamChunkType.Text };
            yield { type: LlmStreamChunkType.Done, usage: [MOCK_USAGE] };
          },
        );
      const loop = new StreamLoop(streamConfig(adapter));

      const chunks: LlmStreamChunk[] = [];
      const done = (async () => {
        for await (const chunk of loop.execute("Hello", {
          timeout: TIMEOUT_MS,
        })) {
          chunks.push(chunk);
        }
      })();
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
      await done;

      expect(adapter.executeStreamRequest).toHaveBeenCalledTimes(2);
      expect(chunks).toContainEqual({
        content: "Hello",
        type: LlmStreamChunkType.Text,
      });
    });

    it("does not count time the consumer holds a chunk", async () => {
      const loop = new StreamLoop(streamConfig(adapter));

      const chunks: LlmStreamChunk[] = [];
      const done = (async () => {
        for await (const chunk of loop.execute("Hello", {
          timeout: TIMEOUT_MS,
        })) {
          chunks.push(chunk);
          await new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS * 3));
        }
      })();
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS * 20);
      await done;

      expect(adapter.executeStreamRequest).toHaveBeenCalledTimes(1);
      expect(
        chunks.some((chunk) => chunk.type === LlmStreamChunkType.Error),
      ).toBe(false);
    });

    it("yields an error chunk when the stream stalls after partial data", async () => {
      adapter.executeStreamRequest = vi.fn(async function* (
        _client: unknown,
        _request: unknown,
        signal?: AbortSignal,
      ): AsyncIterable<LlmStreamChunk> {
        yield { content: "Hel", type: LlmStreamChunkType.Text };
        await hangUntilAborted(signal);
      });
      const loop = new StreamLoop(streamConfig(adapter));

      const chunks: LlmStreamChunk[] = [];
      const done = (async () => {
        for await (const chunk of loop.execute("Hello", {
          timeout: TIMEOUT_MS,
        })) {
          chunks.push(chunk);
        }
      })();
      await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
      await done;

      expect(adapter.executeStreamRequest).toHaveBeenCalledTimes(1);
      const errorChunk = chunks.find(
        (chunk) => chunk.type === LlmStreamChunkType.Error,
      );
      expect(errorChunk).toMatchObject({
        error: { detail: expect.stringContaining("timed out") },
      });
    });
  });
});
