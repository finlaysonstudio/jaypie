import { describe, expect, it } from "vitest";

import {
  isJsonSchema,
  jsonSchemaToNaturalSchema,
  naturalSchemaToJsonSchema,
} from "../jsonSchema.js";

describe("isJsonSchema", () => {
  it("is a function", () => {
    expect(isJsonSchema).toBeTypeOf("function");
  });

  it("accepts a bare object schema", () => {
    expect(
      isJsonSchema({
        type: "object",
        properties: { name: { type: "string" } },
      }),
    ).toBe(true);
  });

  it("rejects non-object schema types", () => {
    expect(isJsonSchema({ type: "string" })).toBe(false);
  });

  it("rejects objects missing properties", () => {
    expect(isJsonSchema({ type: "object" })).toBe(false);
  });

  it("rejects arrays, null, and primitives", () => {
    expect(isJsonSchema([])).toBe(false);
    expect(isJsonSchema(null)).toBe(false);
    expect(isJsonSchema("schema")).toBe(false);
    expect(isJsonSchema(String)).toBe(false);
  });
});

describe("naturalSchemaToJsonSchema", () => {
  it("is a function", () => {
    expect(naturalSchemaToJsonSchema).toBeTypeOf("function");
  });

  it("converts a natural schema object to JSON Schema", () => {
    const result = naturalSchemaToJsonSchema({
      code: String,
      cardBrand: String,
    });
    expect(result.type).toBe("object");
    expect(result.properties).toEqual({
      code: { type: "string" },
      cardBrand: { type: "string" },
    });
    expect(result.required).toEqual(["code", "cardBrand"]);
  });

  it("converts typed arrays and enums", () => {
    const result = naturalSchemaToJsonSchema({
      tags: [String],
      status: ["open", "closed"],
    }) as {
      properties: { tags: { type: string }; status: { enum: string[] } };
    };
    expect(result.properties.tags.type).toBe("array");
    expect(result.properties.status.enum).toEqual(["open", "closed"]);
  });
});

describe("jsonSchemaToNaturalSchema", () => {
  it("is a function", () => {
    expect(jsonSchemaToNaturalSchema).toBeTypeOf("function");
  });

  it("converts an object schema back to natural constructors", () => {
    const result = jsonSchemaToNaturalSchema({
      type: "object",
      properties: {
        code: { type: "string" },
        count: { type: "number" },
        active: { type: "boolean" },
      },
      required: ["code", "count", "active"],
    });
    expect(result).toEqual({ code: String, count: Number, active: Boolean });
  });

  it("converts array and enum nodes", () => {
    const result = jsonSchemaToNaturalSchema({
      type: "object",
      properties: {
        tags: { type: "array", items: { type: "string" } },
        status: { type: "string", enum: ["open", "closed"] },
      },
      required: ["tags", "status"],
    });
    expect(result).toEqual({ tags: [String], status: ["open", "closed"] });
  });

  it("drops lossy keywords without throwing", () => {
    const result = jsonSchemaToNaturalSchema({
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "A code",
          minLength: 1,
          default: "A",
        },
      },
      required: ["code"],
    });
    expect(result).toEqual({ code: String });
  });

  it("treats optional fields as required (no natural equivalent) without throwing", () => {
    const result = jsonSchemaToNaturalSchema({
      type: "object",
      properties: {
        cardBrand: { type: "string" },
      },
      required: [],
    });
    expect(result).toEqual({ cardBrand: String });
  });

  it("defaults unsupported types to Object without throwing", () => {
    const result = jsonSchemaToNaturalSchema({ type: "null" } as never);
    expect(result).toBe(Object);
  });

  it("round-trips through naturalSchemaToJsonSchema", () => {
    const natural = { code: String, count: Number, tags: [String] };
    const jsonSchema = naturalSchemaToJsonSchema(natural);
    const roundTripped = jsonSchemaToNaturalSchema(jsonSchema);
    expect(roundTripped).toEqual(natural);
  });
});
