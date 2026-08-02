import { describe, expect, it } from "vitest";

import { HOT_MODELS } from "../../../__tests__/hotModels.js";
import { MistralClient } from "../client.js";
import { MistralProvider } from "../MistralProvider.class.js";

//
//
// Hot tests
//
// Live tests against the real Mistral API. Skipped unless MISTRAL_API_KEY is
// set, so CI stays green and `npm test` runs them automatically on machines
// that have a key.
//
//   MISTRAL_API_KEY=... npm run test -w packages/llm
//
// Note Mistral's rate limits are tight and it sends no Retry-After header, so
// these run serially by virtue of describe.each and may need a rerun.
//

const apiKey = process.env.MISTRAL_API_KEY;
const TIMEOUT = 120_000;

describe.skipIf(!apiKey)("MistralClient (hot)", () => {
  describe.each(HOT_MODELS.mistral)("%s", (MODEL) => {
    describe("chatCompletion", () => {
      it(
        "returns assistant text from the live endpoint",
        async () => {
          const client = new MistralClient({ apiKey: apiKey! });
          const response = (await client.chatCompletion({
            model: MODEL,
            messages: [
              { role: "user", content: "Reply with the single word: pong" },
            ],
            max_tokens: 20,
          })) as { choices: Array<{ message: { content: string } }> };

          const content = response.choices?.[0]?.message?.content ?? "";
          expect(String(content).toLowerCase()).toContain("pong");
        },
        TIMEOUT,
      );

      it(
        "rejects unknown request fields with a legible 422",
        async () => {
          // Mistral is the one OpenAI-compatible provider that hard-fails on
          // extra fields. The adapter depends on this staying true — if it
          // ever relaxes, `user` could be forwarded again.
          const client = new MistralClient({ apiKey: apiKey! });
          await expect(
            client.chatCompletion({
              model: MODEL,
              messages: [{ role: "user", content: "hi" }],
              max_tokens: 5,
              user: "jaypie-hot-test",
            }),
          ).rejects.toThrow(/Extra inputs are not permitted/);
        },
        TIMEOUT,
      );
    });

    describe("streamChatCompletion", () => {
      it(
        "streams text deltas and a usage chunk",
        async () => {
          const client = new MistralClient({ apiKey: apiKey! });
          let text = "";
          let sawUsage = false;
          for await (const chunk of client.streamChatCompletion({
            model: MODEL,
            messages: [{ role: "user", content: "Count: one two three" }],
            max_tokens: 30,
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

    describe("MistralProvider.operate", () => {
      it(
        "completes a text turn end-to-end",
        async () => {
          const provider = new MistralProvider(MODEL, { apiKey: apiKey! });
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
          const provider = new MistralProvider(MODEL, { apiKey: apiKey! });
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

  describe("ocr", () => {
    it(
      "extracts page markdown from a base64 PDF",
      async () => {
        const { readFileSync } = await import("node:fs");
        const { fileURLToPath } = await import("node:url");
        const pdfPath = fileURLToPath(
          new URL("../../../../test/fixtures/page.pdf", import.meta.url),
        );
        const base64 = readFileSync(pdfPath).toString("base64");

        const provider = new MistralProvider(undefined, { apiKey: apiKey! });
        const result = await provider.ocr({
          document: {
            type: "document_url",
            document_url: `data:application/pdf;base64,${base64}`,
          },
        });

        expect(result.pages.length).toBeGreaterThan(0);
        expect(result.markdown.toLowerCase()).toContain("mock page");
      },
      TIMEOUT,
    );
  });
});
