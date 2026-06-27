import { describe, expect, it } from "vitest";

import { PROVIDER } from "../../../constants.js";
import { OpenAIClient } from "../../openai/client.js";
import { XaiProvider } from "../XaiProvider.class.js";

//
//
// Hot tests
//
// Live tests against the real xAI API (OpenAI-compatible, custom base URL).
// Skipped unless XAI_API_KEY is set, so CI stays green and `npm test` runs them
// automatically with a key.
//
//   XAI_API_KEY=xai-... npm run test -w packages/llm
//

const apiKey = process.env.XAI_API_KEY;
const MODEL = PROVIDER.XAI.MODEL.TINY;
const TIMEOUT = 60_000;

describe.skipIf(!apiKey)("XaiClient (hot)", () => {
  describe("chat.completions.create", () => {
    it(
      "returns assistant text from the live xAI endpoint",
      async () => {
        const client = new OpenAIClient({
          apiKey: apiKey!,
          baseURL: PROVIDER.XAI.BASE_URL,
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
          baseURL: PROVIDER.XAI.BASE_URL,
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

  describe("XaiProvider.operate", () => {
    it(
      "completes a text turn end-to-end",
      async () => {
        const provider = new XaiProvider(MODEL, { apiKey: apiKey! });
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
        const provider = new XaiProvider(MODEL, { apiKey: apiKey! });
        const response = await provider.operate("Give the capital of France.", {
          format: { capital: String },
        });
        expect(response.content).toMatchObject({ capital: expect.any(String) });
      },
      TIMEOUT,
    );
  });
});
