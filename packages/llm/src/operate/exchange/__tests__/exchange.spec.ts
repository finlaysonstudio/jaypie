import { beforeEach, describe, expect, it, vi } from "vitest";

import { OperateLoop, OperateLoopConfig } from "../../OperateLoop.js";
import { BaseProviderAdapter } from "../../adapters/index.js";
import {
  LlmExchangeEnvelope,
  LlmResponseStatus,
} from "../../../types/LlmProvider.interface.js";
import {
  ErrorCategory,
  ParsedResponse,
  StandardToolCall,
} from "../../types.js";
import { emitExchange, isExchangeStoreEnabled } from "../emitExchange.js";

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

class MockAdapter extends BaseProviderAdapter {
  readonly name = "mock";
  readonly defaultModel = "mock-model";

  buildRequest = vi.fn((request) => request);
  formatTools = vi.fn(() => []);
  formatOutputSchema = vi.fn((schema) => schema);
  executeRequest = vi.fn(() =>
    Promise.resolve({
      content: [{ type: "text", text: "Hello!" }],
      id: "resp_123",
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
  formatToolResult = vi.fn(() => ({}));
  appendToolResult = vi.fn((request) => request);
  responseToHistoryItems = vi.fn(() => []);
  classifyError = vi.fn(() => ({
    error: new Error("Test"),
    category: ErrorCategory.Unrecoverable,
    shouldRetry: false,
  }));
  isComplete = vi.fn(() => true);
}

function createConfig(): OperateLoopConfig {
  return {
    adapter: new MockAdapter(),
    client: {},
  };
}

//
//
// Tests
//

describe("Exchange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LLM_EXCHANGE_ENABLED;
  });

  describe("Base Cases", () => {
    it("emitExchange is a function", () => {
      expect(typeof emitExchange).toBe("function");
    });
    it("isExchangeStoreEnabled defaults false", () => {
      expect(isExchangeStoreEnabled()).toBe(false);
    });
  });

  describe("Features", () => {
    it("attaches an envelope to the response when onExchange is passed", async () => {
      const loop = new OperateLoop(createConfig());
      const response = await loop.execute("Hello", {
        data: { user: "Taylor" },
        model: "mock-model",
        onExchange: vi.fn(),
        temperature: 0.5,
        user: "user-1",
      });
      const envelope = response.exchange;
      expect(envelope).toBeDefined();
      expect(envelope!.request.input).toBe("Hello");
      expect(envelope!.request.data).toEqual({ user: "Taylor" });
      expect(envelope!.request.model).toBe("mock-model");
      expect(envelope!.request.temperature).toBe(0.5);
      expect(envelope!.request.user).toBe("user-1");
      expect(envelope!.response.status).toBe(LlmResponseStatus.Completed);
      expect(envelope!.response.stopReason).toBe("end_turn");
      expect(envelope!.response.usage).toHaveLength(1);
      expect(envelope!.response.usageTotals).toEqual({
        "mock:mock-model": {
          input: 10,
          model: "mock-model",
          output: 20,
          provider: "mock",
          reasoning: 0,
          total: 30,
        },
      });
      expect(envelope!.ids).toEqual(["resp_123"]);
      expect(envelope!.timing.startedAt).toBeDefined();
      expect(envelope!.timing.duration).toBeGreaterThanOrEqual(0);
    });

    it("does not attach an envelope when not requested", async () => {
      const loop = new OperateLoop(createConfig());
      const response = await loop.execute("Hello", { model: "mock-model" });
      expect(response.exchange).toBeUndefined();
    });

    it("attaches an envelope when LLM_EXCHANGE_ENABLED is set", async () => {
      process.env.LLM_EXCHANGE_ENABLED = "1";
      const loop = new OperateLoop(createConfig());
      const response = await loop.execute("Hello", { model: "mock-model" });
      expect(response.exchange).toBeDefined();
    });

    it("envelope survives JSON round-trip with no functions", async () => {
      const loop = new OperateLoop(createConfig());
      const response = await loop.execute("Hello", {
        model: "mock-model",
        onExchange: vi.fn(),
      });
      const serialized = JSON.parse(JSON.stringify(response.exchange));
      expect(serialized.request.input).toBe("Hello");
      const hasFunction = (value: unknown): boolean => {
        if (typeof value === "function") return true;
        if (value && typeof value === "object") {
          return Object.values(value).some(hasFunction);
        }
        return false;
      };
      expect(hasFunction(response.exchange)).toBe(false);
    });

    it("attaches an envelope to a hard error", async () => {
      const config = createConfig();
      (config.adapter as MockAdapter).executeRequest = vi.fn(() =>
        Promise.reject(new Error("Boom")),
      );
      const loop = new OperateLoop(config);
      let thrown: unknown;
      try {
        await loop.execute("Hello", {
          model: "mock-model",
          onExchange: vi.fn(),
        });
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeDefined();
      const envelope = (thrown as { exchange?: LlmExchangeEnvelope }).exchange;
      expect(envelope).toBeDefined();
      expect(envelope!.response.status).toBe(LlmResponseStatus.Incomplete);
      expect(envelope!.response.error).toBeDefined();
    });
  });

  describe("Specific Scenarios", () => {
    it("emitExchange swallows callback errors", async () => {
      const envelope = {} as LlmExchangeEnvelope;
      const onExchange = vi.fn(() => {
        throw new Error("Callback boom");
      });
      await expect(
        emitExchange({ envelope, onExchange }),
      ).resolves.toBeUndefined();
      expect(onExchange).toHaveBeenCalledOnce();
    });

    it("isExchangeStoreEnabled honors truthy-except-false/0", () => {
      process.env.LLM_EXCHANGE_ENABLED = "true";
      expect(isExchangeStoreEnabled()).toBe(true);
      process.env.LLM_EXCHANGE_ENABLED = "false";
      expect(isExchangeStoreEnabled()).toBe(false);
      process.env.LLM_EXCHANGE_ENABLED = "0";
      expect(isExchangeStoreEnabled()).toBe(false);
    });
  });
});
