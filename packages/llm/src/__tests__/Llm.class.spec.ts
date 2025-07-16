import { afterEach, describe, expect, it, vi } from "vitest";

// Subject
import Llm from "../Llm.js";
import { DEFAULT, PROVIDER } from "../constants.js";

// Mock OpenAiProvider
vi.mock("../providers/openai/index.js", () => ({
  OpenAiProvider: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue("Mocked OpenAI response"),
  })),
}));

vi.mock("../providers/anthropic/AnthropicProvider.class.js", () => ({
  AnthropicProvider: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue("Mocked Anthropic response"),
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
});
