import { describe, expect, it } from "vitest";

// Subject
import { DEFAULT, MODEL, PROVIDER } from "../constants.js";

describe("Constants", () => {
  it("Exports constants we expect", () => {
    expect(DEFAULT).toBeObject();
    expect(DEFAULT.PROVIDER).toBeObject();
    expect(PROVIDER).toBeObject();
    expect(PROVIDER.OPENAI).toBeObject();
    expect(PROVIDER.ANTHROPIC).toBeObject();
    expect(PROVIDER.OPENAI.MODEL).toBeObject();
    expect(PROVIDER.ANTHROPIC.MODEL).toBeObject();
    expect(DEFAULT.PROVIDER).toBe(PROVIDER.OPENAI);
  });

  describe("Anthropic Constants", () => {
    it("Has model constants", () => {
      expect(PROVIDER.ANTHROPIC.MODEL.DEFAULT).toBeDefined();
      expect(PROVIDER.ANTHROPIC.MODEL.DEFAULT).toBeString();
      expect(PROVIDER.ANTHROPIC.MODEL.LARGE).toBeDefined();
      expect(PROVIDER.ANTHROPIC.MODEL.SMALL).toBeDefined();
      expect(PROVIDER.ANTHROPIC.MODEL.TINY).toBeDefined();
    });

    it("Has prompt constants", () => {
      expect(PROVIDER.ANTHROPIC.PROMPT.AI).toBe("\n\nAssistant:");
      expect(PROVIDER.ANTHROPIC.PROMPT.HUMAN).toBe("\n\nHuman:");
    });

    it("Has role constants", () => {
      expect(PROVIDER.ANTHROPIC.ROLE.ASSISTANT).toBe("assistant");
      expect(PROVIDER.ANTHROPIC.ROLE.SYSTEM).toBe("system");
      expect(PROVIDER.ANTHROPIC.ROLE.USER).toBe("user");
    });

    it("Has max token constants", () => {
      expect(PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT).toBe(16384);
    });

    it("Has tool constants", () => {
      expect(PROVIDER.ANTHROPIC.TOOLS.SCHEMA_VERSION).toBe("v2");
    });
  });

  describe("Google Constants", () => {
    it("Has model constants", () => {
      expect(PROVIDER.GOOGLE.MODEL.DEFAULT).toBeString();
      expect(PROVIDER.GOOGLE.MODEL.LARGE).toBeDefined();
      expect(PROVIDER.GOOGLE.MODEL.SMALL).toBeDefined();
      expect(PROVIDER.GOOGLE.MODEL.TINY).toBeDefined();
    });

    it("Is named google", () => {
      expect(PROVIDER.GOOGLE.NAME).toBe("google");
    });

    it("Keeps PROVIDER.GEMINI as a deprecated alias of PROVIDER.GOOGLE", () => {
      expect(PROVIDER.GEMINI).toBe(PROVIDER.GOOGLE);
    });
  });

  describe("MODEL Constants", () => {
    it("Exposes an OpenRouter subtree of provider-prefixed routes", () => {
      expect(MODEL.OPENROUTER).toBeObject();
      expect(MODEL.OPENROUTER.GLM).toBe("z-ai/glm-5.2");
      expect(MODEL.OPENROUTER.LUNA).toBe("openai/gpt-5.6-luna");
      expect(MODEL.OPENROUTER.SONNET).toBe("anthropic/claude-sonnet-5");
    });
  });

  describe("Provider DEFAULT (replaces the deprecated tier map)", () => {
    it("Exposes a single default model per provider, drawn from MODEL.*", () => {
      expect(PROVIDER.ANTHROPIC.DEFAULT).toBe(MODEL.SONNET);
      expect(PROVIDER.GOOGLE.DEFAULT).toBe(MODEL.GEMINI_FLASH);
      expect(PROVIDER.OPENAI.DEFAULT).toBe(MODEL.SOL);
      expect(PROVIDER.OPENROUTER.DEFAULT).toBe(MODEL.OPENROUTER.SONNET);
      expect(PROVIDER.XAI.DEFAULT).toBe(MODEL.GROK);
      expect(PROVIDER.BEDROCK.DEFAULT).toBeString();
    });

    it("Points the library base default at OpenAI's default", () => {
      expect(DEFAULT.PROVIDER.DEFAULT).toBe(PROVIDER.OPENAI.DEFAULT);
    });
  });
});
