import { describe, expect, it } from "vitest";

import { jsonSchemaToOpenApi3 } from "../jsonSchemaToOpenApi3.js";

describe("jsonSchemaToOpenApi3", () => {
  it("strips $schema", () => {
    const result = jsonSchemaToOpenApi3({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
    });
    expect(result).toEqual({ type: "object" });
    expect(result.$schema).toBeUndefined();
  });

  it("strips additionalProperties", () => {
    const result = jsonSchemaToOpenApi3({
      type: "object",
      properties: { name: { type: "string" } },
      additionalProperties: false,
    });
    expect(result.additionalProperties).toBeUndefined();
    expect(result.type).toBe("object");
    expect(result.properties).toEqual({ name: { type: "string" } });
  });

  it("strips $defs", () => {
    const result = jsonSchemaToOpenApi3({
      $defs: { Foo: { type: "string" } },
      type: "object",
    });
    expect(result.$defs).toBeUndefined();
  });

  it("strips const", () => {
    const result = jsonSchemaToOpenApi3({
      type: "string",
      const: "fixed",
    });
    expect(result.const).toBeUndefined();
    expect(result.type).toBe("string");
  });

  it("strips $ref", () => {
    const result = jsonSchemaToOpenApi3({
      $ref: "#/$defs/Foo",
    });
    expect(result.$ref).toBeUndefined();
  });

  it("recursively converts nested properties", () => {
    const result = jsonSchemaToOpenApi3({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    });

    expect(result.$schema).toBeUndefined();
    expect(result.additionalProperties).toBeUndefined();
    const userProp = result.properties as Record<string, any>;
    expect(userProp.user.additionalProperties).toBeUndefined();
    expect(userProp.user.type).toBe("object");
  });

  it("recursively converts array items", () => {
    const result = jsonSchemaToOpenApi3({
      type: "object",
      properties: {
        pages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              pageNumber: { type: "number" },
              extractedText: { type: "string" },
            },
            required: ["pageNumber", "extractedText"],
            additionalProperties: false,
          },
        },
      },
      required: ["pages"],
      additionalProperties: false,
    });

    expect(result.additionalProperties).toBeUndefined();
    const pages = (result.properties as any).pages;
    expect(pages.type).toBe("array");
    expect(pages.items.additionalProperties).toBeUndefined();
    expect(pages.items.type).toBe("object");
    expect(pages.items.required).toEqual(["pageNumber", "extractedText"]);
  });

  it("recursively converts anyOf branches", () => {
    const result = jsonSchemaToOpenApi3({
      type: "object",
      properties: {
        totals: {
          anyOf: [
            {
              type: "object",
              properties: { amount: { type: "number" } },
              required: ["amount"],
              additionalProperties: false,
            },
            { type: "null" },
          ],
        },
      },
      required: ["totals"],
      additionalProperties: false,
    });

    const totals = (result.properties as any).totals;
    expect(totals.anyOf[0].additionalProperties).toBeUndefined();
    expect(totals.anyOf[0].type).toBe("object");
    expect(totals.anyOf[0].required).toEqual(["amount"]);
    expect(totals.anyOf[1]).toEqual({ type: "null" });
  });

  it("recursively converts oneOf branches", () => {
    const result = jsonSchemaToOpenApi3({
      oneOf: [
        {
          type: "object",
          properties: { kind: { type: "string" } },
          additionalProperties: false,
        },
        { type: "null" },
      ],
    });

    expect((result.oneOf as any)[0].additionalProperties).toBeUndefined();
    expect((result.oneOf as any)[0].type).toBe("object");
  });

  it("recursively converts allOf branches", () => {
    const result = jsonSchemaToOpenApi3({
      allOf: [
        {
          type: "object",
          properties: { kind: { type: "string" } },
          additionalProperties: false,
        },
      ],
    });

    expect((result.allOf as any)[0].additionalProperties).toBeUndefined();
    expect((result.allOf as any)[0].type).toBe("object");
  });

  it("recursively converts nested combinator branches", () => {
    const result = jsonSchemaToOpenApi3({
      type: "object",
      properties: {
        entries: {
          anyOf: [
            {
              type: "array",
              items: {
                anyOf: [
                  {
                    type: "object",
                    properties: { id: { type: "string" } },
                    additionalProperties: false,
                  },
                  { type: "null" },
                ],
              },
            },
            { type: "null" },
          ],
        },
      },
      additionalProperties: false,
    });

    const entries = (result.properties as any).entries;
    expect(
      entries.anyOf[0].items.anyOf[0].additionalProperties,
    ).toBeUndefined();
    expect(entries.anyOf[0].items.anyOf[0].type).toBe("object");
  });

  it("leaves non-schema combinator entries as-is", () => {
    const result = jsonSchemaToOpenApi3({
      anyOf: ["not-a-schema", 42, null],
    });

    expect(result.anyOf).toEqual(["not-a-schema", 42, null]);
  });

  it("preserves required, type, enum, description", () => {
    const result = jsonSchemaToOpenApi3({
      type: "object",
      description: "A test schema",
      required: ["status"],
      properties: {
        status: { type: "string", enum: ["active", "inactive"] },
      },
    });

    expect(result.type).toBe("object");
    expect(result.description).toBe("A test schema");
    expect(result.required).toEqual(["status"]);
    const statusProp = (result.properties as any).status;
    expect(statusProp.enum).toEqual(["active", "inactive"]);
  });

  it("handles the exact schema from the issue report", () => {
    const input = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        pages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              pageNumber: { type: "number" },
              extractedText: { type: "string" },
            },
            required: ["pageNumber", "extractedText"],
            additionalProperties: false,
          },
        },
      },
      required: ["pages"],
      additionalProperties: false,
    };

    const result = jsonSchemaToOpenApi3(input);

    expect(result).toEqual({
      type: "object",
      properties: {
        pages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              pageNumber: { type: "number" },
              extractedText: { type: "string" },
            },
            required: ["pageNumber", "extractedText"],
          },
        },
      },
      required: ["pages"],
    });
  });

  it("returns non-object values as-is", () => {
    // @ts-expect-error testing non-object input
    expect(jsonSchemaToOpenApi3("string")).toBe("string");
    // @ts-expect-error testing non-object input
    expect(jsonSchemaToOpenApi3(42)).toBe(42);
  });
});
