import { describe, expect, it, vi } from "vitest";

import { anthropicAdapter } from "../AnthropicAdapter.js";
import {
  bedrockAdapter,
  isCachePointUnsupportedError,
} from "../BedrockAdapter.js";
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
  it("Marks system + last tool with cache_control at 1h by default", () => {
    const request: OperateRequest = {
      model: PROVIDER.ANTHROPIC.MODEL.LARGE,
      messages: [],
      system: "You are helpful",
      tools,
    };
    const result = anthropicAdapter.buildRequest(request);
    expect(Array.isArray(result.system)).toBe(true);
    const system = result.system as Array<{ cache_control?: unknown }>;
    expect(system[0].cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
    const built = result.tools as Array<{ cache_control?: unknown }>;
    expect(built[built.length - 1].cache_control).toEqual({
      type: "ephemeral",
      ttl: "1h",
    });
  });

  it("Applies the 5m TTL when requested", () => {
    const result = anthropicAdapter.buildRequest({
      cache: "5m",
      model: PROVIDER.ANTHROPIC.MODEL.LARGE,
      messages: [],
      system: "You are helpful",
    });
    const system = result.system as Array<{ cache_control?: unknown }>;
    expect(system[0].cache_control).toEqual({ type: "ephemeral" });
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
    // input includes cache tokens so cacheRead/cacheWrite are subsets of it
    expect(usage.input).toBe(310);
    expect(usage.total).toBe(315);
    expect(usage.cacheWriteTtl).toBeUndefined();
  });

  it("extractUsage splits cache writes by TTL", () => {
    const usage = anthropicAdapter.extractUsage(
      {
        usage: {
          cache_creation: {
            ephemeral_1h_input_tokens: 150,
            ephemeral_5m_input_tokens: 50,
          },
          cache_creation_input_tokens: 200,
          input_tokens: 10,
          output_tokens: 5,
        },
      },
      "claude",
    );
    expect(usage.cacheWrite).toBe(200);
    expect(usage.cacheWriteTtl).toEqual({ "1h": 150, "5m": 50 });
  });

  it("streams cache tokens in the done chunk", async () => {
    const client = {
      messages: {
        create: async () =>
          (async function* () {
            yield {
              type: "message_start",
              message: {
                model: "claude",
                usage: {
                  cache_creation_input_tokens: 200,
                  cache_read_input_tokens: 100,
                  input_tokens: 10,
                  output_tokens: 1,
                },
              },
            };
            yield {
              type: "message_delta",
              delta: {},
              usage: { output_tokens: 5 },
            };
            yield { type: "message_stop" };
          })(),
      },
    };
    const chunks = [];
    for await (const chunk of anthropicAdapter.executeStreamRequest!(client, {
      model: "claude",
    })) {
      chunks.push(chunk);
    }
    expect(chunks.at(-1)).toMatchObject({
      type: "done",
      usage: [
        { cacheRead: 100, cacheWrite: 200, input: 310, output: 5, total: 315 },
      ],
    });
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
    // Nova takes no TTL
    expect(result.system.at(-1)).toEqual({ cachePoint: { type: "default" } });
  });

  it("Sends a 1h cachePoint TTL on Claude 4.5+ routes by default", () => {
    const build = (model: string, cache?: OperateRequest["cache"]) =>
      (
        bedrockAdapter.buildRequest({
          cache,
          model,
          messages: [],
          system: "You are helpful",
        }) as unknown as { system: Array<Record<string, unknown>> }
      ).system.at(-1);
    expect(build("us.anthropic.claude-sonnet-4-5-20250929-v1:0")).toEqual({
      cachePoint: { type: "default", ttl: "1h" },
    });
    expect(build("us.anthropic.claude-sonnet-4-5-20250929-v1:0", "5m")).toEqual(
      { cachePoint: { type: "default" } },
    );
    expect(build("anthropic.claude-sonnet-4-20250514-v1:0")).toEqual({
      cachePoint: { type: "default" },
    });
  });

  describe("isCachePointUnsupportedError", () => {
    it("Detects the wording Bedrock actually returns", () => {
      // Live wording observed in CI. "unsupported" is one word, so a
      // /not support/ pattern alone misses it and the no-cachePoint retry
      // never fires, failing the call instead of degrading gracefully.
      expect(
        isCachePointUnsupportedError(
          new Error(
            "You invoked an unsupported model or your request did not allow prompt caching. See the documentation for more information.",
          ),
        ),
      ).toBeTrue();
    });

    it("Detects a ValidationException naming cachePoint", () => {
      const error = new Error("Invalid cachePoint block for this model");
      error.name = "ValidationException";
      expect(isCachePointUnsupportedError(error)).toBeTrue();
    });

    it("Ignores errors unrelated to caching", () => {
      expect(
        isCachePointUnsupportedError(
          new Error("You invoked an unsupported model"),
        ),
      ).toBeFalse();
      expect(
        isCachePointUnsupportedError(
          new Error("ThrottlingException: slow down"),
        ),
      ).toBeFalse();
    });
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
    // input includes cache tokens so cacheRead/cacheWrite are subsets of it
    expect(usage.input).toBe(59);
    expect(usage.total).toBe(64);
  });

  it("extractUsage splits cache writes by TTL", () => {
    const usage = bedrockAdapter.extractUsage(
      {
        usage: {
          cacheDetails: [
            { inputTokens: 5, ttl: "1h" },
            { inputTokens: 2, ttl: "5m" },
          ],
          cacheWriteInputTokens: 7,
          inputTokens: 10,
          outputTokens: 5,
        },
      },
      "bedrock-model",
    );
    expect(usage.cacheWriteTtl).toEqual({ "1h": 5, "5m": 2 });
  });

  it("streams usage that arrives after messageStop", async () => {
    const client = {
      send: async () => ({
        stream: (async function* () {
          yield { contentBlockDelta: { delta: { text: "Hi" } } };
          yield { messageStop: { stopReason: "end_turn" } };
          yield {
            metadata: {
              usage: {
                cacheReadInputTokens: 42,
                inputTokens: 10,
                outputTokens: 5,
                totalTokens: 57,
              },
            },
          };
        })(),
      }),
    };
    const chunks = [];
    for await (const chunk of bedrockAdapter.executeStreamRequest!(client, {
      modelId: "bedrock-model",
    })) {
      chunks.push(chunk);
    }
    expect(chunks.at(-1)).toMatchObject({
      type: "done",
      usage: [{ cacheRead: 42, input: 52, output: 5, total: 57 }],
    });
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
    expect(content[0].cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
  });

  it("Applies the 5m TTL when requested", () => {
    const result = openRouterAdapter.buildRequest({
      cache: "5m",
      model: PROVIDER.OPENROUTER.DEFAULT,
      messages: [],
      system: "You are helpful",
    });
    const content = result.messages[0].content as Array<{
      cache_control?: unknown;
    }>;
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
