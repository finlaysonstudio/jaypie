import { describe, expect, it } from "vitest";
import { z } from "zod";
import naturalZodSchema from "../naturalZodSchema";

describe("naturalInterfaceZodSchema", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(naturalZodSchema).toBeTypeOf("function");
    });

    it("works", () => {
      const result = naturalZodSchema({});
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(z.ZodType);
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    it("handles primitive types directly", () => {
      expect(naturalZodSchema(String)).toBeInstanceOf(z.ZodString);
      expect(naturalZodSchema(Number)).toBeInstanceOf(z.ZodNumber);
      expect(naturalZodSchema(Boolean)).toBeInstanceOf(z.ZodBoolean);
      expect(naturalZodSchema(Object)).toBeInstanceOf(z.ZodRecord);
      expect(naturalZodSchema(Array)).toBeInstanceOf(z.ZodArray);

      // Test validation
      const stringSchema = naturalZodSchema(String);
      expect(stringSchema.safeParse("test").success).toBe(true);
      expect(stringSchema.safeParse(123).success).toBe(false);

      const numberSchema = naturalZodSchema(Number);
      expect(numberSchema.safeParse(123).success).toBe(true);
      expect(numberSchema.safeParse("test").success).toBe(false);

      const booleanSchema = naturalZodSchema(Boolean);
      expect(booleanSchema.safeParse(true).success).toBe(true);
      expect(booleanSchema.safeParse("true").success).toBe(false);
    });

    it("creates a zod schema from a simple object definition", () => {
      const input = {
        decision: ["Accept", "Respond", "Indeterminate"],
        reason: String,
        response: String,
        confidence: Number,
      };

      const schema = naturalZodSchema(input);

      // Test the schema validates correct data
      const validData = {
        decision: "Accept",
        reason: "test reason",
        response: "test response",
        confidence: 0.9,
      };

      const result = schema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("supports Boolean, Array, and Object types", () => {
      const input = {
        isActive: Boolean,
        tags: [String],
        numbers: [Number],
        flags: [Boolean],
        metadata: Object,
        anyArray: [], // Empty array should accept any[]
        anyObject: {}, // Empty object should accept any key-value pairs
        anyArray2: Array, // Array constructor should also accept any[]
      };

      const schema = naturalZodSchema(input);

      // Test the schema validates correct data
      const validData = {
        isActive: true,
        tags: ["test", "demo"],
        numbers: [1, 2, 3],
        flags: [true, false],
        metadata: { key: "value" },
        anyArray: [1, "two", true, { three: 3 }],
        anyObject: {
          str: "string",
          num: 42,
          bool: true,
          arr: [1, 2, 3],
        },
        anyArray2: ["string", 1, true, { nested: "object" }],
      };

      const result = schema.safeParse(validData);
      expect(result.success).toBe(true);

      // Test invalid data
      const invalidData = {
        isActive: "not a boolean",
        tags: [1, 2, 3],
        numbers: ["not", "numbers"],
        flags: ["not", "booleans"],
        metadata: "not an object",
        anyArray: "not an array",
        anyObject: "not an object",
        anyArray2: "not an array either",
      };

      const invalidResult = schema.safeParse(invalidData);
      expect(invalidResult.success).toBe(false);
    });

    it("rejects invalid data", () => {
      const input = {
        decision: ["Accept", "Respond", "Indeterminate"],
        reason: String,
        response: String,
        confidence: Number,
      };

      const schema = naturalZodSchema(input);

      // Test the schema rejects invalid data
      const invalidData = {
        decision: "InvalidDecision",
        reason: "test reason",
        response: "test response",
        confidence: "not a number",
      };

      const result = schema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("supports nested object schemas", () => {
      const input = {
        id: String,
        type: String,
        attributes: {
          name: String,
        },
      };

      const schema = naturalZodSchema(input);

      // Test valid data
      const validData = {
        id: "123",
        type: "user",
        attributes: {
          name: "John Doe",
        },
      };

      const result = schema.safeParse(validData);
      expect(result.success).toBe(true);

      // Test invalid data
      const invalidData = {
        id: "123",
        type: "user",
        attributes: {
          name: 42, // should be string
        },
      };

      const invalidResult = schema.safeParse(invalidData);
      expect(invalidResult.success).toBe(false);
    });

    it("supports array of objects", () => {
      const input = [
        {
          id: String,
          attributes: {
            name: String,
          },
        },
      ];

      const schema = naturalZodSchema(input);

      // Test valid data
      const validData = [
        {
          id: "123",
          attributes: {
            name: "John Doe",
          },
        },
        {
          id: "456",
          attributes: {
            name: "Jane Smith",
          },
        },
      ];

      const result = schema.safeParse(validData);
      expect(result.success).toBe(true);

      // Test invalid data
      const invalidData = [
        {
          id: 123, // should be string
          attributes: {
            name: "John Doe",
          },
        },
      ];

      const invalidResult = schema.safeParse(invalidData);
      expect(invalidResult.success).toBe(false);
    });
  });
});
