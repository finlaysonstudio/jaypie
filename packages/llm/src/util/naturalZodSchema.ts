import { z as z3 } from "zod/v3";
import { z as z4 } from "zod/v4";
import { NaturalSchema } from "@jaypie/types";

export function naturalZod3Schema(definition: NaturalSchema): z3.ZodTypeAny {
  if (Array.isArray(definition)) {
    if (definition.length === 0) {
      // Handle empty array - accept any[]
      return z3.array(z3.any());
    } else if (definition.length === 1) {
      // Handle array types
      const itemType = definition[0];
      switch (itemType) {
        case String:
          return z3.array(z3.string());
        case Number:
          return z3.array(z3.number());
        case Boolean:
          return z3.array(z3.boolean());
        default:
          if (typeof itemType === "object") {
            // Handle array of objects
            return z3.array(naturalZod3Schema(itemType));
          }
          // Handle enum arrays
          return z3.enum(definition as [string, ...string[]]);
      }
    } else {
      // Handle enum arrays
      return z3.enum(definition as [string, ...string[]]);
    }
  } else if (definition && typeof definition === "object") {
    if (Object.keys(definition).length === 0) {
      // Handle empty object - accept any key-value pairs
      return z3.record(z3.string(), z3.any());
    } else {
      // Handle object with properties
      const schemaShape: Record<string, z3.ZodTypeAny> = {};
      for (const [key, value] of Object.entries(definition)) {
        schemaShape[key] = naturalZod3Schema(value);
      }
      return z3.object(schemaShape);
    }
  } else {
    switch (definition) {
      case String:
        return z3.string();
      case Number:
        return z3.number();
      case Boolean:
        return z3.boolean();
      case Object:
        return z3.record(z3.string(), z3.any());
      case Array:
        return z3.array(z3.any());
      default:
        throw new Error(`Unsupported type: ${definition}`);
    }
  }
}

export function naturalZod4Schema(definition: NaturalSchema): z4.ZodTypeAny {
  if (Array.isArray(definition)) {
    if (definition.length === 0) {
      // Handle empty array - accept any[]
      return z4.array(z4.any());
    } else if (definition.length === 1) {
      // Handle array types
      const itemType = definition[0];
      switch (itemType) {
        case String:
          return z4.array(z4.string());
        case Number:
          return z4.array(z4.number());
        case Boolean:
          return z4.array(z4.boolean());
        default:
          if (typeof itemType === "object") {
            // Handle array of objects
            return z4.array(naturalZod4Schema(itemType));
          }
          // Handle enum arrays
          return z4.enum(definition as [string, ...string[]]);
      }
    } else {
      // Handle enum arrays
      return z4.enum(definition as [string, ...string[]]);
    }
  } else if (definition && typeof definition === "object") {
    if (Object.keys(definition).length === 0) {
      // Handle empty object - accept any key-value pairs
      return z4.record(z4.string(), z4.any());
    } else {
      // Handle object with properties
      const schemaShape: Record<string, z4.ZodTypeAny> = {};
      for (const [key, value] of Object.entries(definition)) {
        schemaShape[key] = naturalZod4Schema(value);
      }
      return z4.object(schemaShape);
    }
  } else {
    switch (definition) {
      case String:
        return z4.string();
      case Number:
        return z4.number();
      case Boolean:
        return z4.boolean();
      case Object:
        return z4.record(z4.string(), z4.any());
      case Array:
        return z4.array(z4.any());
      default:
        throw new Error(`Unsupported type: ${definition}`);
    }
  }
}