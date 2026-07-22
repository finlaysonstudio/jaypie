import { describe, expect, it } from "vitest";

import { determineModelProvider } from "../util/determineModelProvider.js";

// Subject
import { COST, DEFAULT, MODEL, PROVIDER } from "../constants.js";

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

    it("Exposes Amazon's Nova models as first-class ids", () => {
      expect(MODEL.NOVA_PRO).toBe("amazon.nova-pro-v1:0");
      expect(MODEL.NOVA_LITE).toBe("us.amazon.nova-2-lite-v1:0");
    });

    it("Catalogs Nova as the only Bedrock-served models", () => {
      for (const model of [MODEL.NOVA_LITE, MODEL.NOVA_PRO]) {
        expect(determineModelProvider(model).provider).toBe(
          PROVIDER.BEDROCK.NAME,
        );
      }
    });

    it("Resolves every catalog id to a provider", () => {
      const unresolved = Object.values(MODEL)
        .flatMap((value) =>
          typeof value === "string" ? [value] : Object.values(value),
        )
        .filter((model) => !determineModelProvider(model).provider);
      expect(unresolved).toBeEmpty();
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

  describe("COST", () => {
    // MODEL.OPENROUTER.* routes are another vendor's model resold per backend,
    // so they are deliberately absent from COST. Amazon's own Nova models are
    // first-class and priced.
    const proxyRoutes: string[] = [...Object.values(MODEL.OPENROUTER)];
    const firstClassModels = Object.values(MODEL)
      .flatMap((value) =>
        typeof value === "string" ? [value] : Object.values(value),
      )
      .filter((model) => !proxyRoutes.includes(model));

    it("Prices every first-class model in MODEL.*", () => {
      const unpriced = firstClassModels.filter((model) => !COST[model]);
      expect(unpriced).toBeEmpty();
    });

    it("Prices the Bedrock default, an Amazon-native model", () => {
      expect(PROVIDER.BEDROCK.DEFAULT).toBe(MODEL.NOVA_PRO);
      expect(COST[PROVIDER.BEDROCK.DEFAULT]).toBeObject();
    });

    it("Omits proxy routes that price per backend", () => {
      for (const route of proxyRoutes) {
        expect(COST[route]).toBeUndefined();
      }
    });

    it("Retains prices for historic models absent from MODEL.*", () => {
      for (const historic of [
        "accounts/fireworks/models/nemotron-3-ultra-nvfp4",
        "claude-opus-4-6",
      ]) {
        expect(firstClassModels).not.toContain(historic);
        expect(COST[historic]).toBeObject();
      }
    });

    it("Quotes positive dollars per million with output above input", () => {
      // Collect by model id so a failure names the entry rather than a number
      const violations: string[] = [];
      for (const [model, cost] of Object.entries(COST)) {
        if (!(cost.input > 0)) violations.push(`${model}: input not positive`);
        if (!(cost.output >= cost.input)) {
          violations.push(`${model}: output below input`);
        }
        if (cost.cachedInputRead !== undefined) {
          // A cache read is always cheaper than reprocessing the input
          if (!(
            cost.cachedInputRead > 0 && cost.cachedInputRead < cost.input
          )) {
            violations.push(`${model}: cache read outside (0, input)`);
          }
        }
        const write = cost.cachedInputWrite;
        if (typeof write === "number") {
          // Either free (Bedrock publishes a literal $0) or a premium on input
          if (!(write === 0 || write >= cost.input)) {
            violations.push(`${model}: cache write below input`);
          }
        } else if (write) {
          // A write is a premium over input, and a longer TTL costs more
          if (!(write["5m"] > cost.input)) {
            violations.push(`${model}: 5m write not above input`);
          }
          if (!(write["1h"] > write["5m"])) {
            violations.push(`${model}: 1h write not above 5m write`);
          }
        }
      }
      expect(violations).toBeEmpty();
    });
  });
});
