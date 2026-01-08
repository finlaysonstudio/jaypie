// Tests for MCP adapter

import { describe, expect, it, vi } from "vitest";

import { registerMcpTool } from "../mcp/index.js";
import { serviceHandler } from "../serviceHandler.js";

describe("MCP Adapter", () => {
  describe("registerMcpTool", () => {
    function createMockServer() {
      const registeredTools: Array<{
        description: string;
        handler: (args: Record<string, unknown>) => Promise<unknown>;
        name: string;
        schema: Record<string, unknown>;
      }> = [];

      return {
        registeredTools,
        tool: vi.fn(
          (
            name: string,
            description: string,
            schema: Record<string, unknown>,
            handler: (args: Record<string, unknown>) => Promise<unknown>,
          ) => {
            registeredTools.push({ description, handler, name, schema });
          },
        ),
      };
    }

    it("registers a tool with handler alias as name", () => {
      const handler = serviceHandler({
        alias: "greet",
        service: () => "Hello!",
      });

      const mockServer = createMockServer();
      const result = registerMcpTool({
        handler,
        server: mockServer as unknown as Parameters<
          typeof registerMcpTool
        >[0]["server"],
      });

      expect(result.name).toBe("greet");
      expect(mockServer.tool).toHaveBeenCalledTimes(1);
      expect(mockServer.registeredTools[0].name).toBe("greet");
    });

    it("registers a tool with handler description", () => {
      const handler = serviceHandler({
        alias: "greet",
        description: "Greet a user",
        service: () => "Hello!",
      });

      const mockServer = createMockServer();
      registerMcpTool({
        handler,
        server: mockServer as unknown as Parameters<
          typeof registerMcpTool
        >[0]["server"],
      });

      expect(mockServer.registeredTools[0].description).toBe("Greet a user");
    });

    it("uses custom name over handler alias", () => {
      const handler = serviceHandler({
        alias: "greet",
        service: () => "Hello!",
      });

      const mockServer = createMockServer();
      const result = registerMcpTool({
        handler,
        name: "hello",
        server: mockServer as unknown as Parameters<
          typeof registerMcpTool
        >[0]["server"],
      });

      expect(result.name).toBe("hello");
      expect(mockServer.registeredTools[0].name).toBe("hello");
    });

    it("uses custom description over handler description", () => {
      const handler = serviceHandler({
        alias: "greet",
        description: "Handler description",
        service: () => "Hello!",
      });

      const mockServer = createMockServer();
      registerMcpTool({
        description: "Custom description",
        handler,
        server: mockServer as unknown as Parameters<
          typeof registerMcpTool
        >[0]["server"],
      });

      expect(mockServer.registeredTools[0].description).toBe(
        "Custom description",
      );
    });

    it("defaults to 'tool' when no alias or name provided", () => {
      const handler = serviceHandler({
        service: () => "Hello!",
      });

      const mockServer = createMockServer();
      const result = registerMcpTool({
        handler,
        server: mockServer as unknown as Parameters<
          typeof registerMcpTool
        >[0]["server"],
      });

      expect(result.name).toBe("tool");
    });

    it("defaults to empty description when none provided", () => {
      const handler = serviceHandler({
        alias: "test",
        service: () => "Hello!",
      });

      const mockServer = createMockServer();
      registerMcpTool({
        handler,
        server: mockServer as unknown as Parameters<
          typeof registerMcpTool
        >[0]["server"],
      });

      expect(mockServer.registeredTools[0].description).toBe("");
    });

    it("registers with empty schema (service handler validates)", () => {
      const handler = serviceHandler({
        alias: "greet",
        input: {
          loud: { default: false, type: Boolean },
          name: { description: "User name", type: String },
        },
        service: ({ name, loud }) => {
          const greeting = `Hello, ${name}!`;
          return loud ? greeting.toUpperCase() : greeting;
        },
      });

      const mockServer = createMockServer();
      registerMcpTool({
        handler,
        server: mockServer as unknown as Parameters<
          typeof registerMcpTool
        >[0]["server"],
      });

      const schema = mockServer.registeredTools[0].schema;
      expect(schema).toEqual({});
    });

    it("handler returns MCP-formatted response", async () => {
      const handler = serviceHandler({
        alias: "greet",
        input: {
          name: { type: String },
        },
        service: ({ name }) => `Hello, ${name}!`,
      });

      const mockServer = createMockServer();
      registerMcpTool({
        handler,
        server: mockServer as unknown as Parameters<
          typeof registerMcpTool
        >[0]["server"],
      });

      const registeredHandler = mockServer.registeredTools[0].handler;
      const result = await registeredHandler({ name: "Alice" });

      expect(result).toEqual({
        content: [
          {
            text: "Hello, Alice!",
            type: "text",
          },
        ],
      });
    });

    it("handler formats object results as JSON", async () => {
      const handler = serviceHandler({
        alias: "data",
        input: {
          id: { type: Number },
        },
        service: ({ id }) => ({ id, name: "test" }),
      });

      const mockServer = createMockServer();
      registerMcpTool({
        handler,
        server: mockServer as unknown as Parameters<
          typeof registerMcpTool
        >[0]["server"],
      });

      const registeredHandler = mockServer.registeredTools[0].handler;
      const result = await registeredHandler({ id: 1 });

      expect(result).toEqual({
        content: [
          {
            text: JSON.stringify({ id: 1, name: "test" }, null, 2),
            type: "text",
          },
        ],
      });
    });

    it("handler formats number results as string", async () => {
      const handler = serviceHandler({
        alias: "add",
        input: {
          a: { type: Number },
          b: { type: Number },
        },
        service: ({ a, b }) => a + b,
      });

      const mockServer = createMockServer();
      registerMcpTool({
        handler,
        server: mockServer as unknown as Parameters<
          typeof registerMcpTool
        >[0]["server"],
      });

      const registeredHandler = mockServer.registeredTools[0].handler;
      const result = await registeredHandler({ a: 5, b: 3 });

      expect(result).toEqual({
        content: [
          {
            text: "8",
            type: "text",
          },
        ],
      });
    });

    it("handler returns empty string for undefined result", async () => {
      const handler = serviceHandler({
        alias: "noop",
        service: () => undefined,
      });

      const mockServer = createMockServer();
      registerMcpTool({
        handler,
        server: mockServer as unknown as Parameters<
          typeof registerMcpTool
        >[0]["server"],
      });

      const registeredHandler = mockServer.registeredTools[0].handler;
      const result = await registeredHandler({});

      expect(result).toEqual({
        content: [
          {
            text: "",
            type: "text",
          },
        ],
      });
    });

    it("handler returns empty string for null result", async () => {
      const handler = serviceHandler({
        alias: "noop",
        service: () => null,
      });

      const mockServer = createMockServer();
      registerMcpTool({
        handler,
        server: mockServer as unknown as Parameters<
          typeof registerMcpTool
        >[0]["server"],
      });

      const registeredHandler = mockServer.registeredTools[0].handler;
      const result = await registeredHandler({});

      expect(result).toEqual({
        content: [
          {
            text: "",
            type: "text",
          },
        ],
      });
    });

    it("handles async handlers", async () => {
      const handler = serviceHandler({
        alias: "delay",
        input: {
          ms: { type: Number },
        },
        service: async ({ ms }) => {
          await new Promise((resolve) => setTimeout(resolve, ms));
          return "done";
        },
      });

      const mockServer = createMockServer();
      registerMcpTool({
        handler,
        server: mockServer as unknown as Parameters<
          typeof registerMcpTool
        >[0]["server"],
      });

      const registeredHandler = mockServer.registeredTools[0].handler;
      const result = await registeredHandler({ ms: 10 });

      expect(result).toEqual({
        content: [
          {
            text: "done",
            type: "text",
          },
        ],
      });
    });

    it("handles handlers with no input", async () => {
      const handler = serviceHandler({
        alias: "ping",
        service: () => "pong",
      });

      const mockServer = createMockServer();
      registerMcpTool({
        handler,
        server: mockServer as unknown as Parameters<
          typeof registerMcpTool
        >[0]["server"],
      });

      const registeredHandler = mockServer.registeredTools[0].handler;
      const result = await registeredHandler({});

      expect(result).toEqual({
        content: [
          {
            text: "pong",
            type: "text",
          },
        ],
      });
    });

    it("full integration: creates working MCP tool from handler", async () => {
      const handler = serviceHandler({
        alias: "calculate",
        description: "Calculate the sum of two numbers",
        input: {
          a: { description: "First number", type: Number },
          b: { description: "Second number", type: Number },
        },
        service: ({ a, b }) => a + b,
      });

      const mockServer = createMockServer();
      const result = registerMcpTool({
        handler,
        server: mockServer as unknown as Parameters<
          typeof registerMcpTool
        >[0]["server"],
      });

      expect(result.name).toBe("calculate");
      expect(mockServer.registeredTools[0].name).toBe("calculate");
      expect(mockServer.registeredTools[0].description).toBe(
        "Calculate the sum of two numbers",
      );

      const registeredHandler = mockServer.registeredTools[0].handler;
      const handlerResult = await registeredHandler({ a: 5, b: 3 });

      expect(handlerResult).toEqual({
        content: [
          {
            text: "8",
            type: "text",
          },
        ],
      });
    });
  });
});
