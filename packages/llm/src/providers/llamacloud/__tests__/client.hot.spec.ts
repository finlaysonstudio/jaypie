import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { MODEL } from "../../../constants.js";
import { LlamaCloudProvider } from "../LlamaCloudProvider.class.js";

//
//
// Hot tests
//
// Live tests against the real LlamaCloud Parse API. Skipped unless
// LLAMA_CLOUD_API_KEY is set, so CI stays green and `npm test` runs them
// automatically with a key.
//
//   LLAMA_CLOUD_API_KEY=... npm run test -w packages/llm
//
// A parse is a job that polls to completion, so the timeout is generous.
//

const apiKey = process.env.LLAMA_CLOUD_API_KEY;
const TIMEOUT = 300_000;

describe.skipIf(!apiKey)("LlamaCloudProvider (hot)", () => {
  it(
    "extracts page markdown from an uploaded PDF on the cost-effective tier",
    async () => {
      const pdfPath = fileURLToPath(
        new URL("../../../../test/fixtures/page.pdf", import.meta.url),
      );
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
});
