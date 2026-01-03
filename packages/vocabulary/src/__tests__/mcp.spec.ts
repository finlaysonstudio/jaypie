// Tests for MCP adapter

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { inputToZodSchema, registerMcpTool } from "../mcp/index.js";
import { serviceHandler } from "../serviceHandler.js";
import type { InputFieldDefinition } from "../types.js";

describe("MCP Adapter", () => {
  describe("inputToZodSchema", () => {
    it("returns empty schema when no input defined", () => {
      const schema = inputToZodSchema();
      expect(schema).toEqual({});
    });

    it("returns empty schema when input is empty object", () => {
      const schema = inputToZodSchema({});
      expect(schema).toEqual({});
    });

    it("converts String type to Zod string", () => {
      const input: Record<string, InputFieldDefinition> = {
        name: { type: String, description: "User name" },
      };
      const schema = inputToZodSchema(input);

      expect(schema.name).toBeDefined();
      // Test via parsing behavior
      expect(() => schema.name.parse("test")).not.toThrow();
      expect(() => schema.name.parse(123)).toThrow();
    });

    it("converts Number type to Zod number", () => {
      const input: Record<string, InputFieldDefinition> = {
        age: { type: Number, description: "User age" },
      };
      const schema = inputToZodSchema(input);

      expect(schema.age).toBeDefined();
      expect(() => schema.age.parse(25)).not.toThrow();
      expect(() => schema.age.parse("25")).toThrow();
    });

    it("converts Boolean type to Zod boolean", () => {
      const input: Record<string, InputFieldDefinition> = {
        active: { type: Boolean, description: "Is active" },
      };
      const schema = inputToZodSchema(input);

      expect(schema.active).toBeDefined();
      expect(() => schema.active.parse(true)).not.toThrow();
      expect(() => schema.active.parse("true")).toThrow();
    });

    it("converts Object type to Zod record", () => {
      const input: Record<string, InputFieldDefinition> = {
        config: { type: Object, description: "Configuration" },
      };
      const schema = inputToZodSchema(input);

      expect(schema.config).toBeDefined();
      expect(() => schema.config.parse({ key: "value" })).not.toThrow();
      expect(() => schema.config.parse("string")).toThrow();
    });

    it("converts Array type to Zod array", () => {
      const input: Record<string, InputFieldDefinition> = {
        items: { type: Array, description: "Items list" },
      };
      const schema = inputToZodSchema(input);

      expect(schema.items).toBeDefined();
      expect(() => schema.items.parse([1, 2, 3])).not.toThrow();
      expect(() => schema.items.parse("not-array")).toThrow();
    });

    it("converts typed array [String] to Zod array of strings", () => {
      const input: Record<string, InputFieldDefinition> = {
        tags: { type: [String], description: "Tags" },
      };
      const schema = inputToZodSchema(input);

      expect(schema.tags).toBeDefined();
      expect(() => schema.tags.parse(["a", "b", "c"])).not.toThrow();
      expect(() => schema.tags.parse([1, 2, 3])).toThrow();
    });

    it("converts typed array [Number] to Zod array of numbers", () => {
      const input: Record<string, InputFieldDefinition> = {
        scores: { type: [Number], description: "Scores" },
      };
      const schema = inputToZodSchema(input);

      expect(schema.scores).toBeDefined();
      expect(() => schema.scores.parse([1, 2, 3])).not.toThrow();
      expect(() => schema.scores.parse(["a", "b"])).toThrow();
    });

    it("converts validated string type to Zod enum", () => {
      const input: Record<string, InputFieldDefinition> = {
        status: {
          type: ["active", "inactive", "pending"],
          description: "Status",
        },
      };
      const schema = inputToZodSchema(input);

      expect(schema.status).toBeDefined();
      expect(() => schema.status.parse("active")).not.toThrow();
      expect(() => schema.status.parse("inactive")).not.toThrow();
      expect(() => schema.status.parse("invalid")).toThrow();
    });

    it("converts validated number type to Zod union of literals", () => {
      const input: Record<string, InputFieldDefinition> = {
        priority: { type: [1, 2, 3], description: "Priority level" },
      };
      const schema = inputToZodSchema(input);

      expect(schema.priority).toBeDefined();
      expect(() => schema.priority.parse(1)).not.toThrow();
      expect(() => schema.priority.parse(2)).not.toThrow();
      expect(() => schema.priority.parse(4)).toThrow();
    });

    it("converts single validated number to Zod literal", () => {
      const input: Record<string, InputFieldDefinition> = {
        version: { type: [1], description: "Version" },
      };
      const schema = inputToZodSchema(input);

      expect(schema.version).toBeDefined();
      expect(() => schema.version.parse(1)).not.toThrow();
      expect(() => schema.version.parse(2)).toThrow();
    });

    it("converts RegExp type to Zod string", () => {
      const input: Record<string, InputFieldDefinition> = {
        email: { type: /^.+@.+\..+$/, description: "Email address" },
      };
      const schema = inputToZodSchema(input);

      expect(schema.email).toBeDefined();
      expect(() => schema.email.parse("test@example.com")).not.toThrow();
      expect(() => schema.email.parse(123)).toThrow();
    });

    it("makes fields with default optional", () => {
      const input: Record<string, InputFieldDefinition> = {
        format: { type: String, default: "json", description: "Output format" },
      };
      const schema = inputToZodSchema(input);

      expect(schema.format).toBeDefined();
      // Optional fields allow undefined
      expect(() => schema.format.parse(undefined)).not.toThrow();
      expect(() => schema.format.parse("xml")).not.toThrow();
    });

    it("makes fields with required: false optional", () => {
      const input: Record<string, InputFieldDefinition> = {
        prefix: {
          type: String,
          required: false,
          description: "Optional prefix",
        },
      };
      const schema = inputToZodSchema(input);

      expect(schema.prefix).toBeDefined();
      // Optional fields allow undefined
      expect(() => schema.prefix.parse(undefined)).not.toThrow();
      expect(() => schema.prefix.parse("pre")).not.toThrow();
    });

    it("excludes specified fields", () => {
      const input: Record<string, InputFieldDefinition> = {
        age: { type: Number },
        name: { type: String },
        secret: { type: String },
      };
      const schema = inputToZodSchema(input, { exclude: ["secret"] });

      expect(schema).toHaveProperty("name");
      expect(schema).toHaveProperty("age");
      expect(schema).not.toHaveProperty("secret");
    });

    it("alphabetizes properties", () => {
      const input: Record<string, InputFieldDefinition> = {
        zebra: { type: String },
        apple: { type: String },
        mango: { type: String },
      };
      const schema = inputToZodSchema(input);

      const keys = Object.keys(schema);
      expect(keys).toEqual(["apple", "mango", "zebra"]);
    });

    it("works with string type names", () => {
      const input: Record<string, InputFieldDefinition> = {
        active: { type: "boolean" },
        age: { type: "number" },
        name: { type: "string" },
      };
      const schema = inputToZodSchema(input);

      // Test via parsing behavior
      expect(() => schema.name.parse("test")).not.toThrow();
      expect(() => schema.age.parse(25)).not.toThrow();
      expect(() => schema.active.parse(true)).not.toThrow();
    });

    it("validates string values correctly", () => {
      const input: Record<string, InputFieldDefinition> = {
        name: { type: String },
      };
      const schema = inputToZodSchema(input);

      expect(() => schema.name.parse("test")).not.toThrow();
      expect(() => schema.name.parse(123)).toThrow();
    });

    it("validates enum values correctly", () => {
      const input: Record<string, InputFieldDefinition> = {
        status: { type: ["active", "inactive"] },
      };
      const schema = inputToZodSchema(input);

      expect(() => schema.status.parse("active")).not.toThrow();
      expect(() => schema.status.parse("invalid")).toThrow();
    });
  });

  describe("registerMcpTool", () => {
    function createMockServer() {
      const registeredTools: Array<{
        name: string;
        description: string;
        schema: Record<string, z.ZodTypeAny>;
        handler: (args: Record<string, unknown>) => Promise<unknown>;
      }> = [];

      return {
        registeredTools,
        tool: vi.fn(
          (
            name: string,
            description: string,
            schema: Record<string, z.ZodTypeAny>,
            handler: (args: Record<string, unknown>) => Promise<unknown>,
          ) => {
            registeredTools.push({ name, description, schema, handler });
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

    it("converts handler input to Zod schema", () => {
      const handler = serviceHandler({
        alias: "greet",
        input: {
          name: { type: String, description: "User name" },
          loud: { type: Boolean, default: false },
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
      expect(schema).toHaveProperty("loud");
      expect(schema).toHaveProperty("name");
    });

    it("excludes specified fields from schema", () => {
      const handler = serviceHandler({
        alias: "test",
        input: {
          name: { type: String },
          secret: { type: String },
        },
        service: (input) => input,
      });

      const mockServer = createMockServer();
      registerMcpTool({
        exclude: ["secret"],
        handler,
        server: mockServer as unknown as Parameters<
          typeof registerMcpTool
        >[0]["server"],
      });

      const schema = mockServer.registeredTools[0].schema;
      expect(schema).toHaveProperty("name");
      expect(schema).not.toHaveProperty("secret");
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
          a: { type: Number, description: "First number" },
          b: { type: Number, description: "Second number" },
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
