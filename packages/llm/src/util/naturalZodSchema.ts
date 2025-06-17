import { z } from "zod/v4";
import { NaturalSchema } from "@jaypie/types";

export function naturalZodSchema(definition: NaturalSchema): z.ZodTypeAny {
  if (Array.isArray(definition)) {
    if (definition.length === 0) {
      // Handle empty array - accept any[]
      return z.array(z.any());
    } else if (definition.length === 1) {
      // Handle array types
      const itemType = definition[0];
      switch (itemType) {
        case String:
          return z.array(z.string());
        case Number:
          return z.array(z.number());
        case Boolean:
          return z.array(z.boolean());
        default:
          if (typeof itemType === "object") {
            // Handle array of objects
            return z.array(naturalZodSchema(itemType));
          }
          // Handle enum arrays
          return z.enum(definition as [string, ...string[]]);
      }
    } else {
      // Handle enum arrays
      return z.enum(definition as [string, ...string[]]);
    }
  } else if (definition && typeof definition === "object") {
    if (Object.keys(definition).length === 0) {
      // Handle empty object - accept any key-value pairs
      return z.record(z.string(), z.any());
    } else {
      // Handle object with properties
      const schemaShape: Record<string, z.ZodTypeAny> = {};
      for (const [key, value] of Object.entries(definition)) {
        schemaShape[key] = naturalZodSchema(value);
      }
      return z.object(schemaShape);
    }
  } else {
    switch (definition) {
      case String:
        return z.string();
      case Number:
        return z.number();
      case Boolean:
        return z.boolean();
      case Object:
        return z.record(z.string(), z.any());
      case Array:
        return z.array(z.any());
      default:
        throw new Error(`Unsupported type: ${definition}`);
    }
  }
}
