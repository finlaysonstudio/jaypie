import { describe, it, expect } from "vitest";
import { McpServer, createGreetingTool, STEAMPUNK_PIRATE_PROMPT } from "../../index";

describe("MCP Server", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("is a class", () => {
      expect(McpServer).toBeDefined();
      expect(typeof McpServer).toBe("function");
      expect(() => new McpServer({ systemPrompt: "test" })).not.toThrow();
    });

    it("has the expected interface", () => {
      const server = new McpServer({ systemPrompt: "test" });
      expect(server).toHaveProperty("registerTool");
      expect(server).toHaveProperty("handleRequest");
      expect(typeof server.registerTool).toBe("function");
      expect(typeof server.handleRequest).toBe("function");
    });
  });

  // Error Conditions
  describe("Error Conditions", () => {
    it("requires a system prompt", () => {
      // @ts-expect-error Testing missing required parameter
      expect(() => new McpServer({})).toThrow();
    });

    it("handles empty requests", async () => {
      const server = new McpServer({ systemPrompt: "test" });
      const response = await server.handleRequest({});
      
      expect(response).toBeDefined();
      expect(response).toHaveProperty("response");
      expect(typeof response.response).toBe("string");
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    it("can register a tool", () => {
      const server = new McpServer({ systemPrompt: "test" });
      const greetingTool = createGreetingTool();
      
      expect(() => server.registerTool(greetingTool)).not.toThrow();
    });

    it("accepts the steampunk pirate prompt", () => {
      expect(() => new McpServer({ 
        systemPrompt: STEAMPUNK_PIRATE_PROMPT 
      })).not.toThrow();
    });

    it("returns a response from handleRequest", async () => {
      const server = new McpServer({ systemPrompt: "test" });
      const response = await server.handleRequest({ query: "Hello" });
      
      expect(response).toBeDefined();
      expect(response).toHaveProperty("response");
      expect(typeof response.response).toBe("string");
    });
  });
});