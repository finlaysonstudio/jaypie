import { describe, expect, it } from "vitest";
import { z } from "zod/v4";

import { openAiAdapter } from "../OpenAiAdapter.js";

//
//
// Tests
//

// These exercise the REAL zod -> JSON Schema conversion (no zod mock) to guard
// the OpenAI strict structured-output contract. zod v4's z.toJSONSchema emits a
// draft-2020-12 `$schema` keyword that is not part of OpenAI's supported strict
// subset; shipping it can leave strict enforcement silently disabled, after
// which the model free-forms (omitting required fields, corrupting keys). See
// issue #393 and its sibling array-omission bug.
describe("OpenAiAdapter formatOutputSchema (real zod)", () => {
  describe("Error Conditions", () => {
    it("strips the draft-2020-12 $schema keyword", () => {
      const out = openAiAdapter.formatOutputSchema({
        "Merchant Request": String,
      }) as Record<string, unknown>;
      const schema = out.schema as Record<string, unknown>;
      expect("$schema" in schema).toBe(false);
    });
  });

  describe("Features", () => {
    it("preserves multi-word property names verbatim", () => {
      const out = openAiAdapter.formatOutputSchema({
        "Merchant Request": String,
        Confidence: Number,
        "Recommended Actions": [String],
      }) as Record<string, unknown>;
      const schema = out.schema as Record<string, unknown>;
      const properties = schema.properties as Record<string, unknown>;
      expect(Object.keys(properties).sort()).toEqual([
        "Confidence",
        "Merchant Request",
        "Recommended Actions",
      ]);
    });

    it("produces a strict, closed schema (additionalProperties false)", () => {
      const out = openAiAdapter.formatOutputSchema({
        "Merchant Request": String,
      }) as Record<string, unknown>;
      const schema = out.schema as Record<string, unknown>;
      expect(out.strict).toBe(true);
      expect(out.type).toBe("json_schema");
      expect(schema.additionalProperties).toBe(false);
    });

    it("strips $schema from a Zod schema declaration too", () => {
      const out = openAiAdapter.formatOutputSchema(
        z.object({ "Merchant Request": z.string() }),
      ) as Record<string, unknown>;
      const schema = out.schema as Record<string, unknown>;
      expect("$schema" in schema).toBe(false);
      expect(schema.additionalProperties).toBe(false);
    });
  });
});
