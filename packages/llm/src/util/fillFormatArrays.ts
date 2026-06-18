import { z } from "zod/v4";
import { JsonObject, NaturalSchema } from "@jaypie/types";

import { naturalZodSchema } from "./naturalZodSchema.js";

//
//
// Types
//

type Format = JsonObject | NaturalSchema | z.ZodType;

//
//
// Helpers
//

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Convert a `format` declaration (Zod schema, NaturalSchema, or a JSON Schema
 * JsonObject) into a plain JSON Schema we can walk. Mirrors the conversion the
 * provider adapters perform in `formatOutputSchema`, but without any
 * provider-specific sanitization.
 */
function formatToJsonSchema(format: Format): JsonObject | undefined {
  if (format instanceof z.ZodType) {
    return z.toJSONSchema(format) as JsonObject;
  }
  if (isPlainObject(format) && (format as JsonObject).type === "json_schema") {
    const clone = structuredClone(format) as JsonObject;
    clone.type = "object";
    return clone;
  }
  try {
    return z.toJSONSchema(
      naturalZodSchema(format as NaturalSchema),
    ) as JsonObject;
  } catch {
    return undefined;
  }
}

/**
 * Walk a JSON Schema alongside a parsed value, filling any declared array field
 * that is absent (`undefined`/`null`) with `[]`. Recurses into object
 * properties and array items so nested declared arrays are also backfilled.
 */
function fillFromSchema(schema: unknown, value: unknown): unknown {
  if (!isPlainObject(schema)) {
    return value;
  }

  const type = schema.type;
  const isArray = type === "array" || (type === undefined && "items" in schema);
  if (isArray) {
    if (value === undefined || value === null) {
      return [];
    }
    const items = schema.items;
    if (Array.isArray(value) && isPlainObject(items)) {
      return value.map((entry) => fillFromSchema(items, entry));
    }
    return value;
  }

  const isObject =
    type === "object" || (type === undefined && "properties" in schema);
  if (isObject) {
    if (!isPlainObject(value)) {
      return value;
    }
    const properties = schema.properties;
    if (isPlainObject(properties)) {
      for (const [key, propSchema] of Object.entries(properties)) {
        value[key] = fillFromSchema(propSchema, value[key]);
      }
    }
    return value;
  }

  return value;
}

//
//
// Main
//

/**
 * Ensure every array field declared in `format` is present in `content` as an
 * array. A declared `format` is a schema contract: an empty list should surface
 * as `[]`, not be dropped from the response. Some providers/models omit empty
 * array fields entirely, leaving consumers to read `.length` on `undefined`.
 *
 * Only mutates a (cloned) structured object; strings and non-objects pass
 * through untouched.
 */
export function fillFormatArrays({
  content,
  format,
}: {
  content: JsonObject;
  format: Format;
}): JsonObject {
  const schema = formatToJsonSchema(format);
  if (!schema) {
    return content;
  }
  return fillFromSchema(schema, structuredClone(content)) as JsonObject;
}
