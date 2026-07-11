import { describe, expect, it } from "vitest";

import { HOT_MODELS } from "../../../__tests__/hotModels.js";
import { GoogleClient } from "../client.js";
import { GoogleProvider } from "../GoogleProvider.class.js";

//
//
// Hot tests
//
// Live tests against the real Gemini API. Skipped unless GEMINI_API_KEY is
// set, so CI stays green and `npm test` runs them automatically with a key.
//
//   GEMINI_API_KEY=... npm run test -w packages/llm
//

const apiKey = process.env.GEMINI_API_KEY;
const TIMEOUT = 60_000;

describe.skipIf(!apiKey)("GoogleClient (hot)", () => {
  describe.each(HOT_MODELS.google)("%s", (MODEL) => {
    describe("generateContent", () => {
      it(
        "returns text from the live endpoint",
        async () => {
          const client = new GoogleClient({ apiKey: apiKey! });
          const response = await client.models.generateContent({
            model: MODEL,
            contents: [
              {
                role: "user",
                parts: [{ text: "Reply with the single word: pong" }],
              },
            ],
          });
          expect((response.text ?? "").toLowerCase()).toContain("pong");
        },
        TIMEOUT,
      );
    });

    describe("generateContentStream", () => {
      it(
        "streams text chunks",
        async () => {
          const client = new GoogleClient({ apiKey: apiKey! });
          const stream = await client.models.generateContentStream({
            model: MODEL,
            contents: [
              { role: "user", parts: [{ text: "Count: one two three" }] },
            ],
          });

          let text = "";
          for await (const chunk of stream) {
            const part = chunk.candidates?.[0]?.content?.parts?.[0];
            if (part?.text) text += part.text;
          }
          expect(text.length).toBeGreaterThan(0);
        },
        TIMEOUT,
      );
    });

    describe("GoogleProvider.operate", () => {
      it(
        "completes a text turn end-to-end",
        async () => {
          const provider = new GoogleProvider(MODEL, { apiKey: apiKey! });
          const response = await provider.operate(
            "Reply with the single word: pong",
          );
          expect(String(response.content).toLowerCase()).toContain("pong");
        },
        TIMEOUT,
      );

      it(
        "returns native structured output",
        async () => {
          const provider = new GoogleProvider(MODEL, { apiKey: apiKey! });
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
