import { describe, expect, it } from "vitest";

import { HOT_MODELS } from "../../../__tests__/hotModels.js";
import { PROVIDER } from "../../../constants.js";
import { OpenAIClient } from "../../openai/client.js";
import { MetaProvider } from "../MetaProvider.class.js";

//
//
// Hot tests
//
// Live tests against the real Meta Model API (OpenAI-compatible, custom base URL).
// Skipped unless META_API_KEY is set, so CI stays green and `npm test` runs them
// automatically with a key.
//
//   META_API_KEY=... npm run test -w packages/llm
//

const apiKey = process.env.META_API_KEY;
const TIMEOUT = 60_000;

describe.skipIf(!apiKey)("MetaClient (hot)", () => {
  describe.each(HOT_MODELS.meta)("%s", (MODEL) => {
    describe("chat.completions.create", () => {
      it(
        "returns assistant text from the live Meta endpoint",
        async () => {
          const client = new OpenAIClient({
            apiKey: apiKey!,
            baseURL: PROVIDER.META.BASE_URL,
          });
          const completion = (await client.chat.completions.create({
            model: MODEL,
            messages: [
              { role: "user", content: "Reply with the single word: pong" },
            ],
          })) as { choices: Array<{ message: { content: string } }> };
          const text = completion.choices[0]?.message?.content ?? "";
          expect(text.toLowerCase()).toContain("pong");
        },
        TIMEOUT,
      );
    });

    describe("responses.create", () => {
      it(
        "streams text deltas",
        async () => {
          const client = new OpenAIClient({
            apiKey: apiKey!,
            baseURL: PROVIDER.META.BASE_URL,
          });
          const stream = await client.responses.create({
            model: MODEL,
            input: "Count: one two three",
            stream: true,
          });

          let text = "";
          for await (const event of stream) {
            if (event.type === "response.output_text.delta") {
              text += (event as { delta?: string }).delta ?? "";
            }
          }
          expect(text.length).toBeGreaterThan(0);
        },
        TIMEOUT,
      );
    });

    describe("MetaProvider.operate", () => {
      it(
        "completes a text turn end-to-end",
        async () => {
          const provider = new MetaProvider(MODEL, { apiKey: apiKey! });
          const response = await provider.operate(
            "Reply with the single word: pong",
          );
          expect(String(response.content).toLowerCase()).toContain("pong");
        },
        TIMEOUT,
      );

      it(
        "returns structured output via native format",
        async () => {
          const provider = new MetaProvider(MODEL, { apiKey: apiKey! });
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
