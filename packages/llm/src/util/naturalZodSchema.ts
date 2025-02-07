import { z } from "zod";

type EmptyArray = never[];
type EmptyObject = Record<string, never>;
type ConstructorArray = (
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
)[];

type NaturalType =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | ObjectConstructor
  | ArrayConstructor
  | string[]
  | ConstructorArray
  | EmptyArray
  | EmptyObject;

export default function naturalZodSchema(
  definition: Record<string, NaturalType>,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const schemaShape: Record<string, z.ZodTypeAny> = {};

  for (const [key, value] of Object.entries(definition)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        // Handle empty array - accept any[]
        schemaShape[key] = z.array(z.any());
      } else if (value.length === 1) {
        // Handle array types
        const itemType = value[0];
        switch (itemType) {
          case String:
            schemaShape[key] = z.array(z.string());
            break;
          case Number:
            schemaShape[key] = z.array(z.number());
            break;
          case Boolean:
            schemaShape[key] = z.array(z.boolean());
            break;
          default:
            // Handle enum arrays
            schemaShape[key] = z.enum(value as [string, ...string[]]);
        }
      } else {
        // Handle enum arrays
        schemaShape[key] = z.enum(value as [string, ...string[]]);
      }
    } else if (
      value &&
      typeof value === "object" &&
      Object.keys(value).length === 0
    ) {
      // Handle empty object - accept any key-value pairs
      schemaShape[key] = z.record(z.string(), z.any());
    } else {
      switch (value) {
        case String:
          schemaShape[key] = z.string();
          break;
        case Number:
          schemaShape[key] = z.number();
          break;
        case Boolean:
          schemaShape[key] = z.boolean();
          break;
        case Object:
          schemaShape[key] = z.record(z.string(), z.any());
          break;
        case Array:
          schemaShape[key] = z.array(z.any());
          break;
        default:
          throw new Error(`Unsupported type: ${value}`);
      }
    }
  }

  return z.object(schemaShape);
}
