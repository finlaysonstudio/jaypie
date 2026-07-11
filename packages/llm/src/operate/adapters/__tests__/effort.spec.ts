import { afterEach, describe, expect, it, vi } from "vitest";

import { log } from "@jaypie/logger";

import { EFFORT } from "../../../constants.js";
import {
  LlmMessageRole,
  LlmMessageType,
} from "../../../types/LlmProvider.interface.js";
import {
  toAnthropicEffort,
  toGeminiThinkingBudget,
  toGeminiThinkingLevel,
  toOpenAiEffort,
  toOpenRouterEffort,
  toXaiEffort,
} from "../../../util/effort.js";
import { OperateRequest } from "../../types.js";
import { anthropicAdapter } from "../AnthropicAdapter.js";
import { googleAdapter } from "../GoogleAdapter.js";
import { openAiAdapter } from "../OpenAiAdapter.js";
import { openRouterAdapter } from "../OpenRouterAdapter.js";
import { xaiAdapter } from "../XaiAdapter.js";

//
//
// Helpers
//

function requestFor(
  model: string,
  extra: Partial<OperateRequest> = {},
): OperateRequest {
  return {
    model,
    messages: [
      {
        content: "Hello",
        role: LlmMessageRole.User,
        type: LlmMessageType.Message,
      },
    ],
    ...extra,
  };
}

//
//
// Run
//

describe("EFFORT constant", () => {
  it("uses provider-neutral values", () => {
    expect(EFFORT).toEqual({
      LOWEST: "lowest",
      LOW: "low",
      MEDIUM: "medium",
      HIGH: "high",
      HIGHEST: "highest",
    });
  });
});

describe("effort mapping util", () => {
  it("OpenAI spans minimal..xhigh on the current line", () => {
    const model = "gpt-5.5";
    expect(toOpenAiEffort(EFFORT.LOWEST, { model })).toEqual({
      papered: false,
      value: "minimal",
    });
    expect(toOpenAiEffort(EFFORT.LOW, { model }).value).toBe("low");
    expect(toOpenAiEffort(EFFORT.MEDIUM, { model }).value).toBe("medium");
    expect(toOpenAiEffort(EFFORT.HIGH, { model }).value).toBe("high");
    expect(toOpenAiEffort(EFFORT.HIGHEST, { model })).toEqual({
      papered: false,
      value: "xhigh",
    });
  });

  it("OpenAI keeps xhigh back to gpt-5.2 but clamps older", () => {
    expect(toOpenAiEffort(EFFORT.HIGHEST, { model: "gpt-5.2" })).toEqual({
      papered: false,
      value: "xhigh",
    });
    expect(toOpenAiEffort(EFFORT.HIGHEST, { model: "gpt-5.1" })).toEqual({
      papered: true,
      value: "high",
    });
    expect(toOpenAiEffort(EFFORT.HIGHEST, { model: "gpt-5" })).toEqual({
      papered: true,
      value: "high",
    });
  });

  it("OpenAI clamps minimal below gpt-5.4 and on o-series", () => {
    expect(toOpenAiEffort(EFFORT.LOWEST, { model: "gpt-5.4" }).value).toBe(
      "minimal",
    );
    expect(toOpenAiEffort(EFFORT.LOWEST, { model: "gpt-5.2" })).toEqual({
      papered: true,
      value: "low",
    });
    expect(toOpenAiEffort(EFFORT.LOWEST, { model: "o3" })).toEqual({
      papered: true,
      value: "low",
    });
  });

  it("xAI collapses ends onto low..high", () => {
    expect(toXaiEffort(EFFORT.LOWEST)).toEqual({ papered: true, value: "low" });
    expect(toXaiEffort(EFFORT.MEDIUM).value).toBe("medium");
    expect(toXaiEffort(EFFORT.HIGHEST)).toEqual({
      papered: true,
      value: "high",
    });
  });

  it("Anthropic collapses lowest to low and reaches max", () => {
    expect(toAnthropicEffort(EFFORT.LOWEST)).toEqual({
      papered: true,
      value: "low",
    });
    expect(toAnthropicEffort(EFFORT.MEDIUM).value).toBe("medium");
    expect(toAnthropicEffort(EFFORT.HIGH).value).toBe("high");
    expect(toAnthropicEffort(EFFORT.HIGHEST)).toEqual({
      papered: false,
      value: "max",
    });
  });

  it("Gemini 3 thinkingLevel spans MINIMAL..HIGH", () => {
    expect(toGeminiThinkingLevel(EFFORT.LOWEST).value).toBe("MINIMAL");
    expect(toGeminiThinkingLevel(EFFORT.MEDIUM).value).toBe("MEDIUM");
    expect(toGeminiThinkingLevel(EFFORT.HIGHEST)).toEqual({
      papered: true,
      value: "HIGH",
    });
  });

  it("Gemini 2.5 thinkingBudget stays within the shared 24,576 cap", () => {
    expect(toGeminiThinkingBudget(EFFORT.LOWEST).value).toBe(512);
    expect(toGeminiThinkingBudget(EFFORT.HIGHEST).value).toBe(24576);
    for (const effort of Object.values(EFFORT)) {
      const { papered, value } = toGeminiThinkingBudget(effort);
      expect(papered).toBe(false);
      expect(value).toBeLessThanOrEqual(24576);
      expect(value).toBeGreaterThanOrEqual(512);
    }
  });

  it("OpenRouter spans minimal..xhigh without papering", () => {
    expect(toOpenRouterEffort(EFFORT.LOWEST)).toEqual({
      papered: false,
      value: "minimal",
    });
    expect(toOpenRouterEffort(EFFORT.HIGHEST).value).toBe("xhigh");
  });
});

describe("OpenAiAdapter effort", () => {
  it("sets reasoning.effort for reasoning models", () => {
    const result = openAiAdapter.buildRequest(
      requestFor("gpt-5.5", { effort: EFFORT.HIGH }),
    ) as Record<string, unknown>;
    expect(result.reasoning).toEqual({ summary: "auto", effort: "high" });
  });

  it("maps highest to xhigh and preserves the summary", () => {
    const result = openAiAdapter.buildRequest(
      requestFor("gpt-5.5", { effort: EFFORT.HIGHEST }),
    ) as Record<string, unknown>;
    expect(result.reasoning).toEqual({ summary: "auto", effort: "xhigh" });
  });

  it("maps lowest to minimal", () => {
    const result = openAiAdapter.buildRequest(
      requestFor("gpt-5.5", { effort: EFFORT.LOWEST }),
    ) as Record<string, unknown>;
    expect((result.reasoning as Record<string, unknown>).effort).toBe(
      "minimal",
    );
  });

  it("clamps xhigh to high on models predating gpt-5.2", () => {
    const result = openAiAdapter.buildRequest(
      requestFor("gpt-5.1", { effort: EFFORT.HIGHEST }),
    ) as Record<string, unknown>;
    expect((result.reasoning as Record<string, unknown>).effort).toBe("high");
  });

  it("omits reasoning.effort for non-reasoning models", () => {
    const result = openAiAdapter.buildRequest(
      requestFor("gpt-4o", { effort: EFFORT.HIGH }),
    ) as Record<string, unknown>;
    expect(result.reasoning).toBeUndefined();
  });

  it("does not set reasoning when effort is absent", () => {
    const result = openAiAdapter.buildRequest(requestFor("gpt-4o")) as Record<
      string,
      unknown
    >;
    expect(result.reasoning).toBeUndefined();
  });

  it("first-class effort wins over providerOptions", () => {
    const result = openAiAdapter.buildRequest(
      requestFor("gpt-5.5", {
        effort: EFFORT.LOW,
        providerOptions: { reasoning: { effort: "high" } },
      }),
    ) as Record<string, unknown>;
    expect((result.reasoning as Record<string, unknown>).effort).toBe("low");
  });
});

describe("papered effort logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs at debug when a level is papered over", () => {
    const debug = vi.spyOn(log, "debug").mockImplementation(() => {});
    xaiAdapter.buildRequest(
      requestFor("grok-4-1-fast-reasoning", { effort: EFFORT.HIGHEST }),
    );
    expect(debug).toHaveBeenCalledTimes(1);
    expect(debug.mock.calls[0][0]).toContain("highest");
    expect(debug.mock.calls[0][0]).toContain("high");
  });

  it("stays quiet when a level maps to a distinct tier", () => {
    const debug = vi.spyOn(log, "debug").mockImplementation(() => {});
    openAiAdapter.buildRequest(
      requestFor("gpt-5.5", { effort: EFFORT.HIGHEST }),
    );
    expect(debug).not.toHaveBeenCalled();
  });
});

describe("XaiAdapter effort", () => {
  it("sets reasoning.effort for reasoning grok models, clamped to high", () => {
    const result = xaiAdapter.buildRequest(
      requestFor("grok-4-1-fast-reasoning", { effort: EFFORT.HIGHEST }),
    ) as Record<string, unknown>;
    expect((result.reasoning as Record<string, unknown>).effort).toBe("high");
  });

  it("omits effort for non-reasoning grok models", () => {
    const result = xaiAdapter.buildRequest(
      requestFor("grok-4-1-fast-non-reasoning", { effort: EFFORT.HIGH }),
    ) as Record<string, unknown>;
    expect(result.reasoning).toBeUndefined();
  });

  it("omits effort for bare grok-latest (conservative default)", () => {
    const result = xaiAdapter.buildRequest(
      requestFor("grok-latest", { effort: EFFORT.HIGH }),
    ) as Record<string, unknown>;
    expect(result.reasoning).toBeUndefined();
  });
});

describe("AnthropicAdapter effort", () => {
  it("sets output_config.effort for 4.5+ models", () => {
    const result = anthropicAdapter.buildRequest(
      requestFor("claude-opus-4-8", { effort: EFFORT.HIGHEST }),
    ) as Record<string, any>;
    expect(result.output_config).toEqual({ effort: "max" });
  });

  it("merges effort alongside a structured-output format config", () => {
    const result = anthropicAdapter.buildRequest(
      requestFor("claude-sonnet-4-6", {
        effort: EFFORT.HIGH,
        format: { type: "object", properties: { a: { type: "string" } } },
      }),
    ) as Record<string, any>;
    expect(result.output_config.effort).toBe("high");
    expect(result.output_config.format).toBeDefined();
  });

  it("omits effort for legacy models (e.g. claude-3-5-sonnet)", () => {
    const result = anthropicAdapter.buildRequest(
      requestFor("claude-3-5-sonnet", { effort: EFFORT.HIGH }),
    ) as Record<string, any>;
    expect(result.output_config).toBeUndefined();
  });
});

describe("GoogleAdapter effort", () => {
  it("sets thinkingLevel for Gemini 3.x", () => {
    const result = googleAdapter.buildRequest(
      requestFor("gemini-3.1-pro-preview", { effort: EFFORT.HIGHEST }),
    );
    expect(result.config?.thinkingConfig).toEqual({ thinkingLevel: "HIGH" });
  });

  it("sets thinkingBudget for Gemini 2.5", () => {
    const result = googleAdapter.buildRequest(
      requestFor("gemini-2.5-flash", { effort: EFFORT.MEDIUM }),
    );
    expect(result.config?.thinkingConfig).toEqual({ thinkingBudget: 8192 });
  });

  it("omits thinking config for models without thinking control", () => {
    const result = googleAdapter.buildRequest(
      requestFor("gemini-2.0-flash", { effort: EFFORT.HIGH }),
    );
    expect(result.config?.thinkingConfig).toBeUndefined();
  });
});

describe("OpenRouterAdapter effort", () => {
  it("sets reasoning.effort translating the neutral scale", () => {
    const result = openRouterAdapter.buildRequest(
      requestFor("anthropic/claude-sonnet-4-6", { effort: EFFORT.HIGHEST }),
    ) as Record<string, any>;
    expect(result.reasoning).toEqual({ effort: "xhigh" });
  });

  it("omits reasoning when effort is absent", () => {
    const result = openRouterAdapter.buildRequest(
      requestFor("anthropic/claude-sonnet-4-6"),
    ) as Record<string, any>;
    expect(result.reasoning).toBeUndefined();
  });
});
