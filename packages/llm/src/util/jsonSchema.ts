import log from "@jaypie/logger";
import { JsonObject, NaturalSchema, NaturalSchemaObject } from "@jaypie/types";
import { z } from "zod/v4";

import { naturalZodSchema } from "./naturalZodSchema.js";

// Keywords a JSON Schema object node can carry that Natural Schema has no
// representation for. Anything present here (or any other unrecognized key)
// is dropped silently and logged, never thrown.
const LOSSY_OBJECT_KEYWORDS = [
  "$defs",
  "$id",
  "$ref",
  "$schema",
  "additionalProperties",
  "const",
  "default",
  "description",
  "format",
  "maxLength",
  "maximum",
  "minLength",
  "minimum",
  "multipleOf",
  "nullable",
  "allOf",
  "anyOf",
  "oneOf",
  "pattern",
] as const;

const KNOWN_KEYWORDS = new Set<string>([
  "type",
  "properties",
  "required",
  "items",
  "enum",
  ...LOSSY_OBJECT_KEYWORDS,
]);

/**
 * Duck-type check for a bare JSON Schema object node: `{ type: "object", properties: {...} }`.
 * Does not require the OpenAI-style `{ type: "json_schema", ... }` envelope.
 */
export function isJsonSchema(value: unknown): value is JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const schema = value as JsonObject;
  return (
    schema.type === "object" &&
    typeof schema.properties === "object" &&
    schema.properties !== null &&
    !Array.isArray(schema.properties)
  );
}

/**
 * Convert a Natural Schema to JSON Schema. Lossless: Natural Schema is a
 * strict subset of what JSON Schema can express.
 */
export function naturalSchemaToJsonSchema(schema: NaturalSchema): JsonObject {
  return z.toJSONSchema(naturalZodSchema(schema)) as JsonObject;
}

function logDroppedKeywords(schema: JsonObject, path: string): void {
  for (const key of Object.keys(schema)) {
    if (!KNOWN_KEYWORDS.has(key)) {
      log.debug(
        `[jsonSchemaToNaturalSchema] Dropping unrecognized keyword "${key}" at "${path}"`,
      );
    } else if (
      (LOSSY_OBJECT_KEYWORDS as readonly string[]).includes(key) &&
      schema[key] !== undefined
    ) {
      log.debug(
        `[jsonSchemaToNaturalSchema] Dropping unsupported keyword "${key}" at "${path}"`,
      );
    }
  }
}

function convertNode(schema: JsonObject, path: string): NaturalSchema {
  logDroppedKeywords(schema, path);

  if (Array.isArray(schema.enum)) {
    return schema.enum as string[];
  }

  switch (schema.type) {
    case "string":
      return String;
    case "number":
    case "integer":
      return Number;
    case "boolean":
      return Boolean;
    case "array": {
      const items = schema.items;
      if (typeof items !== "object" || items === null || Array.isArray(items)) {
        return Array;
      }
      return [convertNode(items as JsonObject, `${path}[]`)];
    }
    case "object": {
      const properties = schema.properties as
        Record<string, JsonObject> | undefined;
      if (!properties || Object.keys(properties).length === 0) {
        return Object;
      }
      const required = new Set(
        Array.isArray(schema.required) ? (schema.required as string[]) : [],
      );
      const result: NaturalSchemaObject = {};
      for (const [key, value] of Object.entries(properties)) {
        if (!required.has(key)) {
          log.debug(
            `[jsonSchemaToNaturalSchema] Field "${path}.${key}" is optional; Natural Schema has no optional marker — treating as required`,
          );
        }
        result[key] = convertNode(value, `${path}.${key}`);
      }
      return result;
    }
    default:
      log.debug(
        `[jsonSchemaToNaturalSchema] Unsupported type "${String(schema.type)}" at "${path}"; defaulting to Object`,
      );
      return Object;
  }
}

/**
 * Convert a JSON Schema object node to Natural Schema. Lossy: constraints,
 * descriptions, defaults, unions, and optionality have no Natural Schema
 * representation. Dropped keywords are logged at debug level, never thrown.
 */
export function jsonSchemaToNaturalSchema(schema: JsonObject): NaturalSchema {
  return convertNode(schema, "$");
}
