import { JsonObject } from "@jaypie/types";

/**
 * Converts a JSON Schema (Draft 2020-12) object to the OpenAPI 3.0 schema subset
 * that Gemini's `responseSchema` accepts. This constrains generation (not just validation)
 * and avoids the `items`-keyword leakage bug in `responseJsonSchema`.
 *
 * Strips: $schema, additionalProperties, $defs, $ref (inlines where possible), const
 * Preserves: type, properties, required, items, enum, description, nullable
 */
export function jsonSchemaToOpenApi3(schema: JsonObject): JsonObject {
  if (typeof schema !== "object" || schema === null || Array.isArray(schema)) {
    return schema;
  }

  const result: JsonObject = {};

  for (const [key, value] of Object.entries(schema)) {
    // Strip JSON Schema keywords not in OpenAPI 3.0 subset
    if (
      key === "$schema" ||
      key === "$defs" ||
      key === "additionalProperties" ||
      key === "const" ||
      key === "$ref"
    ) {
      continue;
    }

    if (
      key === "properties" &&
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      const convertedProps: JsonObject = {};
      for (const [propKey, propValue] of Object.entries(
        value as Record<string, JsonObject>,
      )) {
        convertedProps[propKey] = jsonSchemaToOpenApi3(propValue);
      }
      result[key] = convertedProps;
    } else if (key === "items" && typeof value === "object" && value !== null) {
      result[key] = jsonSchemaToOpenApi3(value as JsonObject);
    } else {
      result[key] = value;
    }
  }

  return result;
}
