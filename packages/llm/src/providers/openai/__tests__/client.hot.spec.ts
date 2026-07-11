import { describe, expect, it } from "vitest";

import { HOT_MODELS } from "../../../__tests__/hotModels.js";
import { OpenAIClient } from "../client.js";
import { OpenAiProvider } from "../OpenAiProvider.class.js";

//
//
// Hot tests
//
// Live tests against the real OpenAI API. Skipped unless OPENAI_API_KEY is set,
// so CI stays green and `npm test` runs them automatically with a key.
//
//   OPENAI_API_KEY=sk-... npm run test -w packages/llm
//

const apiKey = process.env.OPENAI_API_KEY;
const TIMEOUT = 60_000;

describe.skipIf(!apiKey)("OpenAIClient (hot)", () => {
  describe.each(HOT_MODELS.openai)("%s", (MODEL) => {
    describe("chat.completions.create", () => {
      it(
        "returns assistant text from the live endpoint",
        async () => {
          const client = new OpenAIClient({ apiKey: apiKey! });
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
          const client = new OpenAIClient({ apiKey: apiKey! });
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

    describe("OpenAiProvider.operate", () => {
      it(
        "completes a text turn end-to-end",
        async () => {
          const provider = new OpenAiProvider(MODEL, { apiKey: apiKey! });
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
          const provider = new OpenAiProvider(MODEL, { apiKey: apiKey! });
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
