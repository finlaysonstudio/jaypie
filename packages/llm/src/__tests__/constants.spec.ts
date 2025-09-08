import { describe, expect, it } from "vitest";

// Subject
import { DEFAULT, PROVIDER } from "../constants.js";

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
      expect(PROVIDER.ANTHROPIC.MODEL.DEFAULT).toBe(
        PROVIDER.ANTHROPIC.MODEL.CLAUDE_OPUS_4,
      );
      expect(PROVIDER.ANTHROPIC.MODEL.CLAUDE_3_HAIKU).toBe(
        "claude-3-5-haiku-latest",
      );
      expect(PROVIDER.ANTHROPIC.MODEL.CLAUDE_3_OPUS).toBe(
        "claude-3-opus-latest",
      );
      expect(PROVIDER.ANTHROPIC.MODEL.CLAUDE_3_SONNET).toBe(
        "claude-3-7-sonnet-latest",
      );
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
      expect(PROVIDER.ANTHROPIC.MAX_TOKENS.DEFAULT).toBe(4096);
    });

    it("Has tool constants", () => {
      expect(PROVIDER.ANTHROPIC.TOOLS.SCHEMA_VERSION).toBe("v2");
    });
  });
});
