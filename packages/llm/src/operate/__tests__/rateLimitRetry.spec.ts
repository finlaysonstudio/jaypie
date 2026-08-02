import { beforeEach, describe, expect, it, vi } from "vitest";

import { OperateLoop, OperateLoopConfig } from "../OperateLoop.js";
import { BaseProviderAdapter } from "../adapters/index.js";
import { LlmQuotaError, LlmRateLimitError } from "../../errors/LlmError.js";
import { RetryPolicy } from "../retry/RetryPolicy.js";
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

const MOCK_USAGE = {
  input: 10,
  model: "mock-model",
  output: 20,
  provider: "mock",
  reasoning: 0,
  total: 30,
};

// Waits are pinned to 1ms so the suite exercises the real sleep path without
// spending the provider's suggested minute
const FAST_POLICY = new RetryPolicy({ rateLimitMaxDelayMs: 1 });

class MockAdapter extends BaseProviderAdapter {
  readonly name = "mock";
  readonly defaultModel = "mock-model";

  category: ErrorCategory = ErrorCategory.RateLimit;
  failures = 1;
  calls = 0;

  buildRequest = vi.fn((request) => request);
  formatTools = vi.fn(() => []);
  formatOutputSchema = vi.fn((schema) => schema);
  executeRequest = vi.fn((): Promise<unknown> => {
    this.calls++;
    if (this.calls <= this.failures) {
      return Promise.reject(new Error("Rate limit exceeded"));
    }
    return Promise.resolve({ content: [{ text: "Hello!", type: "text" }] });
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
    category: this.category,
    error,
    shouldRetry: false,
    suggestedDelayMs: 60000,
  }));
  isComplete = vi.fn(() => true);
  // Adapters report a rate limit as non-retryable; the dedicated budget is
  // what grants the retry
  isRetryableError = vi.fn(() => false);
}

function operateConfig(
  adapter: MockAdapter,
  retryPolicy: RetryPolicy = FAST_POLICY,
): OperateLoopConfig {
  return { adapter, client: {}, retryPolicy };
}

//
//
// Tests
//

describe("Rate Limit Retry", () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new MockAdapter();
  });

  describe("Base Cases", () => {
    it("passes a request through untouched when nothing is rate limited", async () => {
      adapter.failures = 0;
      const loop = new OperateLoop(operateConfig(adapter));

      const response = await loop.execute("Hello");

      expect(response.content).toBe("Hello!");
      expect(adapter.executeRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe("Happy Paths", () => {
    it("waits and retries a rate-limited request by default", async () => {
      const loop = new OperateLoop(operateConfig(adapter));

      const response = await loop.execute("Hello");

      expect(response.content).toBe("Hello!");
      expect(adapter.executeRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe("Error Conditions", () => {
    it("throws LlmRateLimitError once the budget is exhausted", async () => {
      adapter.failures = Infinity;
      const loop = new OperateLoop(
        operateConfig(
          adapter,
          new RetryPolicy({ rateLimitMaxDelayMs: 1, rateLimitRetries: 2 }),
        ),
      );

      await expect(loop.execute("Hello")).rejects.toThrow(LlmRateLimitError);
      // Initial attempt + 2 rate limit retries
      expect(adapter.executeRequest).toHaveBeenCalledTimes(3);
    });

    it("never retries a quota error", async () => {
      adapter.category = ErrorCategory.Quota;
      adapter.failures = Infinity;
      const loop = new OperateLoop(operateConfig(adapter));

      await expect(loop.execute("Hello")).rejects.toThrow(LlmQuotaError);
      expect(adapter.executeRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe("Features", () => {
    it("restores terminal behavior with retry rateLimit false", async () => {
      adapter.failures = Infinity;
      const loop = new OperateLoop(operateConfig(adapter));

      await expect(
        loop.execute("Hello", { retry: { rateLimit: false } }),
      ).rejects.toThrow(LlmRateLimitError);
      expect(adapter.executeRequest).toHaveBeenCalledTimes(1);
    });

    it("tunes the budget from the retry option", async () => {
      adapter.failures = Infinity;
      const loop = new OperateLoop(operateConfig(adapter));

      await expect(
        loop.execute("Hello", {
          retry: { rateLimit: { maxDelayMs: 1, maxRetries: 3 } },
        }),
      ).rejects.toThrow(LlmRateLimitError);
      // Initial attempt + 3 rate limit retries
      expect(adapter.executeRequest).toHaveBeenCalledTimes(4);
    });

    it("does not spend the transient retry budget", async () => {
      adapter.failures = Infinity;
      const loop = new OperateLoop(
        operateConfig(
          adapter,
          new RetryPolicy({
            maxRetries: 1,
            rateLimitMaxDelayMs: 1,
            rateLimitRetries: 2,
          }),
        ),
      );

      await expect(loop.execute("Hello")).rejects.toThrow(LlmRateLimitError);
      expect(adapter.executeRequest).toHaveBeenCalledTimes(3);
    });
  });

  describe("Fallback Interaction", () => {
    // A configured fallback is a faster remedy than waiting, so the facade
    // tells every attempt with somewhere left to go not to sleep
    it("fails fast when the facade disables the wait", async () => {
      adapter.failures = Infinity;
      const loop = new OperateLoop(operateConfig(adapter));

      await expect(
        loop.execute("Hello", { retry: { rateLimit: false } }),
      ).rejects.toThrow(LlmRateLimitError);
      expect(adapter.executeRequest).toHaveBeenCalledTimes(1);
    });

    it("waits on the final attempt, which has nowhere left to go", async () => {
      const loop = new OperateLoop(operateConfig(adapter));

      const response = await loop.execute("Hello");

      expect(response.content).toBe("Hello!");
      expect(adapter.executeRequest).toHaveBeenCalledTimes(2);
    });
  });
});
