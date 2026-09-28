import { describe, expect, it } from "vitest";

import { chatCompletionsUsage } from "../chatCompletionsUsage.js";

const TAGS = { model: "test-model", provider: "test-provider" };

describe("chatCompletionsUsage", () => {
  it("Works", () => {
    expect(chatCompletionsUsage).toBeFunction();
  });

  describe("Happy Paths", () => {
    it("Maps snake_case usage with reasoning and cache subsets", () => {
      expect(
        chatCompletionsUsage(
          {
            completion_tokens: 30,
            completion_tokens_details: { reasoning_tokens: 20 },
            prompt_tokens: 100,
            prompt_tokens_details: {
              cache_write_tokens: 10,
              cached_tokens: 60,
            },
            total_tokens: 130,
          },
          TAGS,
        ),
      ).toEqual({
        cacheRead: 60,
        cacheWrite: 10,
        input: 100,
        model: "test-model",
        output: 30,
        provider: "test-provider",
        reasoning: 20,
        total: 130,
      });
    });

    it("Maps camelCase usage", () => {
      expect(
        chatCompletionsUsage(
          {
            completionTokens: 5,
            completionTokensDetails: { reasoningTokens: 2 },
            promptTokens: 7,
            promptTokensDetails: { cachedTokens: 3 },
            totalTokens: 12,
          },
          TAGS,
        ),
      ).toMatchObject({
        cacheRead: 3,
        input: 7,
        output: 5,
        reasoning: 2,
        total: 12,
      });
    });
  });

  describe("Error Conditions", () => {
    it("Maps missing usage to zeros", () => {
      expect(chatCompletionsUsage(undefined, TAGS)).toEqual({
        input: 0,
        model: "test-model",
        output: 0,
        provider: "test-provider",
        reasoning: 0,
        total: 0,
      });
    });

    it("Derives total when the provider omits it", () => {
      expect(
        chatCompletionsUsage({ completion_tokens: 2, prompt_tokens: 3 }, TAGS)
          .total,
      ).toBe(5);
    });
  });
});
