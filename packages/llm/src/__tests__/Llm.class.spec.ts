import { afterEach, describe, expect, it, vi } from "vitest";

// Subject
import Llm from "../Llm.js";
import { DEFAULT, PROVIDER } from "../constants.js";

// Track mock calls for testing
let openAiOperateMock = vi.fn();
let anthropicOperateMock = vi.fn();
let geminiOperateMock = vi.fn();

// Mock OpenAiProvider
vi.mock("../providers/openai/index.js", () => ({
  OpenAiProvider: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue("Mocked OpenAI response"),
    operate: openAiOperateMock,
  })),
}));

vi.mock("../providers/anthropic/AnthropicProvider.class.js", () => ({
  AnthropicProvider: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue("Mocked Anthropic response"),
    operate: anthropicOperateMock,
  })),
}));

vi.mock("../providers/gemini/GeminiProvider.class.js", () => ({
  GeminiProvider: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue("Mocked Gemini response"),
    operate: geminiOperateMock,
  })),
}));

vi.mock("@jaypie/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@jaypie/logger")>();
  return {
    ...actual,
    default: {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      trace: vi.fn(),
      warn: vi.fn(),
    },
  };
});

afterEach(() => {
  vi.clearAllMocks();
  // Reset mocks to default success behavior
  openAiOperateMock.mockResolvedValue({
    content: "Mocked OpenAI operate response",
    provider: "openai",
  });
  anthropicOperateMock.mockResolvedValue({
    content: "Mocked Anthropic operate response",
    provider: "anthropic",
  });
  geminiOperateMock.mockResolvedValue({
    content: "Mocked Gemini operate response",
    provider: "google",
  });
});

describe("Llm Class", () => {
  it("Works", () => {
    expect(Llm).toBeFunction();
    expect(Llm).toBeClass();
    const llm = new Llm();
    expect(llm).toBeDefined();
    expect(llm).toBeInstanceOf(Llm);
  });

  it("Sets provider with default value", () => {
    const llm = new Llm();
    expect(llm["_provider"]).toBe(DEFAULT.PROVIDER.NAME);
  });

  it("Sets custom provider when provided", () => {
    const customProvider = PROVIDER.OPENAI.NAME;
    const llm = new Llm(customProvider);
    expect(llm["_provider"]).toBe(customProvider);
  });

  it("Sets custom provider when provided with Anthropic", () => {
    const customProvider = PROVIDER.ANTHROPIC.NAME;
    const llm = new Llm(customProvider);
    expect(llm["_provider"]).toBe(customProvider);
  });

  it("Determines provider from model when model is provided", () => {
    const llm = new Llm(undefined, { model: "gpt-4" });
    expect(llm["_provider"]).toBe(PROVIDER.OPENAI.NAME);
  });

  it("Determines provider from Anthropic model", () => {
    const llm = new Llm(undefined, { model: "claude-3-opus" });
    expect(llm["_provider"]).toBe(PROVIDER.ANTHROPIC.NAME);
  });

  it("Prefers determined provider over original when model is provided", () => {
    const llm = new Llm(PROVIDER.ANTHROPIC.NAME, { model: "gpt-4" });
    expect(llm["_provider"]).toBe(PROVIDER.OPENAI.NAME);
  });

  it("Falls back to original provider when model provider cannot be determined", () => {
    const llm = new Llm(PROVIDER.OPENAI.NAME, { model: "unknown-model" });
    expect(llm["_provider"]).toBe(PROVIDER.OPENAI.NAME);
  });

  it("Preserves model when model name is passed as first argument (#213)", () => {
    const llm = new Llm("gemini-3-flash-preview");
    expect(llm["_provider"]).toBe(PROVIDER.GEMINI.NAME);
    expect(llm["_options"].model).toBe("gemini-3-flash-preview");
  });

  it("Preserves non-default OpenAI model passed as first argument (#213)", () => {
    const llm = new Llm("gpt-5-mini");
    expect(llm["_provider"]).toBe(PROVIDER.OPENAI.NAME);
    expect(llm["_options"].model).toBe("gpt-5-mini");
  });

  it("Throws ConfigurationError for unsupported provider", () => {
    expect(() => {
      new Llm("unsupported-provider" as any);
    }).toThrowError("Unsupported provider: unsupported-provider");
  });

  describe("send", () => {
    it("has a send method", () => {
      const llm = new Llm();
      expect(llm.send).toBeFunction();
    });

    it("returns a response when using OpenAI provider", async () => {
      const llm = new Llm(PROVIDER.OPENAI.NAME);
      const message = "Hello, world!";
      const response = await llm.send(message);
      expect(response).toBeDefined();
      expect(typeof response).toBe("string");
    });

    it("returns a response when using Anthropic provider", async () => {
      const llm = new Llm(PROVIDER.ANTHROPIC.NAME);
      const message = "Hello, world!";
      const response = await llm.send(message);
      expect(response).toBeDefined();
      expect(typeof response).toBe("string");
    });
  });

  describe("static send", () => {
    it("has a static send method", () => {
      expect(Llm.send).toBeFunction();
    });

    it("uses default provider when no llm option provided", async () => {
      const message = "Hello, world!";
      const response = await Llm.send(message);
      expect(response).toBeDefined();
      expect(typeof response).toBe("string");
    });

    it("uses specified provider when llm option provided", async () => {
      const message = "Hello, world!";
      const response = await Llm.send(message, { llm: PROVIDER.OPENAI.NAME });
      expect(response).toBeDefined();
      expect(typeof response).toBe("string");
    });

    it("passes message options correctly", async () => {
      const message = "Hello, world!";
      const options = { temperature: 0.7, llm: PROVIDER.OPENAI.NAME };
      const response = await Llm.send(message, options);
      expect(response).toBeDefined();
      expect(typeof response).toBe("string");
    });
  });

  describe("static operate", () => {
    it("has a static operate method", () => {
      expect(Llm.operate).toBeFunction();
    });

    it("determines provider from model when no llm option provided", async () => {
      const input = "test input";
      const options = { model: "gpt-4" };

      const result = await Llm.operate(input, options);
      expect(result.content).toBe("Mocked OpenAI operate response");
    });

    it("uses explicitly provided llm over determined provider", async () => {
      const input = "test input";
      const options = { model: "gpt-4", llm: PROVIDER.ANTHROPIC.NAME };

      const result = await Llm.operate(input, options);
      expect(result.content).toBe("Mocked Anthropic operate response");
    });

    it("falls back to default when model provider cannot be determined", async () => {
      const input = "test input";
      const options = { model: "unknown-model" };

      const result = await Llm.operate(input, options);
      expect(result.content).toBe("Mocked OpenAI operate response");
    });
  });

  describe("fallback", () => {
    describe("no fallback configured", () => {
      it("behaves as before when no fallback is configured", async () => {
        const llm = new Llm(PROVIDER.OPENAI.NAME);
        const result = await llm.operate("test");

        expect(result.content).toBe("Mocked OpenAI operate response");
        expect(result.fallbackUsed).toBe(false);
        expect(result.fallbackAttempts).toBe(1);
        expect(result.provider).toBe("openai");
      });

      it("throws error when primary fails and no fallback configured", async () => {
        openAiOperateMock.mockRejectedValue(new Error("Primary failed"));

        const llm = new Llm(PROVIDER.OPENAI.NAME);
        await expect(llm.operate("test")).rejects.toThrow("Primary failed");
      });
    });

    describe("single fallback", () => {
      it("returns primary response when primary succeeds", async () => {
        const llm = new Llm(PROVIDER.OPENAI.NAME, {
          fallback: [{ provider: PROVIDER.ANTHROPIC.NAME }],
        });

        const result = await llm.operate("test");

        expect(result.content).toBe("Mocked OpenAI operate response");
        expect(result.fallbackUsed).toBe(false);
        expect(result.fallbackAttempts).toBe(1);
        expect(result.provider).toBe("openai");
        expect(anthropicOperateMock).not.toHaveBeenCalled();
      });

      it("returns fallback response when primary fails", async () => {
        openAiOperateMock.mockRejectedValue(new Error("Primary failed"));

        const llm = new Llm(PROVIDER.OPENAI.NAME, {
          fallback: [{ provider: PROVIDER.ANTHROPIC.NAME }],
        });

        const result = await llm.operate("test");

        expect(result.content).toBe("Mocked Anthropic operate response");
        expect(result.fallbackUsed).toBe(true);
        expect(result.fallbackAttempts).toBe(2);
        expect(result.provider).toBe("anthropic");
      });

      it("uses fallback model when specified", async () => {
        openAiOperateMock.mockRejectedValue(new Error("Primary failed"));

        const llm = new Llm(PROVIDER.OPENAI.NAME, {
          fallback: [
            { provider: PROVIDER.ANTHROPIC.NAME, model: "claude-3-opus" },
          ],
        });

        const result = await llm.operate("test");

        expect(result.fallbackUsed).toBe(true);
        expect(result.provider).toBe("anthropic");
      });
    });

    describe("chain of fallbacks", () => {
      it("tries each provider in order until success", async () => {
        openAiOperateMock.mockRejectedValue(new Error("OpenAI failed"));
        anthropicOperateMock.mockRejectedValue(new Error("Anthropic failed"));

        const llm = new Llm(PROVIDER.OPENAI.NAME, {
          fallback: [
            { provider: PROVIDER.ANTHROPIC.NAME },
            { provider: PROVIDER.GEMINI.NAME },
          ],
        });

        const result = await llm.operate("test");

        expect(result.content).toBe("Mocked Gemini operate response");
        expect(result.fallbackUsed).toBe(true);
        expect(result.fallbackAttempts).toBe(3);
        expect(result.provider).toBe("google");
      });

      it("throws last error when all providers fail", async () => {
        openAiOperateMock.mockRejectedValue(new Error("OpenAI failed"));
        anthropicOperateMock.mockRejectedValue(new Error("Anthropic failed"));
        geminiOperateMock.mockRejectedValue(new Error("Gemini failed"));

        const llm = new Llm(PROVIDER.OPENAI.NAME, {
          fallback: [
            { provider: PROVIDER.ANTHROPIC.NAME },
            { provider: PROVIDER.GEMINI.NAME },
          ],
        });

        await expect(llm.operate("test")).rejects.toThrow("Gemini failed");
      });
    });

    describe("per-call override", () => {
      it("overrides instance config with per-call fallback", async () => {
        openAiOperateMock.mockRejectedValue(new Error("Primary failed"));

        const llm = new Llm(PROVIDER.OPENAI.NAME, {
          fallback: [{ provider: PROVIDER.ANTHROPIC.NAME }],
        });

        const result = await llm.operate("test", {
          fallback: [{ provider: PROVIDER.GEMINI.NAME }],
        });

        expect(result.provider).toBe("google");
        expect(anthropicOperateMock).not.toHaveBeenCalled();
      });

      it("disables fallback when per-call fallback is false", async () => {
        openAiOperateMock.mockRejectedValue(new Error("Primary failed"));

        const llm = new Llm(PROVIDER.OPENAI.NAME, {
          fallback: [{ provider: PROVIDER.ANTHROPIC.NAME }],
        });

        await expect(llm.operate("test", { fallback: false })).rejects.toThrow(
          "Primary failed",
        );
        expect(anthropicOperateMock).not.toHaveBeenCalled();
      });
    });

    describe("static method fallback", () => {
      it("works with Llm.operate()", async () => {
        openAiOperateMock.mockRejectedValue(new Error("Primary failed"));

        const result = await Llm.operate("test", {
          model: "gpt-4",
          fallback: [{ provider: PROVIDER.ANTHROPIC.NAME }],
        });

        expect(result.content).toBe("Mocked Anthropic operate response");
        expect(result.fallbackUsed).toBe(true);
      });

      it("disables fallback with fallback: false", async () => {
        openAiOperateMock.mockRejectedValue(new Error("Primary failed"));

        await expect(
          Llm.operate("test", {
            model: "gpt-4",
            fallback: false,
          }),
        ).rejects.toThrow("Primary failed");
      });
    });
  });
});
