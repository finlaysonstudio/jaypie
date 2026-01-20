// Convert fabric input definitions to Zod schema shape for MCP SDK

import type { z } from "zod";

import { isDateType } from "../resolve-date.js";
import type { ConversionType, InputFieldDefinition } from "../types.js";

/**
 * Zod schema shape for MCP tool registration
 * This is a record of field names to Zod types
 */
export type ZodSchemaShape = Record<string, z.ZodTypeAny>;

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
 * Get the array element type for typed arrays
 */
function getTypedArrayElementType(
  type: ConversionType,
): "boolean" | "number" | "object" | "string" | undefined {
  if (!Array.isArray(type) || type.length !== 1) return undefined;

  const element = type[0];
  if (element === Boolean || element === "boolean") return "boolean";
  if (element === Number || element === "number") return "number";
  if (element === String || element === "string" || element === "")
    return "string";
  if (element === Object || element === "object") return "object";
  if (
    typeof element === "object" &&
    element !== null &&
    !(element instanceof RegExp) &&
    Object.keys(element as Record<string, unknown>).length === 0
  ) {
    return "object";
  }

  return undefined;
}

/**
 * Get enum values for validated types
 */
function getEnumValues(type: ConversionType): string[] | undefined {
  if (!Array.isArray(type)) return undefined;
  if (type.length === 0) return undefined;
  if (type.length === 1 && isTypedArrayConstructor(type[0])) return undefined;

  // Check if it's a validated string type (strings only, no RegExp)
  if (type.every((item) => typeof item === "string")) {
    return type as string[];
  }

  return undefined;
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
 * Convert a single input field definition to a Zod type
 */
function inputFieldToZod(
  z: typeof import("zod").z,
  definition: InputFieldDefinition,
): z.ZodTypeAny {
  const { type } = definition;

  let zodType: z.ZodTypeAny;

  // Handle constructors and primitives
  if (type === Boolean || type === "boolean") {
    zodType = z.boolean();
  } else if (type === Number || type === "number") {
    zodType = z.number();
  } else if (type === String || type === "string") {
    zodType = z.string();
  } else if (type === Object || type === "object") {
    zodType = z.record(z.string(), z.unknown());
  } else if (type === Array || type === "array") {
    zodType = z.array(z.unknown());
  }
  // Handle Date type (represented as string in schema)
  else if (isDateType(type)) {
    zodType = z.string();
  }
  // Handle RegExp (converts to string)
  else if (type instanceof RegExp) {
    zodType = z.string();
  }
  // Handle arrays
  else if (Array.isArray(type)) {
    // Empty array = untyped array
    if (type.length === 0) {
      zodType = z.array(z.unknown());
    }
    // Single-element typed array like [String], [Number], etc.
    else if (type.length === 1 && isTypedArrayConstructor(type[0])) {
      const elementType = getTypedArrayElementType(type);
      switch (elementType) {
        case "boolean":
          zodType = z.array(z.boolean());
          break;
        case "number":
          zodType = z.array(z.number());
          break;
        case "string":
          zodType = z.array(z.string());
          break;
        case "object":
          zodType = z.array(z.record(z.string(), z.unknown()));
          break;
        default:
          zodType = z.array(z.unknown());
      }
    }
    // Validated string type: ["value1", "value2"]
    else {
      const enumValues = getEnumValues(type);
      if (enumValues && enumValues.length >= 2) {
        zodType = z.enum(enumValues as [string, ...string[]]);
      } else if (enumValues && enumValues.length === 1) {
        zodType = z.literal(enumValues[0]);
      } else {
        // Fallback for other array types (including RegExp arrays)
        zodType = z.string();
      }
    }
  }
  // Default to string
  else {
    zodType = z.string();
  }

  // Add description
  if (definition.description) {
    zodType = zodType.describe(definition.description);
  }

  // Handle optionality and defaults
  if (!isFieldRequired(definition)) {
    if (definition.default !== undefined) {
      zodType = zodType.optional().default(definition.default);
    } else {
      zodType = zodType.optional();
    }
  }

  return zodType;
}

/**
 * Convert fabric input definitions to a Zod schema shape for MCP SDK
 *
 * @param z - The zod module (passed in to avoid optional dependency import)
 * @param input - The input definitions from the service
 * @returns Zod schema shape object compatible with MCP server.tool()
 */
export function inputToZodShape(
  z: typeof import("zod").z,
  input?: Record<string, InputFieldDefinition>,
): ZodSchemaShape {
  if (!input) {
    return {};
  }

  const shape: ZodSchemaShape = {};

  // Sort keys alphabetically for consistency
  const sortedKeys = Object.keys(input).sort();

  for (const key of sortedKeys) {
    const definition = input[key];
    shape[key] = inputFieldToZod(z, definition);
  }

  return shape;
}
