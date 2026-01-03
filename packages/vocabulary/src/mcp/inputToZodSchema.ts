// Convert vocabulary input definitions to Zod schema

import { z } from "zod";

import type { CoercionType, InputFieldDefinition } from "../types.js";
import type { ZodSchemaRecord } from "./types.js";

/**
 * Check if a single-element array is a typed array type constructor.
 */
function isTypedArrayConstructor(element: unknown): boolean {
  return (
    element === Boolean ||
    element === Number ||
    element === String ||
    element === Object ||
    element === "boolean" ||
    element === "number" ||
    element === "string" ||
    element === "object" ||
    element === "" ||
    (typeof element === "object" &&
      element !== null &&
      !(element instanceof RegExp) &&
      Object.keys(element as Record<string, unknown>).length === 0)
  );
}

/**
 * Get the base Zod type for a vocabulary type
 */
function getBaseZodType(type: CoercionType): z.ZodTypeAny {
  // Handle constructors
  if (type === Boolean || type === "boolean") return z.boolean();
  if (type === Number || type === "number") return z.number();
  if (type === String || type === "string") return z.string();
  if (type === Object || type === "object")
    return z.record(z.string(), z.any());
  if (type === Array || type === "array") return z.array(z.any());

  // Handle RegExp (coerces to string)
  if (type instanceof RegExp) return z.string();

  // Handle arrays
  if (Array.isArray(type)) {
    // Empty array = untyped array
    if (type.length === 0) return z.array(z.any());

    // Single-element typed array like [String], [Number], etc.
    if (type.length === 1 && isTypedArrayConstructor(type[0])) {
      const element = type[0];
      if (element === Boolean || element === "boolean") {
        return z.array(z.boolean());
      }
      if (element === Number || element === "number") {
        return z.array(z.number());
      }
      if (element === String || element === "string" || element === "") {
        return z.array(z.string());
      }
      if (element === Object || element === "object") {
        return z.array(z.record(z.string(), z.any()));
      }
      if (
        typeof element === "object" &&
        element !== null &&
        !(element instanceof RegExp) &&
        Object.keys(element as Record<string, unknown>).length === 0
      ) {
        return z.array(z.record(z.string(), z.any()));
      }
    }

    // Validated string type: ["value1", "value2"] (strings only, no RegExp)
    if (type.every((item) => typeof item === "string")) {
      return z.enum(type as [string, ...string[]]);
    }

    // Validated string type with RegExp: can't express in Zod enum, use string
    if (
      type.every((item) => typeof item === "string" || item instanceof RegExp)
    ) {
      return z.string();
    }

    // Validated number type: [1, 2, 3]
    if (type.every((item) => typeof item === "number")) {
      // Zod doesn't have native number enum, use union of literals
      type ZodLiteralNumber = z.ZodType<number>;
      const literals = type.map((n) => z.literal(n) as ZodLiteralNumber);
      if (literals.length === 1) {
        return literals[0];
      }
      return z.union([literals[0], literals[1], ...literals.slice(2)]);
    }
  }

  // Default to string
  return z.string();
}

/**
 * Check if a field is required
 */
function isFieldRequired(definition: InputFieldDefinition): boolean {
  if (definition.required === false) {
    return false;
  }
  if (definition.default !== undefined) {
    return false;
  }
  return true;
}

/**
 * Convert a single input field definition to Zod schema
 */
function inputFieldToZodSchema(definition: InputFieldDefinition): z.ZodTypeAny {
  let schema = getBaseZodType(definition.type);

  // Add description
  if (definition.description) {
    schema = schema.describe(definition.description);
  }

  // Make optional if not required
  if (!isFieldRequired(definition)) {
    schema = schema.optional();
  }

  return schema;
}

/**
 * Convert vocabulary input definitions to Zod schema record
 *
 * @param input - The vocabulary input definitions
 * @param options - Conversion options
 * @returns Zod schema record compatible with MCP server.tool()
 */
export function inputToZodSchema(
  input?: Record<string, InputFieldDefinition>,
  options: { exclude?: string[] } = {},
): ZodSchemaRecord {
  const { exclude = [] } = options;

  if (!input) {
    return {};
  }

  const schema: ZodSchemaRecord = {};

  // Sort keys alphabetically
  const sortedKeys = Object.keys(input).sort();

  for (const key of sortedKeys) {
    // Skip excluded fields
    if (exclude.includes(key)) {
      continue;
    }

    schema[key] = inputFieldToZodSchema(input[key]);
  }

  return schema;
}
