import { describe, expect, it } from "vitest";

import { MODEL, PROVIDER } from "../../constants.js";
import { googleAdapter } from "../../operate/adapters/GoogleAdapter.js";
import { openAiAdapter } from "../../operate/adapters/OpenAiAdapter.js";
import { OperateRequest } from "../../operate/types.js";
import {
  LlmMessageRole,
  LlmMessageType,
} from "../../types/LlmProvider.interface.js";
import { withResolvedEffort } from "../effort.js";
import {
  resolveModelOptions,
  resolveModelOptionsFor,
  withResolvedModelOptions,
} from "../modelOptions.js";

//
//
// Helpers
//

function requestFor(
  options: Pick<OperateRequest, "effort" | "providerOptions"> & {
    model?: string;
  },
): OperateRequest {
  return {
    effort: options.effort,
    messages: [
      {
        content: "Hello",
        role: LlmMessageRole.User,
        type: LlmMessageType.Message,
      },
    ],
    model: options.model!,
    providerOptions: options.providerOptions,
  };
}

//
//
// Run
//

describe("resolveModelOptionsFor", () => {
  describe("Base Cases", () => {
    it("returns no keys without modelOptions", () => {
      expect(resolveModelOptionsFor(undefined)).toEqual({ keys: [] });
    });

    it("returns no options when nothing matches", () => {
      expect(
        resolveModelOptionsFor(
          { anthropic: { a: 1 } },
          { model: MODEL.SOL, provider: PROVIDER.OPENAI.NAME },
        ),
      ).toEqual({ keys: [] });
    });
  });

  describe("Merging", () => {
    const modelOptions = {
      default: { level: "default", shared: { fromDefault: true } },
      [MODEL.SOL]: { level: "exact", shared: { fromExact: true } },
      openai: { level: "provider", shared: { fromProvider: true } },
      sol: { level: "catalog", shared: { fromCatalog: true } },
    };

    it("merges every match from least to most specific", () => {
      const result = resolveModelOptionsFor(modelOptions, {
        model: MODEL.SOL,
        provider: PROVIDER.OPENAI.NAME,
      });
      expect(result.keys).toEqual(["default", "openai", "sol", MODEL.SOL]);
      expect(result.options).toEqual({
        level: "exact",
        shared: {
          fromCatalog: true,
          fromDefault: true,
          fromExact: true,
          fromProvider: true,
        },
      });
    });

    it("applies only the keys that match another model", () => {
      const result = resolveModelOptionsFor(modelOptions, {
        model: MODEL.GEMINI_FLASH,
        provider: PROVIDER.GOOGLE.NAME,
      });
      expect(result.keys).toEqual(["default"]);
      expect(result.options).toEqual({
        level: "default",
        shared: { fromDefault: true },
      });
    });

    it("replaces arrays rather than merging them", () => {
      const result = resolveModelOptionsFor(
        { default: { stop: ["a", "b"] }, openai: { stop: ["c"] } },
        { model: MODEL.SOL, provider: PROVIDER.OPENAI.NAME },
      );
      expect(result.options).toEqual({ stop: ["c"] });
    });

    it("matches a provider alias", () => {
      const result = resolveModelOptionsFor(
        { gemini: { a: 1 } },
        { model: MODEL.GEMINI_FLASH, provider: PROVIDER.GOOGLE.NAME },
      );
      expect(result.keys).toEqual(["gemini"]);
    });

    it("does not mutate the map", () => {
      const map = {
        default: { nested: { a: 1 } },
        openai: { nested: { b: 2 } },
      };
      resolveModelOptionsFor(map, {
        model: MODEL.SOL,
        provider: PROVIDER.OPENAI.NAME,
      });
      expect(map.default.nested).toEqual({ a: 1 });
    });
  });
});

describe("withResolvedModelOptions", () => {
  const attempt = { defaultModel: MODEL.SOL, provider: PROVIDER.OPENAI.NAME };

  it("leaves options alone without modelOptions", () => {
    const options = { providerOptions: { a: 1 } };
    expect(withResolvedModelOptions(options, attempt)).toBe(options);
  });

  it("resolves against the default model when none is set", () => {
    expect(
      withResolvedModelOptions({ modelOptions: { sol: { a: 1 } } }, attempt)
        .providerOptions,
    ).toEqual({ a: 1 });
  });

  it("ignores providerOptions when modelOptions is set", () => {
    expect(
      withResolvedModelOptions(
        { modelOptions: { openai: { a: 1 } }, providerOptions: { b: 2 } },
        attempt,
      ).providerOptions,
    ).toEqual({ a: 1 });
  });

  it("drops providerOptions when modelOptions has no match", () => {
    expect(
      withResolvedModelOptions(
        { modelOptions: { anthropic: { a: 1 } }, providerOptions: { b: 2 } },
        attempt,
      ).providerOptions,
    ).toBeUndefined();
  });
});

describe("resolveModelOptions", () => {
  it("determines the provider from the model", () => {
    expect(
      resolveModelOptions({
        model: MODEL.GEMINI_FLASH,
        modelOptions: { gemini: { a: 1 }, openai: { b: 2 } },
      }),
    ).toEqual({
      keys: ["gemini"],
      model: MODEL.GEMINI_FLASH,
      options: { a: 1 },
      provider: PROVIDER.GOOGLE.NAME,
    });
  });

  it("omits options when nothing matches", () => {
    const result = resolveModelOptions({
      model: MODEL.SOL,
      modelOptions: { anthropic: { a: 1 } },
    });
    expect(result.keys).toEqual([]);
    expect(result.options).toBeUndefined();
  });
});

describe("Features", () => {
  // The example from the request: provider-wide and model-specific options
  // reach each chain entry, and first-class effort still wins
  const call = {
    effort: { default: "medium", gemini_flash: "low" } as const,
    modelOptions: {
      gemini_flash: { thinkingConfig: { includeThoughts: true } },
      openai: { reasoning: { summary: "detailed" } },
    },
  };

  it("merges resolved options under first-class effort on OpenAI", () => {
    const attempt = {
      defaultModel: openAiAdapter.defaultModel,
      provider: openAiAdapter.name,
    };
    const options = withResolvedEffort(
      withResolvedModelOptions({ ...call, model: MODEL.SOL }, attempt),
      attempt,
    );
    const request = openAiAdapter.buildRequest(requestFor(options)) as {
      reasoning?: Record<string, unknown>;
    };
    expect(request.reasoning).toEqual({
      effort: "medium",
      summary: "detailed",
    });
  });

  it("merges resolved options under first-class effort on Gemini", () => {
    const attempt = {
      defaultModel: googleAdapter.defaultModel,
      provider: googleAdapter.name,
    };
    const options = withResolvedEffort(
      withResolvedModelOptions({ ...call, model: MODEL.GEMINI_FLASH }, attempt),
      attempt,
    );
    const request = googleAdapter.buildRequest(requestFor(options));
    expect(request.config?.thinkingConfig).toMatchObject({
      includeThoughts: true,
      thinkingLevel: "LOW",
    });
  });
});
