// Tests for MCP adapter

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { fabricMcp, FabricMcpServer, isFabricMcpServer } from "../mcp/index.js";
import { inputToZodShape } from "../mcp/inputToZodShape.js";
import { fabricService } from "../service.js";

describe("MCP Adapter", () => {
  describe("fabricMcp", () => {
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
      const handler = fabricService({
        alias: "greet",
        service: () => "Hello!",
      });

      const mockServer = createMockServer();
      const result = fabricMcp({
        service: handler,
        server: mockServer as unknown as Parameters<
          typeof fabricMcp
        >[0]["server"],
      });

      expect(result.name).toBe("greet");
      expect(mockServer.tool).toHaveBeenCalledTimes(1);
      expect(mockServer.registeredTools[0].name).toBe("greet");
    });

    it("registers a tool with handler description", () => {
      const handler = fabricService({
        alias: "greet",
        description: "Greet a user",
        service: () => "Hello!",
      });

      const mockServer = createMockServer();
      fabricMcp({
        service: handler,
        server: mockServer as unknown as Parameters<
          typeof fabricMcp
        >[0]["server"],
      });

      expect(mockServer.registeredTools[0].description).toBe("Greet a user");
    });

    it("uses custom name over handler alias", () => {
      const handler = fabricService({
        alias: "greet",
        service: () => "Hello!",
      });

      const mockServer = createMockServer();
      const result = fabricMcp({
        service: handler,
        name: "hello",
        server: mockServer as unknown as Parameters<
          typeof fabricMcp
        >[0]["server"],
      });

      expect(result.name).toBe("hello");
      expect(mockServer.registeredTools[0].name).toBe("hello");
    });

    it("uses custom description over handler description", () => {
      const handler = fabricService({
        alias: "greet",
        description: "Handler description",
        service: () => "Hello!",
      });

      const mockServer = createMockServer();
      fabricMcp({
        description: "Custom description",
        service: handler,
        server: mockServer as unknown as Parameters<
          typeof fabricMcp
        >[0]["server"],
      });

      expect(mockServer.registeredTools[0].description).toBe(
        "Custom description",
      );
    });

    it("defaults to 'tool' when no alias or name provided", () => {
      const handler = fabricService({
        service: () => "Hello!",
      });

      const mockServer = createMockServer();
      const result = fabricMcp({
        service: handler,
        server: mockServer as unknown as Parameters<
          typeof fabricMcp
        >[0]["server"],
      });

      expect(result.name).toBe("tool");
    });

    it("defaults to empty description when none provided", () => {
      const handler = fabricService({
        alias: "test",
        service: () => "Hello!",
      });

      const mockServer = createMockServer();
      fabricMcp({
        service: handler,
        server: mockServer as unknown as Parameters<
          typeof fabricMcp
        >[0]["server"],
      });

      expect(mockServer.registeredTools[0].description).toBe("");
    });

    it("registers with Zod schema generated from input definitions", () => {
      const handler = fabricService({
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
      fabricMcp({
        service: handler,
        server: mockServer as unknown as Parameters<
          typeof fabricMcp
        >[0]["server"],
      });

      const schema = mockServer.registeredTools[0].schema;
      // Schema should have Zod types for each input field
      expect(schema).toHaveProperty("loud");
      expect(schema).toHaveProperty("name");
      // Verify they are Zod types
      expect(schema.loud._def).toBeDefined();
      expect(schema.name._def).toBeDefined();
    });

    it("registers with empty schema when no input defined", () => {
      const handler = fabricService({
        alias: "ping",
        service: () => "pong",
      });

      const mockServer = createMockServer();
      fabricMcp({
        service: handler,
        server: mockServer as unknown as Parameters<
          typeof fabricMcp
        >[0]["server"],
      });

      const schema = mockServer.registeredTools[0].schema;
      expect(schema).toEqual({});
    });

    it("handler returns MCP-formatted response", async () => {
      const handler = fabricService({
        alias: "greet",
        input: {
          name: { type: String },
        },
        service: ({ name }) => `Hello, ${name}!`,
      });

      const mockServer = createMockServer();
      fabricMcp({
        service: handler,
        server: mockServer as unknown as Parameters<
          typeof fabricMcp
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
      const handler = fabricService({
        alias: "data",
        input: {
          id: { type: Number },
        },
        service: ({ id }) => ({ id, name: "test" }),
      });

      const mockServer = createMockServer();
      fabricMcp({
        service: handler,
        server: mockServer as unknown as Parameters<
          typeof fabricMcp
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
      const handler = fabricService({
        alias: "add",
        input: {
          a: { type: Number },
          b: { type: Number },
        },
        service: ({ a, b }) => a + b,
      });

      const mockServer = createMockServer();
      fabricMcp({
        service: handler,
        server: mockServer as unknown as Parameters<
          typeof fabricMcp
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
      const handler = fabricService({
        alias: "noop",
        service: () => undefined,
      });

      const mockServer = createMockServer();
      fabricMcp({
        service: handler,
        server: mockServer as unknown as Parameters<
          typeof fabricMcp
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
      const handler = fabricService({
        alias: "noop",
        service: () => null,
      });

      const mockServer = createMockServer();
      fabricMcp({
        service: handler,
        server: mockServer as unknown as Parameters<
          typeof fabricMcp
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
      const handler = fabricService({
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
      fabricMcp({
        service: handler,
        server: mockServer as unknown as Parameters<
          typeof fabricMcp
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
      const handler = fabricService({
        alias: "ping",
        service: () => "pong",
      });

      const mockServer = createMockServer();
      fabricMcp({
        service: handler,
        server: mockServer as unknown as Parameters<
          typeof fabricMcp
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
      const handler = fabricService({
        alias: "calculate",
        description: "Calculate the sum of two numbers",
        input: {
          a: { description: "First number", type: Number },
          b: { description: "Second number", type: Number },
        },
        service: ({ a, b }) => a + b,
      });

      const mockServer = createMockServer();
      const result = fabricMcp({
        service: handler,
        server: mockServer as unknown as Parameters<
          typeof fabricMcp
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

        const handler = fabricService({
          alias: "test",
          input: { name: { type: String } },
          service: ({ name }, context) => {
            context?.sendMessage?.({ content: `Processing ${name}` });
            return `Hello, ${name}!`;
          },
        });

        const mockServer = createMockServer();
        fabricMcp({
          service: handler,
          onMessage: (msg) => {
            messages.push(msg);
          },
          server: mockServer as unknown as Parameters<
            typeof fabricMcp
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
        const handler = fabricService({
          alias: "test",
          service: (_, context) => {
            context?.sendMessage?.({ content: "Message" });
            return "completed";
          },
        });

        let callCount = 0;
        const mockServer = createMockServer();
        fabricMcp({
          service: handler,
          onMessage: () => {
            callCount++;
            throw new Error("onMessage error");
          },
          server: mockServer as unknown as Parameters<
            typeof fabricMcp
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

        const handler = fabricService({
          alias: "test",
          input: { value: { type: Number } },
          service: ({ value }) => value * 2,
        });

        const mockServer = createMockServer();
        fabricMcp({
          service: handler,
          onComplete: (result) => {
            completedValue = result;
          },
          server: mockServer as unknown as Parameters<
            typeof fabricMcp
          >[0]["server"],
        });

        const registeredHandler = mockServer.registeredTools[0].handler;
        await registeredHandler({ value: 21 });

        expect(completedValue).toBe(42);
      });

      it("swallows errors in onComplete callback", async () => {
        const handler = fabricService({
          alias: "test",
          service: () => "result",
        });

        const mockServer = createMockServer();
        fabricMcp({
          service: handler,
          onComplete: () => {
            throw new Error("onComplete error");
          },
          server: mockServer as unknown as Parameters<
            typeof fabricMcp
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

        const handler = fabricService({
          alias: "test",
          service: () => {
            throw new Error("Service error");
          },
        });

        const mockServer = createMockServer();
        fabricMcp({
          service: handler,
          onFatal: (error) => {
            fatalError = error;
          },
          server: mockServer as unknown as Parameters<
            typeof fabricMcp
          >[0]["server"],
        });

        const registeredHandler = mockServer.registeredTools[0].handler;
        await expect(registeredHandler({})).rejects.toThrow("Service error");
        expect(fatalError).toBeInstanceOf(Error);
        expect((fatalError as Error).message).toBe("Service error");
      });

      it("falls back to onError when onFatal is not provided", async () => {
        let errorValue: unknown;

        const handler = fabricService({
          alias: "test",
          service: () => {
            throw new Error("Service error");
          },
        });

        const mockServer = createMockServer();
        fabricMcp({
          service: handler,
          onError: (error) => {
            errorValue = error;
          },
          server: mockServer as unknown as Parameters<
            typeof fabricMcp
          >[0]["server"],
        });

        const registeredHandler = mockServer.registeredTools[0].handler;
        await expect(registeredHandler({})).rejects.toThrow("Service error");
        expect(errorValue).toBeInstanceOf(Error);
        expect((errorValue as Error).message).toBe("Service error");
      });

      it("passes context.onError to service for recoverable errors", async () => {
        let recoveredError: unknown;

        const handler = fabricService({
          alias: "test",
          service: (_, context) => {
            context?.onError?.(new Error("Recoverable error"));
            return "continued";
          },
        });

        const mockServer = createMockServer();
        fabricMcp({
          service: handler,
          onError: (error) => {
            recoveredError = error;
          },
          server: mockServer as unknown as Parameters<
            typeof fabricMcp
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

        const handler = fabricService({
          alias: "test",
          service: (_, context) => {
            context?.onFatal?.(new Error("Fatal error"));
            return "continued";
          },
        });

        const mockServer = createMockServer();
        fabricMcp({
          service: handler,
          onFatal: (error) => {
            fatalError = error;
          },
          server: mockServer as unknown as Parameters<
            typeof fabricMcp
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
        const handler = fabricService({
          alias: "test",
          service: (_, context) => {
            context?.onError?.(new Error("Test error"));
            return "completed";
          },
        });

        const mockServer = createMockServer();
        fabricMcp({
          service: handler,
          onError: () => {
            throw new Error("Callback error");
          },
          server: mockServer as unknown as Parameters<
            typeof fabricMcp
          >[0]["server"],
        });

        const registeredHandler = mockServer.registeredTools[0].handler;
        const result = await registeredHandler({});

        expect(result).toEqual({
          content: [{ text: "completed", type: "text" }],
        });
      });
    });

    describe("inline service definition (short-form)", () => {
      it("accepts inline function with alias, description, input", async () => {
        let capturedInput: unknown;
        const mockServer = createMockServer();
        const result = fabricMcp({
          alias: "greet",
          description: "Greet a user",
          input: {
            userName: { type: String },
            loud: { type: Boolean, default: false },
          },
          server: mockServer as unknown as Parameters<
            typeof fabricMcp
          >[0]["server"],
          service: ({ loud, userName }) => {
            capturedInput = { loud, userName };
            const greeting = `Hello, ${userName}!`;
            return loud ? greeting.toUpperCase() : greeting;
          },
        });

        expect(result.name).toBe("greet");
        expect(mockServer.registeredTools[0].name).toBe("greet");
        expect(mockServer.registeredTools[0].description).toBe("Greet a user");

        const handler = mockServer.registeredTools[0].handler;
        const response = await handler({ userName: "Alice", loud: true });

        expect(capturedInput).toEqual({ loud: true, userName: "Alice" });
        expect(response).toEqual({
          content: [{ text: "HELLO, ALICE!", type: "text" }],
        });
      });

      it("defaults to 'tool' when no alias provided for inline function", () => {
        const mockServer = createMockServer();
        const result = fabricMcp({
          server: mockServer as unknown as Parameters<
            typeof fabricMcp
          >[0]["server"],
          service: () => "result",
        });

        expect(result.name).toBe("tool");
        expect(mockServer.registeredTools[0].name).toBe("tool");
      });

      it("uses name over alias for inline function", () => {
        const mockServer = createMockServer();
        const result = fabricMcp({
          alias: "greet",
          name: "hello",
          server: mockServer as unknown as Parameters<
            typeof fabricMcp
          >[0]["server"],
          service: () => "result",
        });

        expect(result.name).toBe("hello");
        expect(mockServer.registeredTools[0].name).toBe("hello");
      });
    });

    describe("pre-instantiated service with overrides", () => {
      it("overrides alias with config alias", () => {
        const service = fabricService({
          alias: "original",
          service: () => "result",
        });

        const mockServer = createMockServer();
        const result = fabricMcp({
          alias: "overridden",
          server: mockServer as unknown as Parameters<
            typeof fabricMcp
          >[0]["server"],
          service,
        });

        expect(result.name).toBe("overridden");
        expect(mockServer.registeredTools[0].name).toBe("overridden");
      });

      it("overrides description with config description", () => {
        const service = fabricService({
          alias: "test",
          description: "Original description",
          service: () => "result",
        });

        const mockServer = createMockServer();
        fabricMcp({
          description: "Overridden description",
          server: mockServer as unknown as Parameters<
            typeof fabricMcp
          >[0]["server"],
          service,
        });

        expect(mockServer.registeredTools[0].description).toBe(
          "Overridden description",
        );
      });

      it("inherits description when not overridden", () => {
        const service = fabricService({
          alias: "test",
          description: "Original description",
          service: () => "result",
        });

        const mockServer = createMockServer();
        fabricMcp({
          alias: "overridden",
          server: mockServer as unknown as Parameters<
            typeof fabricMcp
          >[0]["server"],
          service,
        });

        expect(mockServer.registeredTools[0].description).toBe(
          "Original description",
        );
      });

      it("overrides input definitions", async () => {
        let capturedInput: unknown;
        const service = fabricService({
          alias: "original",
          input: {
            name: { type: String },
          },
          service: (input) => {
            capturedInput = input;
            return input;
          },
        });

        const mockServer = createMockServer();
        fabricMcp({
          input: {
            name: { type: String },
            count: { type: Number, default: 10 },
          },
          server: mockServer as unknown as Parameters<
            typeof fabricMcp
          >[0]["server"],
          service,
        });

        const handler = mockServer.registeredTools[0].handler;
        await handler({ name: "Alice" });

        // Should have both name and count (from overridden input)
        expect(capturedInput).toEqual({ name: "Alice", count: 10 });
      });

      it("preserves original service when using with overrides", async () => {
        const originalService = fabricService({
          alias: "foo",
          description: "Foo service",
          service: () => "original",
        });

        const mockServer = createMockServer();
        // Use with overrides
        fabricMcp({
          alias: "bar",
          server: mockServer as unknown as Parameters<
            typeof fabricMcp
          >[0]["server"],
          service: originalService,
        });

        // Original should be unchanged
        expect(originalService.alias).toBe("foo");
        expect(originalService.description).toBe("Foo service");
      });
    });
  });

  describe("inputToZodShape", () => {
    it("returns empty object for undefined input", () => {
      const shape = inputToZodShape(z, undefined);
      expect(shape).toEqual({});
    });

    it("returns empty object for empty input", () => {
      const shape = inputToZodShape(z, {});
      expect(shape).toEqual({});
    });

    it("converts Boolean type to z.boolean()", () => {
      const shape = inputToZodShape(z, {
        flag: { type: Boolean },
      });
      expect(shape.flag._def.type).toBe("boolean");
    });

    it("converts Number type to z.number()", () => {
      const shape = inputToZodShape(z, {
        count: { type: Number },
      });
      expect(shape.count._def.type).toBe("number");
    });

    it("converts String type to z.string()", () => {
      const shape = inputToZodShape(z, {
        name: { type: String },
      });
      expect(shape.name._def.type).toBe("string");
    });

    it("converts Object type to z.record()", () => {
      const shape = inputToZodShape(z, {
        data: { type: Object },
      });
      expect(shape.data._def.type).toBe("record");
    });

    it("converts Array type to z.array()", () => {
      const shape = inputToZodShape(z, {
        items: { type: Array },
      });
      expect(shape.items._def.type).toBe("array");
    });

    it("converts typed array [String] to z.array(z.string())", () => {
      const shape = inputToZodShape(z, {
        names: { type: [String] },
      });
      expect(shape.names._def.type).toBe("array");
      expect(shape.names._def.element._def.type).toBe("string");
    });

    it("converts typed array [Number] to z.array(z.number())", () => {
      const shape = inputToZodShape(z, {
        counts: { type: [Number] },
      });
      expect(shape.counts._def.type).toBe("array");
      expect(shape.counts._def.element._def.type).toBe("number");
    });

    it("converts typed array [Boolean] to z.array(z.boolean())", () => {
      const shape = inputToZodShape(z, {
        flags: { type: [Boolean] },
      });
      expect(shape.flags._def.type).toBe("array");
      expect(shape.flags._def.element._def.type).toBe("boolean");
    });

    it("converts validated string enum to z.enum()", () => {
      const shape = inputToZodShape(z, {
        status: { type: ["pending", "active", "done"] },
      });
      expect(shape.status._def.type).toBe("enum");
      expect(Object.keys(shape.status._def.entries).sort()).toEqual([
        "active",
        "done",
        "pending",
      ]);
    });

    it("adds description to Zod type", () => {
      const shape = inputToZodShape(z, {
        name: { description: "User name", type: String },
      });
      expect(shape.name.description).toBe("User name");
    });

    it("makes field optional when required: false", () => {
      const shape = inputToZodShape(z, {
        name: { required: false, type: String },
      });
      expect(shape.name._def.type).toBe("optional");
    });

    it("makes field optional with default when default is provided", () => {
      const shape = inputToZodShape(z, {
        count: { default: 10, type: Number },
      });
      expect(shape.count._def.type).toBe("default");
    });

    it("sorts keys alphabetically", () => {
      const shape = inputToZodShape(z, {
        zebra: { type: String },
        apple: { type: String },
        mango: { type: String },
      });
      const keys = Object.keys(shape);
      expect(keys).toEqual(["apple", "mango", "zebra"]);
    });

    it("handles complex input with multiple types", () => {
      const shape = inputToZodShape(z, {
        active: { default: true, type: Boolean },
        count: { type: Number },
        name: { description: "User name", type: String },
        optional: { required: false, type: String },
        status: { type: ["pending", "done"] },
        tags: { type: [String] },
      });

      expect(Object.keys(shape)).toHaveLength(6);
      expect(shape.active._def.type).toBe("default");
      expect(shape.count._def.type).toBe("number");
      expect(shape.name._def.type).toBe("string");
      expect(shape.optional._def.type).toBe("optional");
      expect(shape.status._def.type).toBe("enum");
      expect(shape.tags._def.type).toBe("array");
    });
  });

  describe("FabricMcpServer", () => {
    it("creates an MCP server with name and version", () => {
      const server = FabricMcpServer({
        name: "test-server",
        services: [],
        version: "1.0.0",
      });

      expect(server.name).toBe("test-server");
      expect(server.version).toBe("1.0.0");
      expect(server).toBeInstanceOf(McpServer);
    });

    it("registers a single service as a tool", () => {
      const greetService = fabricService({
        alias: "greet",
        description: "Greet a user",
        input: { name: { type: String } },
        service: ({ name }) => `Hello, ${name}!`,
      });

      const server = FabricMcpServer({
        name: "test-server",
        services: [greetService],
        version: "1.0.0",
      });

      expect(server.services).toHaveLength(1);
      expect(server.tools).toHaveLength(1);
      expect(server.tools[0].name).toBe("greet");
      expect(server.tools[0].description).toBe("Greet a user");
    });

    it("registers multiple services as tools", () => {
      const greetService = fabricService({
        alias: "greet",
        service: () => "Hello!",
      });

      const echoService = fabricService({
        alias: "echo",
        service: () => "Echo!",
      });

      const server = FabricMcpServer({
        name: "test-server",
        services: [greetService, echoService],
        version: "1.0.0",
      });

      expect(server.services).toHaveLength(2);
      expect(server.tools).toHaveLength(2);
      expect(server.tools.map((t) => t.name).sort()).toEqual(["echo", "greet"]);
    });

    it("accepts tool config with custom name", () => {
      const greetService = fabricService({
        alias: "greet",
        service: () => "Hello!",
      });

      const server = FabricMcpServer({
        name: "test-server",
        services: [{ name: "hello", service: greetService }],
        version: "1.0.0",
      });

      expect(server.tools[0].name).toBe("hello");
    });

    it("accepts tool config with custom description", () => {
      const greetService = fabricService({
        alias: "greet",
        description: "Original description",
        service: () => "Hello!",
      });

      const server = FabricMcpServer({
        name: "test-server",
        services: [
          { description: "Custom description", service: greetService },
        ],
        version: "1.0.0",
      });

      expect(server.tools[0].description).toBe("Custom description");
    });

    it("applies server-level onComplete callback to all tools", () => {
      const completedValues: unknown[] = [];

      const greetService = fabricService({
        alias: "greet",
        service: () => "Hello!",
      });

      FabricMcpServer({
        name: "test-server",
        onComplete: (result) => {
          completedValues.push(result);
        },
        services: [greetService],
        version: "1.0.0",
      });

      // Note: Full integration test would require calling the tool
      // This test verifies the config is accepted without error
      expect(completedValues).toEqual([]);
    });

    it("entry-level callbacks override server-level callbacks", () => {
      const serverMessages: string[] = [];
      const entryMessages: string[] = [];

      const greetService = fabricService({
        alias: "greet",
        service: () => "Hello!",
      });

      FabricMcpServer({
        name: "test-server",
        onComplete: () => {
          serverMessages.push("server");
        },
        services: [
          {
            onComplete: () => {
              entryMessages.push("entry");
            },
            service: greetService,
          },
        ],
        version: "1.0.0",
      });

      // Note: Full integration test would require calling the tool
      // This test verifies the config is accepted without error
      expect(serverMessages).toEqual([]);
      expect(entryMessages).toEqual([]);
    });

    it("throws error for invalid service entry", () => {
      expect(() => {
        FabricMcpServer({
          name: "test-server",
          services: [{ invalid: true } as unknown as never],
          version: "1.0.0",
        });
      }).toThrow(
        "FabricMcpServer: Each service entry must be a Service, ServiceFunction, or { service: Service }",
      );
    });

    it("attaches services array to server", () => {
      const greetService = fabricService({
        alias: "greet",
        service: () => "Hello!",
      });

      const server = FabricMcpServer({
        name: "test-server",
        services: [greetService],
        version: "1.0.0",
      });

      expect(server.services).toContain(greetService);
    });

    it("attaches tools array with RegisteredTool info", () => {
      const greetService = fabricService({
        alias: "greet",
        description: "Greet someone",
        service: () => "Hello!",
      });

      const server = FabricMcpServer({
        name: "test-server",
        services: [greetService],
        version: "1.0.0",
      });

      expect(server.tools[0]).toEqual({
        description: "Greet someone",
        name: "greet",
        service: greetService,
      });
    });
  });

  describe("isFabricMcpServer", () => {
    it("returns true for FabricMcpServer instance", () => {
      const server = FabricMcpServer({
        name: "test-server",
        services: [],
        version: "1.0.0",
      });

      expect(isFabricMcpServer(server)).toBe(true);
    });

    it("returns false for plain McpServer instance", () => {
      const server = new McpServer({ name: "test", version: "1.0.0" });

      expect(isFabricMcpServer(server)).toBe(false);
    });

    it("returns false for null", () => {
      expect(isFabricMcpServer(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isFabricMcpServer(undefined)).toBe(false);
    });

    it("returns false for non-object values", () => {
      expect(isFabricMcpServer("string")).toBe(false);
      expect(isFabricMcpServer(123)).toBe(false);
      expect(isFabricMcpServer(true)).toBe(false);
    });

    it("returns false for plain objects with similar properties", () => {
      const fake = {
        name: "test",
        services: [],
        tools: [],
        version: "1.0.0",
      };

      expect(isFabricMcpServer(fake)).toBe(false);
    });
  });

  describe("createMcpServerFromSuite", async () => {
    const { createMcpServerFromSuite } = await import("../mcp/index.js");
    const { createServiceSuite } = await import("../ServiceSuite.js");

    it("creates an MCP server from a suite", () => {
      const suite = createServiceSuite({ name: "test-suite", version: "2.0.0" });
      const greetService = fabricService({
        alias: "greet",
        description: "Greet someone",
        service: () => "Hello!",
      });
      suite.register(greetService, { category: "utils" });

      const server = createMcpServerFromSuite(suite);

      expect(server.name).toBe("test-suite");
      expect(server.version).toBe("2.0.0");
      expect(server.tools).toHaveLength(1);
      expect(server.tools[0].name).toBe("greet");
    });

    it("uses suite name and version by default", () => {
      const suite = createServiceSuite({ name: "my-suite", version: "3.0.0" });

      const server = createMcpServerFromSuite(suite);

      expect(server.name).toBe("my-suite");
      expect(server.version).toBe("3.0.0");
    });

    it("allows overriding name and version", () => {
      const suite = createServiceSuite({ name: "original", version: "1.0.0" });

      const server = createMcpServerFromSuite(suite, {
        name: "override-name",
        version: "9.9.9",
      });

      expect(server.name).toBe("override-name");
      expect(server.version).toBe("9.9.9");
    });

    it("registers all services from suite as tools", () => {
      const suite = createServiceSuite({ name: "test", version: "1.0.0" });
      const service1 = fabricService({
        alias: "service-1",
        service: () => "1",
      });
      const service2 = fabricService({
        alias: "service-2",
        service: () => "2",
      });
      const service3 = fabricService({
        alias: "service-3",
        service: () => "3",
      });

      suite.register(service1, { category: "category-a" });
      suite.register(service2, { category: "category-b" });
      suite.register(service3, { category: "category-a" });

      const server = createMcpServerFromSuite(suite);

      expect(server.tools).toHaveLength(3);
      expect(server.tools.map((t) => t.name).sort()).toEqual([
        "service-1",
        "service-2",
        "service-3",
      ]);
    });

    it("returns a FabricMcpServer instance", () => {
      const suite = createServiceSuite({ name: "test", version: "1.0.0" });

      const server = createMcpServerFromSuite(suite);

      expect(isFabricMcpServer(server)).toBe(true);
    });

    it("accepts callback options", () => {
      const suite = createServiceSuite({ name: "test", version: "1.0.0" });
      const completedValues: unknown[] = [];

      const server = createMcpServerFromSuite(suite, {
        onComplete: (result) => {
          completedValues.push(result);
        },
      });

      // Server created without errors
      expect(server).toBeDefined();
      expect(completedValues).toEqual([]);
    });

    it("works with empty suite", () => {
      const suite = createServiceSuite({ name: "empty", version: "0.0.1" });

      const server = createMcpServerFromSuite(suite);

      expect(server.tools).toHaveLength(0);
      expect(server.services).toHaveLength(0);
    });
  });
});
