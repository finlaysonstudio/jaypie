// Tests for MCP adapter

import { describe, expect, it, vi } from "vitest";

import { registerMcpTool } from "../mcp/index.js";
import { createService } from "../service.js";

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
      const handler = createService({
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
      const handler = createService({
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
      const handler = createService({
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
      const handler = createService({
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
      const handler = createService({
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
      const handler = createService({
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
      const handler = createService({
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
      const handler = createService({
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
      const handler = createService({
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
      const handler = createService({
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
      const handler = createService({
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
      const handler = createService({
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
      const handler = createService({
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
      const handler = createService({
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
      const handler = createService({
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

    describe("sendMessage and onMessage", () => {
      it("passes context with sendMessage to service when onMessage is provided", async () => {
        const messages: Array<{ content: string; level?: string }> = [];

        const handler = createService({
          alias: "test",
          input: { name: { type: String } },
          service: ({ name }, context) => {
            context?.sendMessage?.({ content: `Processing ${name}` });
            return `Hello, ${name}!`;
          },
        });

        const mockServer = createMockServer();
        registerMcpTool({
          handler,
          onMessage: (msg) => {
            messages.push(msg);
          },
          server: mockServer as unknown as Parameters<
            typeof registerMcpTool
          >[0]["server"],
        });

        const registeredHandler = mockServer.registeredTools[0].handler;
        const result = await registeredHandler({ name: "Alice" });

        expect(result).toEqual({
          content: [{ text: "Hello, Alice!", type: "text" }],
        });
        expect(messages).toEqual([{ content: "Processing Alice" }]);
      });

      it("swallows errors in onMessage callback", async () => {
        const handler = createService({
          alias: "test",
          service: (_, context) => {
            context?.sendMessage?.({ content: "Message" });
            return "completed";
          },
        });

        let callCount = 0;
        const mockServer = createMockServer();
        registerMcpTool({
          handler,
          onMessage: () => {
            callCount++;
            throw new Error("onMessage error");
          },
          server: mockServer as unknown as Parameters<
            typeof registerMcpTool
          >[0]["server"],
        });

        const registeredHandler = mockServer.registeredTools[0].handler;
        const result = await registeredHandler({});

        expect(result).toEqual({
          content: [{ text: "completed", type: "text" }],
        });
        expect(callCount).toBe(1);
      });
    });

    describe("onComplete callback", () => {
      it("calls onComplete with result on success", async () => {
        let completedValue: unknown;

        const handler = createService({
          alias: "test",
          input: { value: { type: Number } },
          service: ({ value }) => value * 2,
        });

        const mockServer = createMockServer();
        registerMcpTool({
          handler,
          onComplete: (result) => {
            completedValue = result;
          },
          server: mockServer as unknown as Parameters<
            typeof registerMcpTool
          >[0]["server"],
        });

        const registeredHandler = mockServer.registeredTools[0].handler;
        await registeredHandler({ value: 21 });

        expect(completedValue).toBe(42);
      });

      it("swallows errors in onComplete callback", async () => {
        const handler = createService({
          alias: "test",
          service: () => "result",
        });

        const mockServer = createMockServer();
        registerMcpTool({
          handler,
          onComplete: () => {
            throw new Error("onComplete error");
          },
          server: mockServer as unknown as Parameters<
            typeof registerMcpTool
          >[0]["server"],
        });

        const registeredHandler = mockServer.registeredTools[0].handler;
        const result = await registeredHandler({});

        expect(result).toEqual({
          content: [{ text: "result", type: "text" }],
        });
      });
    });

    describe("onError and onFatal callbacks", () => {
      it("calls onFatal when handler throws", async () => {
        let fatalError: unknown;

        const handler = createService({
          alias: "test",
          service: () => {
            throw new Error("Service error");
          },
        });

        const mockServer = createMockServer();
        registerMcpTool({
          handler,
          onFatal: (error) => {
            fatalError = error;
          },
          server: mockServer as unknown as Parameters<
            typeof registerMcpTool
          >[0]["server"],
        });

        const registeredHandler = mockServer.registeredTools[0].handler;
        await expect(registeredHandler({})).rejects.toThrow("Service error");
        expect(fatalError).toBeInstanceOf(Error);
        expect((fatalError as Error).message).toBe("Service error");
      });

      it("falls back to onError when onFatal is not provided", async () => {
        let errorValue: unknown;

        const handler = createService({
          alias: "test",
          service: () => {
            throw new Error("Service error");
          },
        });

        const mockServer = createMockServer();
        registerMcpTool({
          handler,
          onError: (error) => {
            errorValue = error;
          },
          server: mockServer as unknown as Parameters<
            typeof registerMcpTool
          >[0]["server"],
        });

        const registeredHandler = mockServer.registeredTools[0].handler;
        await expect(registeredHandler({})).rejects.toThrow("Service error");
        expect(errorValue).toBeInstanceOf(Error);
        expect((errorValue as Error).message).toBe("Service error");
      });

      it("passes context.onError to service for recoverable errors", async () => {
        let recoveredError: unknown;

        const handler = createService({
          alias: "test",
          service: (_, context) => {
            context?.onError?.(new Error("Recoverable error"));
            return "continued";
          },
        });

        const mockServer = createMockServer();
        registerMcpTool({
          handler,
          onError: (error) => {
            recoveredError = error;
          },
          server: mockServer as unknown as Parameters<
            typeof registerMcpTool
          >[0]["server"],
        });

        const registeredHandler = mockServer.registeredTools[0].handler;
        const result = await registeredHandler({});

        expect(result).toEqual({
          content: [{ text: "continued", type: "text" }],
        });
        expect(recoveredError).toBeInstanceOf(Error);
        expect((recoveredError as Error).message).toBe("Recoverable error");
      });

      it("passes context.onFatal to service for explicit fatal errors", async () => {
        let fatalError: unknown;

        const handler = createService({
          alias: "test",
          service: (_, context) => {
            context?.onFatal?.(new Error("Fatal error"));
            return "continued";
          },
        });

        const mockServer = createMockServer();
        registerMcpTool({
          handler,
          onFatal: (error) => {
            fatalError = error;
          },
          server: mockServer as unknown as Parameters<
            typeof registerMcpTool
          >[0]["server"],
        });

        const registeredHandler = mockServer.registeredTools[0].handler;
        const result = await registeredHandler({});

        expect(result).toEqual({
          content: [{ text: "continued", type: "text" }],
        });
        expect(fatalError).toBeInstanceOf(Error);
        expect((fatalError as Error).message).toBe("Fatal error");
      });

      it("swallows errors in context.onError callback", async () => {
        const handler = createService({
          alias: "test",
          service: (_, context) => {
            context?.onError?.(new Error("Test error"));
            return "completed";
          },
        });

        const mockServer = createMockServer();
        registerMcpTool({
          handler,
          onError: () => {
            throw new Error("Callback error");
          },
          server: mockServer as unknown as Parameters<
            typeof registerMcpTool
          >[0]["server"],
        });

        const registeredHandler = mockServer.registeredTools[0].handler;
        const result = await registeredHandler({});

        expect(result).toEqual({
          content: [{ text: "completed", type: "text" }],
        });
      });
    });
  });
});
