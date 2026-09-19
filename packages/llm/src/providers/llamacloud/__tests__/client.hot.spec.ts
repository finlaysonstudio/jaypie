import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { MODEL } from "../../../constants.js";
import Llm from "../../../Llm.js";
import { LlamaCloudProvider } from "../LlamaCloudProvider.class.js";

//
//
// Hot tests
//
// Live tests against the real LlamaCloud Parse API. Skipped unless
// LLAMA_CLOUD_API_KEY is set, so CI stays green and `npm test` runs them
// automatically with a key. The Unit Test job in both workflows passes
// CICD_LLAMA_CLOUD_API_KEY, so these run on every push.
//
//   LLAMA_CLOUD_API_KEY=... npm run test -w packages/llm
//
// A parse is a job that polls to completion, so the timeout is generous.
//

const apiKey = process.env.LLAMA_CLOUD_API_KEY;
const TIMEOUT = 300_000;

/** Resolves to the llamacloud provider by match word, then fails at the API */
const MISSING_TIER = "llamaparse-does-not-exist";

const pdfPath = fileURLToPath(
  new URL("../../../../test/fixtures/page.pdf", import.meta.url),
);

describe.skipIf(!apiKey)("LlamaCloudProvider (hot)", () => {
  it(
    "extracts page markdown from an uploaded PDF on the cost-effective tier",
    async () => {
      const provider = new LlamaCloudProvider(MODEL.LLAMAPARSE.COST_EFFECTIVE, {
        apiKey: apiKey!,
      });
      const result = await provider.ocr({
        data: readFileSync(pdfPath).toString("base64"),
        file: "page.pdf",
      });

      expect(result.pages.length).toBeGreaterThan(0);
      expect(result.pages[0].page).toBe(1);
      expect(result.markdown.toLowerCase()).toContain("mock page");
      expect(result.usage.pages).toBeGreaterThan(0);
      expect(result.model).toContain(MODEL.LLAMAPARSE.COST_EFFECTIVE);
    },
    TIMEOUT,
  );

  describe("Fallback", () => {
    it(
      "falls from a tier the API rejects to the cost-effective tier",
      async () => {
        // Simulates a failing primary engine: the id resolves to this
        // provider but the API has no such tier, so the chain moves on to a
        // real tier on the same key and the transcription stays native.
        const response = await Llm.ocr(
          {
            data: readFileSync(pdfPath).toString("base64"),
            file: "page.pdf",
          },
          {
            apiKey: apiKey!,
            model: [MISSING_TIER, MODEL.LLAMAPARSE.COST_EFFECTIVE],
          },
        );

        expect(response.fallbackUsed).toBe(true);
        expect(response.fallbackAttempts).toBe(2);
        expect(response.emulated).toBe(false);
        expect(response.model).toContain(MODEL.LLAMAPARSE.COST_EFFECTIVE);
        expect(response.markdown.toLowerCase()).toContain("mock page");
      },
      TIMEOUT,
    );
  });
});
