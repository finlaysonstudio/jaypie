import { afterEach, describe, expect, it, vi } from "vitest";

// Subject
import Llm from "../Llm.js";
import { DEFAULT, PROVIDER } from "../constants.js";

// Mock OpenAiProvider
vi.mock("../providers/openai/index.js", () => ({
  OpenAiProvider: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue("Mocked OpenAI response"),
    operate: vi
      .fn()
      .mockResolvedValue({ response: "Mocked OpenAI operate response" }),
  })),
}));

vi.mock("../providers/anthropic/AnthropicProvider.class.js", () => ({
  AnthropicProvider: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue("Mocked Anthropic response"),
    operate: vi
      .fn()
      .mockResolvedValue({ response: "Mocked Anthropic operate response" }),
  })),
}));

afterEach(() => {
  vi.clearAllMocks();
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
      expect(result).toEqual({ response: "Mocked OpenAI operate response" });
    });

    it("uses explicitly provided llm over determined provider", async () => {
      const input = "test input";
      const options = { model: "gpt-4", llm: PROVIDER.ANTHROPIC.NAME };

      const result = await Llm.operate(input, options);
      expect(result).toEqual({ response: "Mocked Anthropic operate response" });
    });

    it("falls back to default when model provider cannot be determined", async () => {
      const input = "test input";
      const options = { model: "unknown-model" };

      const result = await Llm.operate(input, options);
      expect(result).toEqual({ response: "Mocked OpenAI operate response" });
    });
  });
});
