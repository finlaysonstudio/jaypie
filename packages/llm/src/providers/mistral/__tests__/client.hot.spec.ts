import { describe, expect, it } from "vitest";

import { HOT_MODELS } from "../../../__tests__/hotModels.js";
import { MODEL as CATALOG } from "../../../constants.js";
import Llm from "../../../Llm.js";
import { MistralClient } from "../client.js";
import { MistralProvider } from "../MistralProvider.class.js";

//
//
// Hot tests
//
// Live tests against the real Mistral API. Skipped unless MISTRAL_API_KEY is
// set, so CI stays green and `npm test` runs them automatically on machines
// that have a key. The Unit Test job in both workflows passes
// CICD_MISTRAL_API_KEY, so these run on every push.
//
//   MISTRAL_API_KEY=... npm run test -w packages/llm
//
// Note Mistral's rate limits are tight and it sends no Retry-After header, so
// these run serially by virtue of describe.each and may need a rerun.
//

const apiKey = process.env.MISTRAL_API_KEY;
const TIMEOUT = 120_000;

/** Resolves to the mistral provider by match word, then fails at the API */
const MISSING_ENGINE = "mistral-ocr-does-not-exist";

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
        const result = await provider.ocr(
          `data:application/pdf;base64,${base64}`,
        );

        expect(result.pages.length).toBeGreaterThan(0);
        expect(result.pages[0].page).toBe(1);
        expect(result.markdown.toLowerCase()).toContain("mock page");
        expect(result.usage.pages).toBeGreaterThan(0);
        expect(result.usage.cost).toBeGreaterThan(0);
      },
      TIMEOUT,
    );

    it(
      "inlines tables, describes images, and labels signatures",
      async () => {
        const { readFileSync } = await import("node:fs");
        const { fileURLToPath } = await import("node:url");
        const scanPath = fileURLToPath(
          new URL("../../../../test/fixtures/notarized.png", import.meta.url),
        );
        const base64 = readFileSync(scanPath).toString("base64");

        const provider = new MistralProvider(undefined, { apiKey: apiKey! });
        const result = await provider.ocr(`data:image/png;base64,${base64}`, {
          tables: "markdown",
        });

        // Table content, not a [tbl-0.md](tbl-0.md) placeholder
        expect(result.markdown).toContain("A-101");
        expect(result.markdown).not.toMatch(/\[tbl-\d+\.\w+\]/);
        // Every image is described, and the description is its alt text
        expect(result.images.length).toBeGreaterThan(0);
        for (const image of result.images) {
          expect(image.description).toBeTruthy();
          expect(result.markdown).not.toContain(`![${image.id}]`);
        }
        expect(result.markdown).toMatch(/\[Signature: [^\]]+\]/);
      },
      TIMEOUT,
    );

    describe("Fallback", () => {
      it(
        "falls from an engine the API rejects to Mistral OCR",
        async () => {
          // Simulates a failing primary engine: the id resolves to this
          // provider but the API has no such model, so the chain moves on to
          // the real engine on the same key and the transcription stays
          // native.
          const { readFileSync } = await import("node:fs");
          const { fileURLToPath } = await import("node:url");
          const pdfPath = fileURLToPath(
            new URL("../../../../test/fixtures/page.pdf", import.meta.url),
          );
          const base64 = readFileSync(pdfPath).toString("base64");

          const response = await Llm.ocr(
            `data:application/pdf;base64,${base64}`,
            {
              apiKey: apiKey!,
              model: [MISSING_ENGINE, CATALOG.MISTRAL.OCR],
            },
          );

          expect(response.fallbackUsed).toBe(true);
          expect(response.fallbackAttempts).toBe(2);
          expect(response.emulated).toBe(false);
          expect(response.model).toBe(CATALOG.MISTRAL.OCR);
          expect(response.markdown.toLowerCase()).toContain("mock page");
        },
        TIMEOUT,
      );
    });
  });
});
