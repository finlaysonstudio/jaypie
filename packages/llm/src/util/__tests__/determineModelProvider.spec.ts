import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT, PROVIDER } from "../../constants";
import { determineModelProvider } from "../determineModelProvider";

describe("determineModelProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Base Cases", () => {
    it("Function exists", () => {
      expect(determineModelProvider).toBeDefined();
      expect(typeof determineModelProvider).toBe("function");
    });

    it("Returns an object with model and provider properties", () => {
      const result = determineModelProvider("gpt-5");
      expect(result).toHaveProperty("model");
      expect(result).toHaveProperty("provider");
      expect(typeof result.model).toBe("string");
      expect(typeof result.provider).toBe("string");
    });
  });

  describe("Error Conditions", () => {
    it("Returns default provider and model when input is undefined", () => {
      const result = determineModelProvider(undefined);
      expect(result).toEqual({
        model: DEFAULT.PROVIDER.MODEL.DEFAULT,
        provider: DEFAULT.PROVIDER.NAME,
      });
    });

    it("Returns default provider and model when input is empty string", () => {
      const result = determineModelProvider("");
      expect(result).toEqual({
        model: DEFAULT.PROVIDER.MODEL.DEFAULT,
        provider: DEFAULT.PROVIDER.NAME,
      });
    });

    it("Returns model without provider for unrecognized model", () => {
      const result = determineModelProvider("unknown-model");
      expect(result).toEqual({
        model: "unknown-model",
      });
    });
  });

  describe("Security", () => {
    it("Handles malicious input safely", () => {
      // Note: This input contains "/" so it's detected as OpenRouter
      const maliciousInput = "<script>alert('xss')</script>";
      const result = determineModelProvider(maliciousInput);
      expect(result).toEqual({
        model: maliciousInput,
        provider: PROVIDER.OPENROUTER.NAME,
      });
    });

    it("Handles malicious input without slash", () => {
      const maliciousInput = "DROP TABLE users; --";
      const result = determineModelProvider(maliciousInput);
      expect(result).toEqual({
        model: maliciousInput,
      });
    });
  });

  describe("Observability", () => {
    it("Does not modify the input string", () => {
      const input = "gpt-5";
      const originalInput = input;
      determineModelProvider(input);
      expect(input).toBe(originalInput);
    });
  });

  describe("Happy Paths", () => {
    it("Identifies OpenAI DEFAULT model", () => {
      const result = determineModelProvider(PROVIDER.OPENAI.MODEL.DEFAULT);
      expect(result).toEqual({
        model: PROVIDER.OPENAI.MODEL.DEFAULT,
        provider: PROVIDER.OPENAI.NAME,
      });
    });

    it("Identifies OpenAI SMALL model", () => {
      const result = determineModelProvider(PROVIDER.OPENAI.MODEL.SMALL);
      expect(result).toEqual({
        model: PROVIDER.OPENAI.MODEL.SMALL,
        provider: PROVIDER.OPENAI.NAME,
      });
    });

    it("Identifies Anthropic LARGE model", () => {
      const result = determineModelProvider(PROVIDER.ANTHROPIC.MODEL.LARGE);
      expect(result).toEqual({
        model: PROVIDER.ANTHROPIC.MODEL.LARGE,
        provider: PROVIDER.ANTHROPIC.NAME,
      });
    });

    it("Identifies Anthropic DEFAULT model", () => {
      const result = determineModelProvider(PROVIDER.ANTHROPIC.MODEL.DEFAULT);
      expect(result).toEqual({
        model: PROVIDER.ANTHROPIC.MODEL.DEFAULT,
        provider: PROVIDER.ANTHROPIC.NAME,
      });
    });

    it("Identifies Anthropic TINY model", () => {
      const result = determineModelProvider(PROVIDER.ANTHROPIC.MODEL.TINY);
      expect(result).toEqual({
        model: PROVIDER.ANTHROPIC.MODEL.TINY,
        provider: PROVIDER.ANTHROPIC.NAME,
      });
    });
  });

  describe("Features", () => {
    it("Correctly identifies all OpenAI models", () => {
      const openAIModels = Object.values(PROVIDER.OPENAI.MODEL);
      openAIModels.forEach((model) => {
        const result = determineModelProvider(model);
        expect(result.provider).toBe(PROVIDER.OPENAI.NAME);
        expect(result.model).toBe(model);
      });
    });

    it("Correctly identifies all Anthropic models", () => {
      const anthropicModels = Object.values(PROVIDER.ANTHROPIC.MODEL);
      anthropicModels.forEach((model) => {
        const result = determineModelProvider(model);
        expect(result.provider).toBe(PROVIDER.ANTHROPIC.NAME);
        expect(result.model).toBe(model);
      });
    });
  });

  describe("Specific Scenarios", () => {
    it("Returns default model when provider name 'anthropic' is passed", () => {
      const result = determineModelProvider(PROVIDER.ANTHROPIC.NAME);
      expect(result).toEqual({
        model: PROVIDER.ANTHROPIC.MODEL.DEFAULT,
        provider: PROVIDER.ANTHROPIC.NAME,
      });
    });

    it("Returns default model when provider name 'openai' is passed", () => {
      const result = determineModelProvider(PROVIDER.OPENAI.NAME);
      expect(result).toEqual({
        model: PROVIDER.OPENAI.MODEL.DEFAULT,
        provider: PROVIDER.OPENAI.NAME,
      });
    });

    it("Handles OpenAI O1 model", () => {
      const result = determineModelProvider("o1");
      expect(result).toEqual({
        model: "o1",
        provider: PROVIDER.OPENAI.NAME,
      });
    });

    it("Handles OpenAI O3 model", () => {
      const result = determineModelProvider("o3");
      expect(result).toEqual({
        model: "o3",
        provider: PROVIDER.OPENAI.NAME,
      });
    });

    it("Handles Anthropic TINY model", () => {
      const result = determineModelProvider(PROVIDER.ANTHROPIC.MODEL.TINY);
      expect(result).toEqual({
        model: PROVIDER.ANTHROPIC.MODEL.TINY,
        provider: PROVIDER.ANTHROPIC.NAME,
      });
    });

    describe("MODEL_MATCH_WORDS", () => {
      it("Identifies Anthropic provider when input contains 'claude'", () => {
        const result = determineModelProvider("claude-custom-model");
        expect(result).toEqual({
          model: "claude-custom-model",
          provider: PROVIDER.ANTHROPIC.NAME,
        });
      });

      it("Identifies Anthropic provider when input contains 'anthropic'", () => {
        const result = determineModelProvider("anthropic-test-model");
        expect(result).toEqual({
          model: "anthropic-test-model",
          provider: PROVIDER.ANTHROPIC.NAME,
        });
      });

      it("Identifies Anthropic provider when input contains 'haiku'", () => {
        const result = determineModelProvider("custom-haiku-v2");
        expect(result).toEqual({
          model: "custom-haiku-v2",
          provider: PROVIDER.ANTHROPIC.NAME,
        });
      });

      it("Identifies Anthropic provider when input contains 'opus'", () => {
        const result = determineModelProvider("opus-custom");
        expect(result).toEqual({
          model: "opus-custom",
          provider: PROVIDER.ANTHROPIC.NAME,
        });
      });

      it("Identifies Anthropic provider when input contains 'sonnet'", () => {
        const result = determineModelProvider("sonnet-v3-custom");
        expect(result).toEqual({
          model: "sonnet-v3-custom",
          provider: PROVIDER.ANTHROPIC.NAME,
        });
      });

      it("Identifies OpenAI provider when input contains 'openai'", () => {
        const result = determineModelProvider("openai-custom");
        expect(result).toEqual({
          model: "openai-custom",
          provider: PROVIDER.OPENAI.NAME,
        });
      });

      it("Identifies OpenAI provider when input contains 'gpt'", () => {
        const result = determineModelProvider("gpt-6-turbo");
        expect(result).toEqual({
          model: "gpt-6-turbo",
          provider: PROVIDER.OPENAI.NAME,
        });
      });

      it("Identifies OpenAI provider when input matches o# pattern", () => {
        const result = determineModelProvider("o2");
        expect(result).toEqual({
          model: "o2",
          provider: PROVIDER.OPENAI.NAME,
        });
      });

      it("Identifies OpenAI provider when input matches o# pattern with suffix", () => {
        const result = determineModelProvider("o5-mini");
        expect(result).toEqual({
          model: "o5-mini",
          provider: PROVIDER.OPENAI.NAME,
        });
      });

      it("Match words are case insensitive", () => {
        const result = determineModelProvider("CLAUDE-CUSTOM");
        expect(result).toEqual({
          model: "CLAUDE-CUSTOM",
          provider: PROVIDER.ANTHROPIC.NAME,
        });
      });

      it("Exact model match takes precedence over match words", () => {
        const result = determineModelProvider("gpt-5");
        expect(result).toEqual({
          model: "gpt-5",
          provider: PROVIDER.OPENAI.NAME,
        });
      });
    });

    describe("OpenRouter Detection", () => {
      it("Identifies OpenRouter when model contains /", () => {
        const result = determineModelProvider("openai/gpt-4");
        expect(result).toEqual({
          model: "openai/gpt-4",
          provider: PROVIDER.OPENROUTER.NAME,
        });
      });

      it("Identifies OpenRouter when model contains / with anthropic prefix", () => {
        const result = determineModelProvider("anthropic/claude-3-opus");
        expect(result).toEqual({
          model: "anthropic/claude-3-opus",
          provider: PROVIDER.OPENROUTER.NAME,
        });
      });

      it("Identifies OpenRouter when model contains / with custom org", () => {
        const result = determineModelProvider("mistralai/mistral-large");
        expect(result).toEqual({
          model: "mistralai/mistral-large",
          provider: PROVIDER.OPENROUTER.NAME,
        });
      });

      it("Handles openrouter: prefix and strips it", () => {
        const result = determineModelProvider(
          "openrouter:mistralai/mistral-large",
        );
        expect(result).toEqual({
          model: "mistralai/mistral-large",
          provider: PROVIDER.OPENROUTER.NAME,
        });
      });

      it("Handles openrouter: prefix with simple model name", () => {
        const result = determineModelProvider("openrouter:gpt-4");
        expect(result).toEqual({
          model: "gpt-4",
          provider: PROVIDER.OPENROUTER.NAME,
        });
      });

      it("openrouter: prefix takes precedence over other match words", () => {
        const result = determineModelProvider("openrouter:claude-opus-4-1");
        expect(result).toEqual({
          model: "claude-opus-4-1",
          provider: PROVIDER.OPENROUTER.NAME,
        });
      });

      it("Handles openrouter: prefix with empty model", () => {
        const result = determineModelProvider("openrouter:");
        expect(result).toEqual({
          model: "",
          provider: PROVIDER.OPENROUTER.NAME,
        });
      });
    });
  });
});
