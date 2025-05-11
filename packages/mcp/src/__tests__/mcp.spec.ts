import { McpServer, createGreetingTool } from "../index";
import { describe, it, expect } from "vitest";

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

  // Happy Paths
  describe("Happy Paths", () => {
    it("can register a tool", () => {
      const server = new McpServer({ systemPrompt: "test" });
      const greetingTool = createGreetingTool();
      
      expect(() => server.registerTool(greetingTool)).not.toThrow();
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

describe("Greeting Tool", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("is an object with the expected shape", () => {
      const greetingTool = createGreetingTool();
      expect(greetingTool).toHaveProperty("name", "greeting");
      expect(greetingTool).toHaveProperty("description");
      expect(greetingTool).toHaveProperty("parameters");
      expect(greetingTool).toHaveProperty("handler");
      expect(typeof greetingTool.handler).toBe("function");
    });
    
    it("returns a string", async () => {
      const greetingTool = createGreetingTool();
      const result = await greetingTool.handler({});
      expect(typeof result).toBe("string");
    });
  });
  
  // Happy Paths
  describe("Happy Paths", () => {
    it("returns 'Hello, World!' with default parameters", async () => {
      const greetingTool = createGreetingTool();
      const result = await greetingTool.handler({});
      expect(result).toBe("Hello, World!");
    });
    
    it("returns custom greeting with provided parameters", async () => {
      const greetingTool = createGreetingTool();
      const result = await greetingTool.handler({ 
        salutation: "Ahoy", 
        name: "Captain" 
      });
      expect(result).toBe("Ahoy, Captain!");
    });
  });
});