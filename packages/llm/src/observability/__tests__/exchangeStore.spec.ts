import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  _resetExchangeStore,
  _setExchangeStore,
  persistExchange,
} from "../exchangeStore.js";
import type { LlmExchangeEnvelope } from "../../types/LlmProvider.interface.js";

const envelope = () =>
  ({
    request: { input: "Hello", model: "mock-model" },
    response: { content: "Hi!", status: "completed" },
  }) as unknown as LlmExchangeEnvelope;

describe("exchangeStore", () => {
  beforeEach(() => {
    _resetExchangeStore();
    delete process.env.LLM_EXCHANGE_ENABLED;
  });

  afterEach(() => {
    _resetExchangeStore();
    delete process.env.LLM_EXCHANGE_ENABLED;
    vi.restoreAllMocks();
  });

  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof persistExchange).toBe("function");
    });

    it("resolves without throwing", async () => {
      await expect(persistExchange(envelope())).resolves.toBeUndefined();
    });
  });

  describe("Features", () => {
    it("does not call the store when the flag is unset", async () => {
      const storeExchange = vi.fn(async () => undefined);
      _setExchangeStore({ storeExchange });
      await persistExchange(envelope());
      expect(storeExchange).not.toHaveBeenCalled();
    });

    it("calls the injected store when enabled", async () => {
      process.env.LLM_EXCHANGE_ENABLED = "true";
      const storeExchange = vi.fn(async () => undefined);
      _setExchangeStore({ storeExchange });
      await persistExchange(envelope());
      expect(storeExchange).toHaveBeenCalledOnce();
    });

    it("swallows store failures without throwing", async () => {
      process.env.LLM_EXCHANGE_ENABLED = "true";
      const storeExchange = vi.fn(async () => {
        throw new Error("Dynamo down");
      });
      _setExchangeStore({ storeExchange });
      await expect(persistExchange(envelope())).resolves.toBeUndefined();
    });
  });
});
