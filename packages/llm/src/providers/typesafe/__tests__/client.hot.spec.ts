import { describe, expect, it } from "vitest";

import { MODEL } from "../../../constants.js";
import { TypeSafeClient } from "../client.js";

//
//
// Hot tests
//
// Live tests against the real TypeSafe System One API. Skipped unless
// TYPESAFE_API_KEY is set, so CI stays green and `npm test` runs them
// automatically with a key.
//
//   TYPESAFE_API_KEY=... npm run test -w packages/llm
//

const apiKey = process.env.TYPESAFE_API_KEY;
const TIMEOUT = 60_000;

describe.skipIf(!apiKey)("TypeSafeClient (hot)", () => {
  describe("listModels", () => {
    it(
      "lists the System One models",
      async () => {
        const client = new TypeSafeClient({ apiKey: apiKey! });
        const { models } = await client.listModels();
        expect(models.length).toBeGreaterThan(0);
        expect(models.map((model) => model.name)).toContain("jev-latest");
      },
      TIMEOUT,
    );
  });

  describe("systemOne", () => {
    it(
      "answers one question of each type",
      async () => {
        const client = new TypeSafeClient({ apiKey: apiKey! });
        const response = await client.systemOne({
          model: MODEL.JEV,
          questions: {
            department: {
              criteria: { billing: "Charges", technical: "Bugs" },
              instructions: "Which team should handle this?",
              type: "choice",
            },
            frustration: {
              criteria: ["Calm", "Frustrated", "Very angry"],
              instructions: "How frustrated is the customer?",
              type: "score",
            },
            urgent: {
              instructions: "Does this convey urgency?",
              type: "noul",
            },
          },
          state: "I was charged twice and nobody has replied in three days.",
        });
        expect(response.model).toBe(MODEL.JEV);
        expect(response.usage.input_tokens).toBeGreaterThan(0);
        expect(response.answers.department).toMatchObject({
          choice: "billing",
          type: "choice",
        });
        expect(response.answers.urgent).toMatchObject({ type: "noul" });
        expect(response.answers.frustration).toMatchObject({ type: "score" });
      },
      TIMEOUT,
    );
  });
});
