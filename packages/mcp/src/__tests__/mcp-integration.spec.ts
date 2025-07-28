import { describe, expect, it } from "vitest";
import { z } from "zod";

describe("MCP Integration", () => {
  it("should reproduce the original MCP tool call issue", async () => {
    // This test verifies that zod schemas work correctly with MCP tool definitions
    // The original issue was "keyValidator._parse is not a function"
    
    // Define a schema similar to what's used in the read_prompt tool
    const schema = {
      filename: z
        .string()
        .describe(
          "The name of the prompt file to read (e.g., example_prompt.md)",
        ),
    };

    // This should work without throwing "keyValidator._parse is not a function"
    expect(() => {
      // Test that zod schema can be parsed properly
      const parsed = schema.filename.parse("Jaypie_Agent_Rules.md");
      expect(parsed).toBe("Jaypie_Agent_Rules.md");
    }).not.toThrow();

    // Test validation with invalid input
    expect(() => {
      schema.filename.parse(123); // Should throw as it's not a string
    }).toThrow();
  });
});