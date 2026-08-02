import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfigurationError } from "@jaypie/errors";

import {
  _resetExchangeStore,
  _setExchangeStore,
  persistExchange,
  useExchangeStore,
} from "../exchangeStore.js";
import Llm from "../../Llm.js";
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

  describe("useExchangeStore", () => {
    describe("Base Cases", () => {
      it("is a function", () => {
        expect(typeof useExchangeStore).toBe("function");
      });

      it("is exposed on the Llm facade", () => {
        expect(typeof Llm.useExchangeStore).toBe("function");
      });
    });

    describe("Error Conditions", () => {
      it("throws when the value carries no storeExchange", () => {
        expect(() =>
          useExchangeStore({} as unknown as { storeExchange: () => void }),
        ).toThrow(ConfigurationError);
      });
    });

    describe("Features", () => {
      it("persists through a registered module namespace", async () => {
        process.env.LLM_EXCHANGE_ENABLED = "true";
        const storeExchange = vi.fn(async () => undefined);
        useExchangeStore({ storeExchange });
        await persistExchange(envelope());
        expect(storeExchange).toHaveBeenCalledExactlyOnceWith(envelope());
      });

      it("persists through a registered storeExchange function", async () => {
        process.env.LLM_EXCHANGE_ENABLED = "true";
        const storeExchange = vi.fn(async () => undefined);
        useExchangeStore(storeExchange);
        await persistExchange(envelope());
        expect(storeExchange).toHaveBeenCalledOnce();
      });

      it("unwraps a namespace whose surface hangs off default", async () => {
        process.env.LLM_EXCHANGE_ENABLED = "true";
        const storeExchange = vi.fn(async () => undefined);
        useExchangeStore({ default: { storeExchange } });
        await persistExchange(envelope());
        expect(storeExchange).toHaveBeenCalledOnce();
      });

      it("honors the flag: a registered store is idle when unset", async () => {
        const storeExchange = vi.fn(async () => undefined);
        useExchangeStore({ storeExchange });
        await persistExchange(envelope());
        expect(storeExchange).not.toHaveBeenCalled();
      });

      it("swallows registered-store failures without throwing", async () => {
        process.env.LLM_EXCHANGE_ENABLED = "true";
        useExchangeStore(async () => {
          throw new Error("Dynamo down");
        });
        await expect(persistExchange(envelope())).resolves.toBeUndefined();
      });

      it("takes precedence over the dynamic import", async () => {
        process.env.LLM_EXCHANGE_ENABLED = "true";
        const registered = vi.fn(async () => undefined);
        useExchangeStore(registered);
        await persistExchange(envelope());
        // The optional peer is absent in unit tests, so a dynamic-import
        // resolution would leave the registered store uncalled
        expect(registered).toHaveBeenCalledOnce();
      });

      it("clears the registration with null", async () => {
        process.env.LLM_EXCHANGE_ENABLED = "true";
        const storeExchange = vi.fn(async () => undefined);
        useExchangeStore({ storeExchange });
        useExchangeStore(null);
        await persistExchange(envelope());
        expect(storeExchange).not.toHaveBeenCalled();
      });

      it("registers through the Llm facade", async () => {
        process.env.LLM_EXCHANGE_ENABLED = "true";
        const storeExchange = vi.fn(async () => undefined);
        Llm.useExchangeStore({ storeExchange });
        await persistExchange(envelope());
        expect(storeExchange).toHaveBeenCalledOnce();
      });
    });
  });
});
