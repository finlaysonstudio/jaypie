import { z } from "zod";

type NaturalType =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | string[];

export default function naturalZodSchema(
  definition: Record<string, NaturalType>,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const schemaShape: Record<string, z.ZodTypeAny> = {};

  for (const [key, value] of Object.entries(definition)) {
    if (Array.isArray(value)) {
      schemaShape[key] = z.enum(value as [string, ...string[]]);
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
        default:
          throw new Error(`Unsupported type: ${value}`);
      }
    }
  }

  return z.object(schemaShape);
}
