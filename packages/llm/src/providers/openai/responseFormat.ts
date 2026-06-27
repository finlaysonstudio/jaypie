import { JsonObject } from "@jaypie/types";
import { z } from "zod/v4";

//
//
// Types
//

export interface JsonSchemaResponseFormat {
  type: "json_schema";
  json_schema: {
    name: string;
    strict: boolean;
    schema: JsonObject;
  };
}

//
//
// Main
//

/**
 * Local replacement for `openai/helpers/zod`'s `zodResponseFormat`. Builds the
 * `response_format` payload OpenAI's Chat Completions / Responses APIs expect
 * from a Zod schema. The SDK always emits `strict: true`; callers re-derive or
 * sanitize `schema` as needed (e.g. forcing `additionalProperties: false`).
 */
export function zodResponseFormat(
  schema: z.ZodType,
  name: string,
): JsonSchemaResponseFormat {
  return {
    type: "json_schema",
    json_schema: {
      name,
      strict: true,
      schema: z.toJSONSchema(schema) as JsonObject,
    },
  };
}
