import { describe, it, expect } from "vitest";
import { McpServer, createGreetingTool, McpTool } from "../index";

describe("Tool Registration", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("can register a valid tool", () => {
      const server = new McpServer({ systemPrompt: "test" });
      const greetingTool = createGreetingTool();
      
      expect(() => server.registerTool(greetingTool)).not.toThrow();
    });
  });

  // Error Conditions
  describe("Error Conditions", () => {
    it("handles registering an invalid tool", () => {
      const server = new McpServer({ systemPrompt: "test" });
      // @ts-expect-error Testing with incomplete tool
      const invalidTool: Partial<McpTool> = {
        name: "invalid"
        // Missing required properties
      };
      
      // This should either throw or handle it gracefully
      expect(() => {
        // @ts-expect-error Testing with invalid tool
        server.registerTool(invalidTool);
      }).not.toThrow();
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    it("can register multiple tools", () => {
      const server = new McpServer({ systemPrompt: "test" });
      
      const greetingTool = createGreetingTool();
      
      const customTool: McpTool = {
        name: "custom",
        description: "A custom test tool",
        parameters: {},
        handler: async () => "custom result"
      };
      
      server.registerTool(greetingTool);
      server.registerTool(customTool);
      
      // No assertions needed beyond not throwing
    });
  });
});