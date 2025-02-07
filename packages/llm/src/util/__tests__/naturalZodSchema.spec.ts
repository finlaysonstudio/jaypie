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
      expect(result).toBeInstanceOf(z.ZodObject);
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
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
  });
});
