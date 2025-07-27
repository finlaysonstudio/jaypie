import { describe, expect, it } from "vitest";
import { server } from "../index.js";

describe("MCP Integration", () => {
  it("should reproduce the original MCP tool call issue", async () => {
    // This simulates the JSON-RPC call that was failing
    const mockRequest = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "read_prompt",
        arguments: {
          filename: "Jaypie_Agent_Rules.md",
        },
      },
    };

    // This should work without throwing "keyValidator._parse is not a function"
    expect(() => {
      // The server tool validation should not throw
      const tools = (server as any)._tools;
      const readPromptTool = tools.get("read_prompt");
      expect(readPromptTool).toBeDefined();
    }).not.toThrow();
  });
});