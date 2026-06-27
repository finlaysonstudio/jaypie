import { describe, expect, it } from "vitest";

import { PROVIDER } from "../../../constants.js";
import { AnthropicClient } from "../client.js";
import { AnthropicProvider } from "../AnthropicProvider.class.js";

//
//
// Hot tests
//
// Live tests against the real Anthropic Messages API. Skipped unless
// ANTHROPIC_API_KEY is set, so CI stays green and `npm test` runs them
// automatically with a key.
//
//   ANTHROPIC_API_KEY=sk-ant-... npm run test -w packages/llm
//

const apiKey = process.env.ANTHROPIC_API_KEY;
const MODEL = PROVIDER.ANTHROPIC.MODEL.TINY;
const TIMEOUT = 60_000;

describe.skipIf(!apiKey)("AnthropicClient (hot)", () => {
  describe("messages.create", () => {
    it(
      "returns assistant text from the live endpoint",
      async () => {
        const client = new AnthropicClient({ apiKey: apiKey! });
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: 64,
          messages: [
            { role: "user", content: "Reply with the single word: pong" },
          ],
        });
        const block = response.content.find((b) => b.type === "text");
        const text = block && "text" in block ? block.text : "";
        expect(text.toLowerCase()).toContain("pong");
      },
      TIMEOUT,
    );

    it(
      "streams text deltas",
      async () => {
        const client = new AnthropicClient({ apiKey: apiKey! });
        const stream = await client.messages.create({
          model: MODEL,
          max_tokens: 64,
          messages: [{ role: "user", content: "Count: one two three" }],
          stream: true,
        });

        let text = "";
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            text += event.delta.text;
          }
        }
        expect(text.length).toBeGreaterThan(0);
      },
      TIMEOUT,
    );
  });

  describe("AnthropicProvider.operate", () => {
    it(
      "completes a text turn end-to-end",
      async () => {
        const provider = new AnthropicProvider(MODEL, { apiKey: apiKey! });
        const response = await provider.operate(
          "Reply with the single word: pong",
        );
        expect(String(response.content).toLowerCase()).toContain("pong");
      },
      TIMEOUT,
    );

    it(
      "returns structured output via native output_config",
      async () => {
        const provider = new AnthropicProvider(MODEL, { apiKey: apiKey! });
        const response = await provider.operate("Give the capital of France.", {
          format: { capital: String },
        });
        expect(response.content).toMatchObject({ capital: expect.any(String) });
      },
      TIMEOUT,
    );
  });
});
