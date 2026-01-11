// Tests for LLM adapter

import { describe, expect, it } from "vitest";

import { createLlmTool, inputToJsonSchema } from "../llm/index.js";
import { serviceHandler } from "../serviceHandler.js";
import type { InputFieldDefinition } from "../types.js";

describe("LLM Adapter", () => {
  describe("inputToJsonSchema", () => {
    it("returns empty schema when no input defined", () => {
      const schema = inputToJsonSchema();
      expect(schema).toEqual({
        properties: {},
        required: [],
        type: "object",
      });
    });

    it("returns empty schema when input is empty object", () => {
      const schema = inputToJsonSchema({});
      expect(schema).toEqual({
        properties: {},
        required: [],
        type: "object",
      });
    });

    it("converts String type to JSON Schema string", () => {
      const input: Record<string, InputFieldDefinition> = {
        name: { type: String, description: "User name" },
      };
      const schema = inputToJsonSchema(input);

      expect(schema.properties.name).toEqual({
        description: "User name",
        type: "string",
      });
      expect(schema.required).toContain("name");
    });

    it("converts Number type to JSON Schema number", () => {
      const input: Record<string, InputFieldDefinition> = {
        age: { type: Number, description: "User age" },
      };
      const schema = inputToJsonSchema(input);

      expect(schema.properties.age).toEqual({
        description: "User age",
        type: "number",
      });
    });

    it("converts Boolean type to JSON Schema boolean", () => {
      const input: Record<string, InputFieldDefinition> = {
        active: { type: Boolean, description: "Is active" },
      };
      const schema = inputToJsonSchema(input);

      expect(schema.properties.active).toEqual({
        description: "Is active",
        type: "boolean",
      });
    });

    it("converts Date type to JSON Schema string", () => {
      const input: Record<string, InputFieldDefinition> = {
        startDate: { type: Date, description: "Start date" },
      };
      const schema = inputToJsonSchema(input);

      expect(schema.properties.startDate).toEqual({
        description: "Start date",
        type: "string",
      });
    });

    it("converts Object type to JSON Schema object", () => {
      const input: Record<string, InputFieldDefinition> = {
        config: { type: Object, description: "Configuration" },
      };
      const schema = inputToJsonSchema(input);

      expect(schema.properties.config).toEqual({
        description: "Configuration",
        type: "object",
      });
    });

    it("converts Array type to JSON Schema array", () => {
      const input: Record<string, InputFieldDefinition> = {
        items: { type: Array, description: "Items list" },
      };
      const schema = inputToJsonSchema(input);

      expect(schema.properties.items).toEqual({
        description: "Items list",
        type: "array",
      });
    });

    it("converts typed array [String] to JSON Schema array with items", () => {
      const input: Record<string, InputFieldDefinition> = {
        tags: { type: [String], description: "Tags" },
      };
      const schema = inputToJsonSchema(input);

      expect(schema.properties.tags).toEqual({
        description: "Tags",
        items: { type: "string" },
        type: "array",
      });
    });

    it("converts typed array [Number] to JSON Schema array with items", () => {
      const input: Record<string, InputFieldDefinition> = {
        scores: { type: [Number], description: "Scores" },
      };
      const schema = inputToJsonSchema(input);

      expect(schema.properties.scores).toEqual({
        description: "Scores",
        items: { type: "number" },
        type: "array",
      });
    });

    it("converts validated string type to enum", () => {
      const input: Record<string, InputFieldDefinition> = {
        status: {
          type: ["active", "inactive", "pending"],
          description: "Status",
        },
      };
      const schema = inputToJsonSchema(input);

      expect(schema.properties.status).toEqual({
        description: "Status",
        enum: ["active", "inactive", "pending"],
        type: "string",
      });
    });

    it("converts validated number type to enum", () => {
      const input: Record<string, InputFieldDefinition> = {
        priority: { type: [1, 2, 3], description: "Priority level" },
      };
      const schema = inputToJsonSchema(input);

      expect(schema.properties.priority).toEqual({
        description: "Priority level",
        enum: [1, 2, 3],
        type: "number",
      });
    });

    it("converts RegExp type to string (no enum for patterns)", () => {
      const input: Record<string, InputFieldDefinition> = {
        email: { type: /^.+@.+\..+$/, description: "Email address" },
      };
      const schema = inputToJsonSchema(input);

      expect(schema.properties.email).toEqual({
        description: "Email address",
        type: "string",
      });
    });

    it("marks fields with default as not required", () => {
      const input: Record<string, InputFieldDefinition> = {
        format: { type: String, default: "json", description: "Output format" },
      };
      const schema = inputToJsonSchema(input);

      expect(schema.required).not.toContain("format");
    });

    it("marks fields with required: false as not required", () => {
      const input: Record<string, InputFieldDefinition> = {
        prefix: {
          type: String,
          required: false,
          description: "Optional prefix",
        },
      };
      const schema = inputToJsonSchema(input);

      expect(schema.required).not.toContain("prefix");
    });

    it("excludes specified fields", () => {
      const input: Record<string, InputFieldDefinition> = {
        age: { type: Number },
        name: { type: String },
        secret: { type: String },
      };
      const schema = inputToJsonSchema(input, { exclude: ["secret"] });

      expect(schema.properties).toHaveProperty("name");
      expect(schema.properties).toHaveProperty("age");
      expect(schema.properties).not.toHaveProperty("secret");
    });

    it("alphabetizes properties", () => {
      const input: Record<string, InputFieldDefinition> = {
        zebra: { type: String },
        apple: { type: String },
        mango: { type: String },
      };
      const schema = inputToJsonSchema(input);

      const keys = Object.keys(schema.properties);
      expect(keys).toEqual(["apple", "mango", "zebra"]);
    });

    it("works with string type names", () => {
      const input: Record<string, InputFieldDefinition> = {
        active: { type: "boolean" },
        age: { type: "number" },
        name: { type: "string" },
      };
      const schema = inputToJsonSchema(input);

      expect(schema.properties.name.type).toBe("string");
      expect(schema.properties.age.type).toBe("number");
      expect(schema.properties.active.type).toBe("boolean");
    });
  });

  describe("createLlmTool", () => {
    it("creates a tool with handler alias as name", () => {
      const handler = serviceHandler({
        alias: "greet",
        service: () => "Hello!",
      });

      const { tool } = createLlmTool({ handler });

      expect(tool.name).toBe("greet");
    });

    it("creates a tool with handler description", () => {
      const handler = serviceHandler({
        alias: "greet",
        description: "Greet a user",
        service: () => "Hello!",
      });

      const { tool } = createLlmTool({ handler });

      expect(tool.description).toBe("Greet a user");
    });

    it("uses custom name over handler alias", () => {
      const handler = serviceHandler({
        alias: "greet",
        service: () => "Hello!",
      });

      const { tool } = createLlmTool({ handler, name: "hello" });

      expect(tool.name).toBe("hello");
    });

    it("uses custom description over handler description", () => {
      const handler = serviceHandler({
        alias: "greet",
        description: "Handler description",
        service: () => "Hello!",
      });

      const { tool } = createLlmTool({
        description: "Custom description",
        handler,
      });

      expect(tool.description).toBe("Custom description");
    });

    it("defaults to 'tool' when no alias or name provided", () => {
      const handler = serviceHandler({
        service: () => "Hello!",
      });

      const { tool } = createLlmTool({ handler });

      expect(tool.name).toBe("tool");
    });

    it("defaults to empty description when none provided", () => {
      const handler = serviceHandler({
        alias: "test",
        service: () => "Hello!",
      });

      const { tool } = createLlmTool({ handler });

      expect(tool.description).toBe("");
    });

    it("sets type to function", () => {
      const handler = serviceHandler({
        alias: "test",
        service: () => "Hello!",
      });

      const { tool } = createLlmTool({ handler });

      expect(tool.type).toBe("function");
    });

    it("converts handler input to JSON Schema parameters", () => {
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

      const { tool } = createLlmTool({ handler });

      expect(tool.parameters).toEqual({
        properties: {
          loud: { type: "boolean" },
          name: { description: "User name", type: "string" },
        },
        required: ["name"],
        type: "object",
      });
    });

    it("excludes specified fields from parameters", () => {
      const handler = serviceHandler({
        alias: "test",
        input: {
          name: { type: String },
          secret: { type: String },
        },
        service: (input) => input,
      });

      const { tool } = createLlmTool({
        exclude: ["secret"],
        handler,
      });

      expect(tool.parameters.properties).toHaveProperty("name");
      expect(tool.parameters.properties).not.toHaveProperty("secret");
    });

    it("call function invokes the handler", async () => {
      const handler = serviceHandler({
        alias: "greet",
        input: {
          name: { type: String },
        },
        service: ({ name }) => `Hello, ${name}!`,
      });

      const { tool } = createLlmTool({ handler });

      const result = await tool.call({ name: "Alice" });

      expect(result).toBe("Hello, Alice!");
    });

    it("call function handles async handlers", async () => {
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

      const { tool } = createLlmTool({ handler });

      const result = await tool.call({ ms: 10 });

      expect(result).toBe("done");
    });

    it("call function handles handlers with no input", async () => {
      const handler = serviceHandler({
        alias: "ping",
        service: () => "pong",
      });

      const { tool } = createLlmTool({ handler });

      const result = await tool.call();

      expect(result).toBe("pong");
    });

    it("includes string message when provided", () => {
      const handler = serviceHandler({
        alias: "test",
        service: () => "result",
      });

      const { tool } = createLlmTool({
        handler,
        message: "Executing test",
      });

      expect(tool.message).toBe("Executing test");
    });

    it("includes function message when provided", () => {
      const handler = serviceHandler({
        alias: "greet",
        input: {
          name: { type: String },
        },
        service: ({ name }) => `Hello, ${name}!`,
      });

      const messageFunc = (args?: Record<string, unknown>) =>
        `Greeting ${args?.name}`;

      const { tool } = createLlmTool({
        handler,
        message: messageFunc,
      });

      expect(tool.message).toBe(messageFunc);
    });

    it("does not include message when not provided", () => {
      const handler = serviceHandler({
        alias: "test",
        service: () => "result",
      });

      const { tool } = createLlmTool({ handler });

      expect(tool.message).toBeUndefined();
    });

    it("full integration: creates working LLM tool from handler", async () => {
      const handler = serviceHandler({
        alias: "calculate",
        description: "Calculate the sum of two numbers",
        input: {
          a: { type: Number, description: "First number" },
          b: { type: Number, description: "Second number" },
        },
        service: ({ a, b }) => a + b,
      });

      const { tool } = createLlmTool({ handler });

      expect(tool.name).toBe("calculate");
      expect(tool.description).toBe("Calculate the sum of two numbers");
      expect(tool.type).toBe("function");
      expect(tool.parameters).toEqual({
        properties: {
          a: { description: "First number", type: "number" },
          b: { description: "Second number", type: "number" },
        },
        required: ["a", "b"],
        type: "object",
      });

      const result = await tool.call({ a: 5, b: 3 });
      expect(result).toBe(8);
    });

    describe("sendMessage and onMessage", () => {
      it("passes context with sendMessage to service when onMessage is provided", async () => {
        const messages: Array<{ content: string; level?: string }> = [];

        const handler = serviceHandler({
          alias: "test",
          input: { name: { type: String } },
          service: ({ name }, context) => {
            context?.sendMessage?.({ content: `Processing ${name}` });
            return `Hello, ${name}!`;
          },
        });

        const { tool } = createLlmTool({
          handler,
          onMessage: (msg) => {
            messages.push(msg);
          },
        });

        const result = await tool.call({ name: "Alice" });

        expect(result).toBe("Hello, Alice!");
        expect(messages).toEqual([{ content: "Processing Alice" }]);
      });

      it("swallows errors in onMessage callback", async () => {
        const handler = serviceHandler({
          alias: "test",
          service: (_, context) => {
            context?.sendMessage?.({ content: "Message" });
            return "completed";
          },
        });

        let callCount = 0;
        const { tool } = createLlmTool({
          handler,
          onMessage: () => {
            callCount++;
            throw new Error("onMessage error");
          },
        });

        const result = await tool.call();

        expect(result).toBe("completed");
        expect(callCount).toBe(1);
      });
    });

    describe("onComplete callback", () => {
      it("calls onComplete with result on success", async () => {
        let completedValue: unknown;

        const handler = serviceHandler({
          alias: "test",
          input: { value: { type: Number } },
          service: ({ value }) => value * 2,
        });

        const { tool } = createLlmTool({
          handler,
          onComplete: (result) => {
            completedValue = result;
          },
        });

        await tool.call({ value: 21 });

        expect(completedValue).toBe(42);
      });

      it("swallows errors in onComplete callback", async () => {
        const handler = serviceHandler({
          alias: "test",
          service: () => "result",
        });

        const { tool } = createLlmTool({
          handler,
          onComplete: () => {
            throw new Error("onComplete error");
          },
        });

        const result = await tool.call();

        expect(result).toBe("result");
      });
    });

    describe("onError and onFatal callbacks", () => {
      it("calls onFatal when handler throws", async () => {
        let fatalError: unknown;

        const handler = serviceHandler({
          alias: "test",
          service: () => {
            throw new Error("Service error");
          },
        });

        const { tool } = createLlmTool({
          handler,
          onFatal: (error) => {
            fatalError = error;
          },
        });

        await expect(tool.call()).rejects.toThrow("Service error");
        expect(fatalError).toBeInstanceOf(Error);
        expect((fatalError as Error).message).toBe("Service error");
      });

      it("falls back to onError when onFatal is not provided", async () => {
        let errorValue: unknown;

        const handler = serviceHandler({
          alias: "test",
          service: () => {
            throw new Error("Service error");
          },
        });

        const { tool } = createLlmTool({
          handler,
          onError: (error) => {
            errorValue = error;
          },
        });

        await expect(tool.call()).rejects.toThrow("Service error");
        expect(errorValue).toBeInstanceOf(Error);
        expect((errorValue as Error).message).toBe("Service error");
      });

      it("passes context.onError to service for recoverable errors", async () => {
        let recoveredError: unknown;

        const handler = serviceHandler({
          alias: "test",
          service: (_, context) => {
            context?.onError?.(new Error("Recoverable error"));
            return "continued";
          },
        });

        const { tool } = createLlmTool({
          handler,
          onError: (error) => {
            recoveredError = error;
          },
        });

        const result = await tool.call();

        expect(result).toBe("continued");
        expect(recoveredError).toBeInstanceOf(Error);
        expect((recoveredError as Error).message).toBe("Recoverable error");
      });

      it("passes context.onFatal to service for explicit fatal errors", async () => {
        let fatalError: unknown;

        const handler = serviceHandler({
          alias: "test",
          service: (_, context) => {
            context?.onFatal?.(new Error("Fatal error"));
            return "continued";
          },
        });

        const { tool } = createLlmTool({
          handler,
          onFatal: (error) => {
            fatalError = error;
          },
        });

        const result = await tool.call();

        expect(result).toBe("continued");
        expect(fatalError).toBeInstanceOf(Error);
        expect((fatalError as Error).message).toBe("Fatal error");
      });

      it("swallows errors in context.onError callback", async () => {
        const handler = serviceHandler({
          alias: "test",
          service: (_, context) => {
            context?.onError?.(new Error("Test error"));
            return "completed";
          },
        });

        const { tool } = createLlmTool({
          handler,
          onError: () => {
            throw new Error("Callback error");
          },
        });

        const result = await tool.call();

        expect(result).toBe("completed");
      });
    });
  });
});
