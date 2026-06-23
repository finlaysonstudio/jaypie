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
 * Strip a single pair of surrounding double quotes from a key, if present.
 * `"Merchant Request"` -> `Merchant Request`; `Confidence` -> `Confidence`.
 */
function dequoteKey(key: string): string {
  if (key.length >= 2 && key.startsWith('"') && key.endsWith('"')) {
    return key.slice(1, -1);
  }
  return key;
}

/**
 * Walk a JSON Schema alongside a parsed value, renaming any object key whose
 * de-quoted form matches a declared property name. Recurses into declared
 * object properties and array items so nested corrupted keys are also repaired.
 */
function repairFromSchema(schema: unknown, value: unknown): unknown {
  if (!isPlainObject(schema)) {
    return value;
  }

  const type = schema.type;
  const isArray = type === "array" || (type === undefined && "items" in schema);
  if (isArray) {
    const items = schema.items;
    if (Array.isArray(value) && isPlainObject(items)) {
      return value.map((entry) => repairFromSchema(items, entry));
    }
    return value;
  }

  const isObject =
    type === "object" || (type === undefined && "properties" in schema);
  if (isObject && isPlainObject(value)) {
    const properties = schema.properties;
    if (isPlainObject(properties)) {
      const declared = new Set(Object.keys(properties));
      // Repair keys: rename a quote-wrapped key to its declared form, unless
      // the correct key is already present (then drop the corrupted duplicate).
      for (const key of Object.keys(value)) {
        if (declared.has(key)) {
          continue;
        }
        const repaired = dequoteKey(key);
        if (repaired !== key && declared.has(repaired)) {
          if (!(repaired in value)) {
            value[repaired] = value[key];
          }
          delete value[key];
        }
      }
      // Recurse into declared properties now that keys are aligned.
      for (const [key, propSchema] of Object.entries(properties)) {
        if (key in value) {
          value[key] = repairFromSchema(propSchema, value[key]);
        }
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
 * Repair structured-output keys that a provider/model corrupted by wrapping
 * them in literal double quotes (observed on OpenAI for multi-word `format`
 * keys: `Merchant Request` returned as `"Merchant Request"`). A declared
 * `format` is a schema contract: returned keys should match the declared names
 * exactly. Any returned key whose de-quoted form matches a declared key is
 * renamed back to the declared key.
 *
 * Only mutates a (cloned) structured object; strings and non-objects pass
 * through untouched.
 */
export function repairFormatKeys({
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
  return repairFromSchema(schema, structuredClone(content)) as JsonObject;
}
