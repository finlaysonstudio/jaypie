import { describe, expect, it, vi } from "vitest";

import { anthropicAdapter } from "../AnthropicAdapter.js";
import { bedrockAdapter } from "../BedrockAdapter.js";
import { openAiAdapter } from "../OpenAiAdapter.js";
import { openRouterAdapter } from "../OpenRouterAdapter.js";
import { PROVIDER } from "../../../constants.js";
import { OperateRequest } from "../../types.js";

vi.mock("zod/v4", () => ({
  z: {
    ZodType: class ZodType {},
    toJSONSchema: vi.fn(() => ({ type: "object", properties: {} })),
  },
}));

const tools = [
  {
    name: "get_weather",
    description: "Get weather",
    parameters: { type: "object", properties: { city: { type: "string" } } },
  },
];

//
// Anthropic
//

describe("Prompt caching — Anthropic", () => {
  it("Marks system + last tool with cache_control by default", () => {
    const request: OperateRequest = {
      model: PROVIDER.ANTHROPIC.MODEL.LARGE,
      messages: [],
      system: "You are helpful",
      tools,
    };
    const result = anthropicAdapter.buildRequest(request);
    expect(Array.isArray(result.system)).toBe(true);
    const system = result.system as Array<{ cache_control?: unknown }>;
    expect(system[0].cache_control).toEqual({ type: "ephemeral" });
    const built = result.tools as Array<{ cache_control?: unknown }>;
    expect(built[built.length - 1].cache_control).toEqual({
      type: "ephemeral",
    });
  });

  it("Applies the 1h TTL when requested", () => {
    const result = anthropicAdapter.buildRequest({
      cache: "1h",
      model: PROVIDER.ANTHROPIC.MODEL.LARGE,
      messages: [],
      system: "You are helpful",
    });
    const system = result.system as Array<{ cache_control?: unknown }>;
    expect(system[0].cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
  });

  it("Leaves system as a bare string when cache is false", () => {
    const result = anthropicAdapter.buildRequest({
      cache: false,
      model: PROVIDER.ANTHROPIC.MODEL.LARGE,
      messages: [],
      system: "You are helpful",
    });
    expect(result.system).toBe("You are helpful");
  });

  it("extractUsage surfaces cache tokens", () => {
    const usage = anthropicAdapter.extractUsage(
      {
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          cache_read_input_tokens: 100,
          cache_creation_input_tokens: 200,
        },
      },
      "claude",
    );
    expect(usage.cacheRead).toBe(100);
    expect(usage.cacheWrite).toBe(200);
  });
});

//
// Bedrock
//

describe("Prompt caching — Bedrock", () => {
  it("Appends cachePoint blocks to system and tools by default", () => {
    const result = bedrockAdapter.buildRequest({
      model: PROVIDER.BEDROCK.DEFAULT,
      messages: [],
      system: "You are helpful",
      tools,
    }) as unknown as {
      system: Array<Record<string, unknown>>;
      toolConfig: { tools: Array<Record<string, unknown>> };
    };
    expect(result.system.at(-1)).toHaveProperty("cachePoint");
    expect(result.toolConfig.tools.at(-1)).toHaveProperty("cachePoint");
  });

  it("Omits cachePoint when cache is false", () => {
    const result = bedrockAdapter.buildRequest({
      cache: false,
      model: PROVIDER.BEDROCK.DEFAULT,
      messages: [],
      system: "You are helpful",
    }) as unknown as { system: Array<Record<string, unknown>> };
    expect(result.system).toEqual([{ text: "You are helpful" }]);
  });

  it("extractUsage surfaces cache tokens", () => {
    const usage = bedrockAdapter.extractUsage(
      {
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          cacheReadInputTokens: 42,
          cacheWriteInputTokens: 7,
        },
      },
      "bedrock-model",
    );
    expect(usage.cacheRead).toBe(42);
    expect(usage.cacheWrite).toBe(7);
  });
});

//
// OpenAI
//

describe("Prompt caching — OpenAI", () => {
  it("Sets a stable prompt_cache_key by default", () => {
    const base: OperateRequest = {
      model: "gpt-5",
      messages: [],
      system: "You are helpful",
      tools,
    };
    const a = openAiAdapter.buildRequest(base) as {
      prompt_cache_key?: string;
    };
    const b = openAiAdapter.buildRequest(base) as {
      prompt_cache_key?: string;
    };
    expect(a.prompt_cache_key).toBeTypeOf("string");
    expect(a.prompt_cache_key).toBe(b.prompt_cache_key);
  });

  it("Omits prompt_cache_key when cache is false", () => {
    const result = openAiAdapter.buildRequest({
      cache: false,
      model: "gpt-5",
      messages: [],
      system: "You are helpful",
    }) as { prompt_cache_key?: string };
    expect(result.prompt_cache_key).toBeUndefined();
  });

  it("extractUsage surfaces cached tokens as cacheRead", () => {
    const usage = openAiAdapter.extractUsage(
      {
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          total_tokens: 15,
          input_tokens_details: { cached_tokens: 8 },
        },
      },
      "gpt-5",
    );
    expect(usage.cacheRead).toBe(8);
  });
});

//
// OpenRouter
//

describe("Prompt caching — OpenRouter", () => {
  it("Tags the system message with cache_control by default", () => {
    const result = openRouterAdapter.buildRequest({
      model: PROVIDER.OPENROUTER.DEFAULT,
      messages: [],
      system: "You are helpful",
    });
    const content = result.messages[0].content as Array<{
      cache_control?: unknown;
    }>;
    expect(Array.isArray(content)).toBe(true);
    expect(content[0].cache_control).toEqual({ type: "ephemeral" });
  });

  it("Leaves system content a bare string when cache is false", () => {
    const result = openRouterAdapter.buildRequest({
      cache: false,
      model: PROVIDER.OPENROUTER.DEFAULT,
      messages: [],
      system: "You are helpful",
    });
    expect(result.messages[0].content).toBe("You are helpful");
  });
});
