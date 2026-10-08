import { describe, expect, it } from "vitest";

import { MODEL, PROVIDER } from "../../constants.js";
import { resolveEffortLevel } from "../effort.js";
import { resolveEffort } from "../resolveEffort.js";

//
//
// Run
//

describe("resolveEffortLevel", () => {
  describe("Base Cases", () => {
    it("returns undefined without effort", () => {
      expect(resolveEffortLevel(undefined)).toBeUndefined();
    });

    it("returns a single level unchanged", () => {
      expect(
        resolveEffortLevel("low", { model: MODEL.SOL, provider: "openai" }),
      ).toBe("low");
    });
  });

  describe("Map precedence", () => {
    const effort = {
      anthropic: "highest",
      default: "medium",
      "gpt-6.1-sol": "high",
      sol: "low",
    } as const;

    it("matches the exact model id first", () => {
      expect(
        resolveEffortLevel(effort, {
          model: "gpt-6.1-sol",
          provider: "openai",
        }),
      ).toBe("high");
    });

    it("matches a MODEL catalog key whose value is the model", () => {
      expect(
        resolveEffortLevel(effort, { model: MODEL.SOL, provider: "openai" }),
      ).toBe("low");
    });

    it("matches the provider", () => {
      expect(
        resolveEffortLevel(effort, {
          model: MODEL.OPUS,
          provider: "anthropic",
        }),
      ).toBe("highest");
    });

    it("falls back to default", () => {
      expect(
        resolveEffortLevel(effort, {
          model: MODEL.GEMINI_FLASH,
          provider: "google",
        }),
      ).toBe("medium");
    });

    it("returns undefined with no match and no default", () => {
      expect(
        resolveEffortLevel(
          { anthropic: "low" },
          { model: MODEL.SOL, provider: "openai" },
        ),
      ).toBeUndefined();
    });
  });

  describe("Catalog keys", () => {
    it("is case-insensitive and accepts separators", () => {
      const model = MODEL.GEMINI_FLASH;
      expect(
        resolveEffortLevel(
          { "gemini-flash": "low" },
          { model, provider: "google" },
        ),
      ).toBe("low");
      expect(
        resolveEffortLevel(
          { GEMINI_FLASH: "low" },
          { model, provider: "google" },
        ),
      ).toBe("low");
    });

    it("does not match a catalog key for a different model", () => {
      expect(
        resolveEffortLevel(
          { sol: "low" },
          { model: "gpt-6.1-sol", provider: "openai" },
        ),
      ).toBeUndefined();
    });

    it("does not match by name fragment", () => {
      expect(
        resolveEffortLevel(
          { flash: "low" },
          { model: MODEL.FIREWORKS.GLM_FLASH, provider: "fireworks" },
        ),
      ).toBeUndefined();
    });

    it("matches nested keys by leaf and by path", () => {
      const model = MODEL.FIREWORKS.GLM;
      expect(
        resolveEffortLevel({ glm: "low" }, { model, provider: "fireworks" }),
      ).toBe("low");
      expect(
        resolveEffortLevel(
          { "fireworks.glm": "low" },
          { model, provider: "fireworks" },
        ),
      ).toBe("low");
    });

    it("resolves a leaf shared across subtrees by the serving id", () => {
      expect(
        resolveEffortLevel(
          { glm: "low" },
          { model: MODEL.OPENROUTER.GLM, provider: "openrouter" },
        ),
      ).toBe("low");
    });
  });

  describe("Provider aliases", () => {
    it("matches gemini to the google provider", () => {
      expect(
        resolveEffortLevel(
          { gemini: "low" },
          { model: "gemini-3-flash", provider: PROVIDER.GOOGLE.NAME },
        ),
      ).toBe("low");
    });

    it("matches provider keys case-insensitively", () => {
      expect(
        resolveEffortLevel(
          { OpenAI: "low" },
          { model: MODEL.SOL, provider: "openai" },
        ),
      ).toBe("low");
    });
  });

  describe("Issue #612 example", () => {
    const effort = {
      default: "high",
      gemini: "low",
      "gpt-6.1-sol": "medium",
    } as const;

    it("resolves each attempt of the chain", () => {
      expect(
        resolveEffortLevel(effort, {
          model: "gemini-3-flash",
          provider: "google",
        }),
      ).toBe("low");
      expect(
        resolveEffortLevel(effort, {
          model: "gpt-6.1-sol",
          provider: "openai",
        }),
      ).toBe("medium");
      expect(
        resolveEffortLevel(effort, {
          model: "claude-opus-5-5",
          provider: "anthropic",
        }),
      ).toBe("high");
    });
  });
});

describe("resolveEffort", () => {
  it("returns the Gemini 3 thinking level", () => {
    expect(resolveEffort({ effort: "low", model: "gemini-3-flash" })).toEqual({
      level: "low",
      model: "gemini-3-flash",
      native: { thinkingConfig: { thinkingLevel: "LOW" } },
      papered: false,
      provider: "google",
    });
  });

  it("returns the Gemini 2.5 thinking budget", () => {
    expect(
      resolveEffort({ effort: "low", model: "gemini-2.5-flash" }).native,
    ).toEqual({ thinkingConfig: { thinkingBudget: 4096 } });
  });

  it("returns Anthropic output_config", () => {
    expect(
      resolveEffort({ effort: "highest", model: MODEL.OPUS }),
    ).toMatchObject({
      level: "highest",
      native: { output_config: { effort: "max" } },
      provider: "anthropic",
    });
  });

  it("returns OpenAI reasoning", () => {
    expect(
      resolveEffort({ effort: "highest", model: MODEL.SOL }).native,
    ).toEqual({ reasoning: { effort: "max" } });
  });

  it("marks papered levels", () => {
    const lowest = resolveEffort({ effort: "lowest", model: MODEL.OPUS });
    const low = resolveEffort({ effort: "low", model: MODEL.OPUS });
    expect(lowest.papered).toBe(true);
    expect(lowest.native).toEqual(low.native);
  });

  it("resolves a map before translating", () => {
    expect(
      resolveEffort({
        effort: { anthropic: "high", default: "low" },
        model: MODEL.OPUS,
      }),
    ).toMatchObject({
      level: "high",
      native: { output_config: { effort: "high" } },
    });
  });

  it("omits native when the model has no reasoning control", () => {
    const result = resolveEffort({ effort: "low", model: "claude-3-5-sonnet" });
    expect(result.level).toBe("low");
    expect(result.native).toBeUndefined();
  });

  it("omits native when no level resolves", () => {
    const result = resolveEffort({
      effort: { openai: "low" },
      model: MODEL.OPUS,
    });
    expect(result.level).toBeUndefined();
    expect(result.native).toBeUndefined();
  });

  it("omits native for providers without an adapter", () => {
    const result = resolveEffort({ effort: "low", model: MODEL.JEV });
    expect(result.provider).toBe("typesafe");
    expect(result.native).toBeUndefined();
  });

  it("accepts an explicit provider", () => {
    expect(
      resolveEffort({
        effort: "low",
        model: "anthropic/claude-opus-5.5",
        provider: "openrouter",
      }).native,
    ).toEqual({ reasoning: { effort: "low" } });
  });
});
