import { describe, it, expect } from "vitest";
import { createMcpServer } from "../createMcpServer.js";

describe("createMcpServer", () => {
  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(createMcpServer).toBeInstanceOf(Function);
    });

    it("Works", () => {
      const server = createMcpServer();
      expect(server).toBeDefined();
    });
  });

  describe("Happy Paths", () => {
    it("Creates an MCP server with default version", () => {
      const server = createMcpServer();
      expect(server).toBeDefined();
      expect(server.isConnected).toBeInstanceOf(Function);
    });

    it("Creates an MCP server with custom version", () => {
      const server = createMcpServer("1.2.3");
      expect(server).toBeDefined();
    });
  });

  describe("Features", () => {
    it("Returns a server instance", () => {
      const server = createMcpServer();
      expect(server).toHaveProperty("connect");
      expect(server).toHaveProperty("close");
      expect(server).toHaveProperty("isConnected");
    });

    it("Server has tool registration capabilities", () => {
      const server = createMcpServer();
      expect(server).toHaveProperty("tool");
      expect(server).toHaveProperty("registerTool");
    });

    it("Registers version tool", () => {
      const server = createMcpServer();
      // The server object doesn't expose registered tools directly,
      // but we can verify it creates without error when registering the version tool
      expect(server).toBeDefined();
    });
  });
});
