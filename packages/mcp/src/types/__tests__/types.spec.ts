import { describe, it, expect } from "vitest";
import { McpParameter, McpTool, McpRequest, McpResponse } from "../../index";

describe("MCP Types", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("McpParameter has expected properties", () => {
      // Create a sample parameter
      const param: McpParameter = {
        type: "string",
        description: "Test parameter",
        required: false,
        default: "default value"
      };
      
      expect(param).toHaveProperty("type");
      expect(param).toHaveProperty("description");
      expect(param).toHaveProperty("required");
      expect(param).toHaveProperty("default");
    });
    
    it("McpTool has expected properties", () => {
      // Create a sample tool
      const tool: McpTool = {
        name: "test",
        description: "Test tool",
        parameters: {},
        handler: async () => "result"
      };
      
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("parameters");
      expect(tool).toHaveProperty("handler");
      expect(typeof tool.handler).toBe("function");
    });
    
    it("McpRequest has expected properties", () => {
      // Create a sample request
      const request: McpRequest = {
        query: "test query",
        prompt: "test prompt",
        tools: []
      };
      
      expect(request).toHaveProperty("query");
      expect(request).toHaveProperty("prompt");
      expect(request).toHaveProperty("tools");
    });
    
    it("McpResponse has expected properties", () => {
      // Create a sample response
      const response: McpResponse = {
        response: "test response",
        toolResults: []
      };
      
      expect(response).toHaveProperty("response");
      expect(response).toHaveProperty("toolResults");
    });
  });
});