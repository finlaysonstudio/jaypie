import { describe, expect, it } from "vitest";
import { z } from "zod";

describe("Zod Compatibility", () => {
  it("should work with safeParse method (Zod v3 and v4 compatible)", () => {
    const keyValidator = z
      .string()
      .describe("The name of the prompt file to read (e.g., example_prompt.md)");
    
    // safeParse should work in both versions
    const result = keyValidator.safeParse("test.md");
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("test.md");
    }
  });

  it("should validate invalid input correctly", () => {
    const keyValidator = z
      .string()
      .describe("The name of the prompt file to read (e.g., example_prompt.md)");
    
    const result = keyValidator.safeParse(123);
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it("should create MCP tool schema correctly", () => {
    const toolSchema = {
      filename: z
        .string()
        .describe("The name of the prompt file to read (e.g., example_prompt.md)"),
    };
    
    // This is how the MCP SDK uses the schema
    const filenameResult = toolSchema.filename.safeParse("test.md");
    expect(filenameResult.success).toBe(true);
    if (filenameResult.success) {
      expect(filenameResult.data).toBe("test.md");
    }
  });
});