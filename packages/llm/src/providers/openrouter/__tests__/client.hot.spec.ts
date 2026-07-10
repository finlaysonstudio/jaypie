import { describe, expect, it } from "vitest";

import { HOT_MODELS } from "../../../__tests__/hotModels.js";
import { OpenRouterClient } from "../client.js";
import { OpenRouterProvider } from "../OpenRouterProvider.class.js";

//
//
// Hot tests
//
// Live tests against the real OpenRouter API. Skipped unless
// OPENROUTER_API_KEY is set, so CI stays green and `npm test` runs them
// automatically on machines that have a key.
//
//   OPENROUTER_API_KEY=sk-or-... npm run test -w packages/llm
//

const apiKey = process.env.OPENROUTER_API_KEY;
const TIMEOUT = 60_000;

describe.skipIf(!apiKey)("OpenRouterClient (hot)", () => {
  describe.each(HOT_MODELS.openrouter)("%s", (MODEL) => {
    describe("chatCompletion", () => {
      it(
        "returns assistant text from the live endpoint",
        async () => {
          const client = new OpenRouterClient({ apiKey: apiKey! });
          const response = (await client.chatCompletion({
            model: MODEL,
            messages: [
              { role: "user", content: "Reply with the single word: pong" },
            ],
          })) as { choices: Array<{ message: { content: string } }> };

          const content = response.choices?.[0]?.message?.content ?? "";
          expect(content.toLowerCase()).toContain("pong");
        },
        TIMEOUT,
      );
    });

    describe("streamChatCompletion", () => {
      it(
        "streams text deltas and a usage chunk",
        async () => {
          const client = new OpenRouterClient({ apiKey: apiKey! });
          let text = "";
          let sawUsage = false;
          for await (const chunk of client.streamChatCompletion({
            model: MODEL,
            messages: [{ role: "user", content: "Count: one two three" }],
          })) {
            const typed = chunk as {
              choices?: Array<{ delta?: { content?: string } }>;
              usage?: { completion_tokens?: number };
            };
            if (typed.choices?.[0]?.delta?.content) {
              text += typed.choices[0].delta.content;
            }
            if (typed.usage) sawUsage = true;
          }

          expect(text.length).toBeGreaterThan(0);
          expect(sawUsage).toBe(true);
        },
        TIMEOUT,
      );
    });

    describe("OpenRouterProvider.operate", () => {
      it(
        "completes a text turn end-to-end",
        async () => {
          const provider = new OpenRouterProvider(MODEL, { apiKey: apiKey! });
          const response = await provider.operate(
            "Reply with the single word: pong",
          );
          expect(String(response.content).toLowerCase()).toContain("pong");
        },
        TIMEOUT,
      );

      it(
        "returns structured output via native response_format",
        async () => {
          const provider = new OpenRouterProvider(MODEL, { apiKey: apiKey! });
          const response = await provider.operate(
            "Give the capital of France.",
            {
              format: { capital: String },
            },
          );
          expect(response.content).toMatchObject({
            capital: expect.any(String),
          });
        },
        TIMEOUT,
      );
    });
  });
});
