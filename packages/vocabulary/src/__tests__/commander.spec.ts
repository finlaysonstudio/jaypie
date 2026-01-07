// Tests for commander adapter

import { Command, Option } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCommanderOptions,
  parseCommanderOptions,
  registerServiceCommand,
} from "../commander/index.js";
import { serviceHandler } from "../serviceHandler.js";
import type { InputFieldDefinition } from "../types.js";

describe("Commander Adapter", () => {
  describe("createCommanderOptions", () => {
    it("returns empty options array when no input defined", () => {
      const { options } = createCommanderOptions();
      expect(options).toEqual([]);
    });

    it("returns empty options array when input is empty object", () => {
      const { options } = createCommanderOptions({});
      expect(options).toEqual([]);
    });

    it("creates Option for string field", () => {
      const input: Record<string, InputFieldDefinition> = {
        name: { type: String, description: "User name" },
      };
      const { options } = createCommanderOptions(input);

      expect(options).toHaveLength(1);
      expect(options[0]).toBeInstanceOf(Option);
      expect(options[0].flags).toBe("--name <name>");
      expect(options[0].description).toBe("User name");
    });

    it("creates Option for number field", () => {
      const input: Record<string, InputFieldDefinition> = {
        age: { type: Number, description: "User age" },
      };
      const { options } = createCommanderOptions(input);

      expect(options).toHaveLength(1);
      expect(options[0].flags).toBe("--age <age>");
    });

    it("creates Option for boolean field without value placeholder", () => {
      const input: Record<string, InputFieldDefinition> = {
        verbose: { type: Boolean, description: "Enable verbose output" },
      };
      const { options } = createCommanderOptions(input);

      expect(options).toHaveLength(1);
      expect(options[0].flags).toBe("--verbose");
    });

    it("creates Option with optional value for field with default", () => {
      const input: Record<string, InputFieldDefinition> = {
        format: { type: String, default: "json", description: "Output format" },
      };
      const { options } = createCommanderOptions(input);

      expect(options).toHaveLength(1);
      expect(options[0].flags).toBe("--format [format]");
    });

    it("creates Option with optional value for field with required: false", () => {
      const input: Record<string, InputFieldDefinition> = {
        prefix: {
          type: String,
          required: false,
          description: "Optional prefix",
        },
      };
      const { options } = createCommanderOptions(input);

      expect(options).toHaveLength(1);
      expect(options[0].flags).toBe("--prefix [prefix]");
    });

    it("converts camelCase to kebab-case", () => {
      const input: Record<string, InputFieldDefinition> = {
        userName: { type: String, description: "User name" },
      };
      const { options } = createCommanderOptions(input);

      expect(options[0].flags).toBe("--user-name <userName>");
    });

    it("creates variadic option for array type", () => {
      const input: Record<string, InputFieldDefinition> = {
        tags: { type: [String], description: "Tags" },
      };
      const { options } = createCommanderOptions(input);

      expect(options[0].flags).toBe("--tags <tags...>");
    });

    it("creates variadic option for Array type", () => {
      const input: Record<string, InputFieldDefinition> = {
        items: { type: Array, description: "Items" },
      };
      const { options } = createCommanderOptions(input);

      expect(options[0].flags).toBe("--items <items...>");
    });

    it("excludes specified fields", () => {
      const input: Record<string, InputFieldDefinition> = {
        name: { type: String },
        secret: { type: String },
        age: { type: Number },
      };
      const { options } = createCommanderOptions(input, {
        exclude: ["secret"],
      });

      expect(options).toHaveLength(2);
      expect(options.map((o) => o.name())).toEqual(["name", "age"]);
    });

    it("applies description override", () => {
      const input: Record<string, InputFieldDefinition> = {
        name: { type: String, description: "Original description" },
      };
      const { options } = createCommanderOptions(input, {
        overrides: {
          name: { description: "Overridden description" },
        },
      });

      expect(options[0].description).toBe("Overridden description");
    });

    it("applies short flag override", () => {
      const input: Record<string, InputFieldDefinition> = {
        verbose: { type: Boolean },
      };
      const { options } = createCommanderOptions(input, {
        overrides: {
          verbose: { short: "v" },
        },
      });

      expect(options[0].flags).toBe("-v, --verbose");
    });

    it("applies flags override completely", () => {
      const input: Record<string, InputFieldDefinition> = {
        name: { type: String },
      };
      const { options } = createCommanderOptions(input, {
        overrides: {
          name: { flags: "-n, --name <value>" },
        },
      });

      expect(options[0].flags).toBe("-n, --name <value>");
    });

    it("hides option from help when specified", () => {
      const input: Record<string, InputFieldDefinition> = {
        internal: { type: String },
      };
      const { options } = createCommanderOptions(input, {
        overrides: {
          internal: { hidden: true },
        },
      });

      expect(options[0].hidden).toBe(true);
    });

    it("works with serviceHandler.input", () => {
      const handler = serviceHandler({
        input: {
          name: { type: String, description: "User name" },
          age: { type: Number, default: 25 },
        },
        service: (input) => input,
      });

      const { options } = createCommanderOptions(handler.input);

      expect(options).toHaveLength(2);
    });

    it("uses flag property from input definition for long flag name", () => {
      const input: Record<string, InputFieldDefinition> = {
        userName: { type: String, flag: "user", description: "User name" },
      };
      const { options } = createCommanderOptions(input);

      expect(options[0].flags).toBe("--user <userName>");
    });

    it("uses letter property from input definition for short flag", () => {
      const input: Record<string, InputFieldDefinition> = {
        verbose: { type: Boolean, letter: "v", description: "Verbose output" },
      };
      const { options } = createCommanderOptions(input);

      expect(options[0].flags).toBe("-v, --verbose");
    });

    it("uses both flag and letter from input definition", () => {
      const input: Record<string, InputFieldDefinition> = {
        userName: {
          type: String,
          flag: "user",
          letter: "u",
          description: "User name",
        },
      };
      const { options } = createCommanderOptions(input);

      expect(options[0].flags).toBe("-u, --user <userName>");
    });

    it("override short takes precedence over input letter", () => {
      const input: Record<string, InputFieldDefinition> = {
        verbose: { type: Boolean, letter: "v", description: "Verbose output" },
      };
      const { options } = createCommanderOptions(input, {
        overrides: { verbose: { short: "V" } },
      });

      expect(options[0].flags).toBe("-V, --verbose");
    });

    it("override long takes precedence over input flag", () => {
      const input: Record<string, InputFieldDefinition> = {
        userName: { type: String, flag: "user", description: "User name" },
      };
      const { options } = createCommanderOptions(input, {
        overrides: { userName: { long: "username" } },
      });

      expect(options[0].flags).toBe("--username <userName>");
    });
  });

  describe("parseCommanderOptions", () => {
    it("returns empty object for empty options", () => {
      const result = parseCommanderOptions({});
      expect(result).toEqual({});
    });

    it("passes through string values", () => {
      const result = parseCommanderOptions({ name: "John" });
      expect(result).toEqual({ name: "John" });
    });

    it("coerces string to number with type definition", () => {
      const input: Record<string, InputFieldDefinition> = {
        age: { type: Number },
      };
      const result = parseCommanderOptions({ age: "25" }, { input });
      expect(result).toEqual({ age: 25 });
    });

    it("coerces string to boolean with type definition", () => {
      const input: Record<string, InputFieldDefinition> = {
        verbose: { type: Boolean },
      };
      const result = parseCommanderOptions({ verbose: "true" }, { input });
      expect(result).toEqual({ verbose: true });
    });

    it("converts kebab-case to camelCase", () => {
      const result = parseCommanderOptions({ "user-name": "John" });
      expect(result).toEqual({ userName: "John" });
    });

    it("excludes specified fields", () => {
      const result = parseCommanderOptions(
        { name: "John", secret: "abc123" },
        { exclude: ["secret"] },
      );
      expect(result).toEqual({ name: "John" });
    });

    it("handles array values", () => {
      const input: Record<string, InputFieldDefinition> = {
        tags: { type: [String] },
      };
      const result = parseCommanderOptions(
        { tags: ["a", "b", "c"] },
        { input },
      );
      expect(result).toEqual({ tags: ["a", "b", "c"] });
    });

    it("parses JSON string to array", () => {
      const input: Record<string, InputFieldDefinition> = {
        items: { type: Array },
      };
      const result = parseCommanderOptions({ items: '["a","b"]' }, { input });
      expect(result).toEqual({ items: ["a", "b"] });
    });

    it("splits comma-separated string to array", () => {
      const input: Record<string, InputFieldDefinition> = {
        tags: { type: [String] },
      };
      const result = parseCommanderOptions({ tags: "a,b,c" }, { input });
      expect(result).toEqual({ tags: ["a", "b", "c"] });
    });

    it("parses JSON string to object", () => {
      const input: Record<string, InputFieldDefinition> = {
        config: { type: Object },
      };
      const result = parseCommanderOptions(
        { config: '{"key":"value"}' },
        { input },
      );
      expect(result).toEqual({ config: { key: "value" } });
    });

    it("handles validated number type", () => {
      const input: Record<string, InputFieldDefinition> = {
        priority: { type: [1, 2, 3, 4, 5] },
      };
      const result = parseCommanderOptions({ priority: "3" }, { input });
      expect(result).toEqual({ priority: 3 });
    });

    it("works with serviceHandler.input", () => {
      const handler = serviceHandler({
        input: {
          name: { type: String },
          age: { type: Number },
        },
        service: (input) => input,
      });

      const result = parseCommanderOptions(
        { name: "John", age: "30" },
        { input: handler.input },
      );

      expect(result).toEqual({ name: "John", age: 30 });
    });
  });

  describe("Integration with Commander.js", () => {
    let program: Command;

    beforeEach(() => {
      program = new Command();
      program.exitOverride();
    });

    it("creates working Commander options from handler input", () => {
      const handler = serviceHandler({
        input: {
          name: { type: String, description: "User name" },
          count: { type: Number, default: 1 },
          verbose: { type: Boolean },
        },
        service: (input) => input,
      });

      const { options } = createCommanderOptions(handler.input);
      options.forEach((opt) => program.addOption(opt));

      program.parse([
        "node",
        "test",
        "--name",
        "John",
        "--count",
        "5",
        "--verbose",
      ]);
      const opts = program.opts();

      expect(opts.name).toBe("John");
      expect(opts.count).toBe("5"); // Commander returns strings
      expect(opts.verbose).toBe(true);
    });

    it("round-trips options through Commander", async () => {
      const handler = serviceHandler({
        input: {
          userName: { type: String },
          maxRetries: { type: Number, default: 3 },
        },
        service: (input) => input,
      });

      const { options } = createCommanderOptions(handler.input);
      options.forEach((opt) => program.addOption(opt));

      program.parse([
        "node",
        "test",
        "--user-name",
        "Alice",
        "--max-retries",
        "5",
      ]);
      const opts = program.opts();

      const input = parseCommanderOptions(opts, {
        input: handler.input,
      });

      const result = await handler(input);
      expect(result).toEqual({ userName: "Alice", maxRetries: 5 });
    });
  });

  describe("registerServiceCommand", () => {
    let program: Command;

    beforeEach(() => {
      program = new Command();
      program.exitOverride();
    });

    it("registers a command with handler alias as name", () => {
      const handler = serviceHandler({
        alias: "greet",
        input: {
          name: { type: String },
        },
        service: ({ name }) => `Hello, ${name}!`,
      });

      const { command } = registerServiceCommand({ handler, program });

      expect(command.name()).toBe("greet");
    });

    it("registers a command with handler description", () => {
      const handler = serviceHandler({
        alias: "greet",
        description: "Greet a user",
        input: {
          name: { type: String },
        },
        service: ({ name }) => `Hello, ${name}!`,
      });

      const { command } = registerServiceCommand({ handler, program });

      expect(command.description()).toBe("Greet a user");
    });

    it("uses custom name over handler alias", () => {
      const handler = serviceHandler({
        alias: "greet",
        input: {
          name: { type: String },
        },
        service: ({ name }) => `Hello, ${name}!`,
      });

      const { command } = registerServiceCommand({
        handler,
        name: "hello",
        program,
      });

      expect(command.name()).toBe("hello");
    });

    it("uses custom description over handler description", () => {
      const handler = serviceHandler({
        alias: "greet",
        description: "Handler description",
        input: {
          name: { type: String },
        },
        service: ({ name }) => `Hello, ${name}!`,
      });

      const { command } = registerServiceCommand({
        description: "Custom description",
        handler,
        program,
      });

      expect(command.description()).toBe("Custom description");
    });

    it("defaults to 'command' when no alias or name provided", () => {
      const handler = serviceHandler({
        input: {
          name: { type: String },
        },
        service: ({ name }) => `Hello, ${name}!`,
      });

      const { command } = registerServiceCommand({ handler, program });

      expect(command.name()).toBe("command");
    });

    it("creates options from handler input", () => {
      const handler = serviceHandler({
        alias: "test",
        input: {
          name: { type: String, description: "User name" },
          count: { type: Number, default: 5 },
        },
        service: (input) => input,
      });

      registerServiceCommand({ handler, program });

      // Parse to trigger option creation
      program.parse(["node", "test", "test", "--name", "Alice"]);

      // Check that options were created
      const testCommand = program.commands.find((c) => c.name() === "test");
      expect(testCommand).toBeDefined();
      expect(testCommand!.options).toHaveLength(2);
    });

    it("excludes specified fields from options", () => {
      const handler = serviceHandler({
        alias: "test",
        input: {
          name: { type: String },
          secret: { type: String },
        },
        service: (input) => input,
      });

      registerServiceCommand({
        exclude: ["secret"],
        handler,
        program,
      });

      const testCommand = program.commands.find((c) => c.name() === "test");
      expect(testCommand!.options).toHaveLength(1);
      expect(testCommand!.options[0].name()).toBe("name");
    });

    it("applies overrides to options", () => {
      const handler = serviceHandler({
        alias: "test",
        input: {
          verbose: { type: Boolean },
        },
        service: (input) => input,
      });

      registerServiceCommand({
        handler,
        overrides: { verbose: { short: "v" } },
        program,
      });

      const testCommand = program.commands.find((c) => c.name() === "test");
      expect(testCommand!.options[0].flags).toBe("-v, --verbose");
    });

    it("respects flag and letter in input definitions", () => {
      const handler = serviceHandler({
        alias: "test",
        input: {
          userName: { type: String, flag: "user", letter: "u" },
        },
        service: (input) => input,
      });

      registerServiceCommand({ handler, program });

      const testCommand = program.commands.find((c) => c.name() === "test");
      expect(testCommand!.options[0].flags).toBe("-u, --user <userName>");
    });

    it("executes handler when command is invoked", async () => {
      let capturedInput: unknown;
      const handler = serviceHandler({
        alias: "test",
        input: {
          name: { type: String },
          count: { type: Number, default: 1 },
        },
        service: (input) => {
          capturedInput = input;
          return input;
        },
      });

      registerServiceCommand({ handler, program });

      await program.parseAsync(["node", "test", "test", "--name", "Bob"]);

      expect(capturedInput).toEqual({ name: "Bob", count: 1 });
    });

    it("coerces types when executing handler", async () => {
      let capturedInput: unknown;
      const handler = serviceHandler({
        alias: "test",
        input: {
          count: { type: Number },
          verbose: { type: Boolean },
        },
        service: (input) => {
          capturedInput = input;
          return input;
        },
      });

      registerServiceCommand({ handler, program });

      await program.parseAsync([
        "node",
        "test",
        "test",
        "--count",
        "42",
        "--verbose",
      ]);

      expect(capturedInput).toEqual({ count: 42, verbose: true });
    });

    it("handles boolean flags with --no- prefix", () => {
      const handler = serviceHandler({
        alias: "test",
        input: {
          verbose: { type: Boolean, default: true },
        },
        service: (input) => input,
      });

      registerServiceCommand({ handler, program });

      // Commander automatically handles --no-verbose for boolean flags
      const testCommand = program.commands.find((c) => c.name() === "test");
      expect(testCommand!.options[0].flags).toBe("--verbose");
    });

    it("works with handler that has no input", async () => {
      let called = false;
      const handler = serviceHandler({
        alias: "ping",
        service: () => {
          called = true;
          return "pong";
        },
      });

      registerServiceCommand({ handler, program });

      await program.parseAsync(["node", "test", "ping"]);

      expect(called).toBe(true);
    });

    it("full integration: greet command example", async () => {
      let capturedResult: unknown;
      const handler = serviceHandler({
        alias: "greet",
        description: "Greet a user",
        input: {
          userName: { type: String, flag: "user", letter: "u" },
          loud: { type: Boolean, letter: "l", default: false },
        },
        service: ({ loud, userName }) => {
          const greeting = `Hello, ${userName}!`;
          capturedResult = loud ? greeting.toUpperCase() : greeting;
          return capturedResult;
        },
      });

      registerServiceCommand({ handler, program });

      await program.parseAsync([
        "node",
        "test",
        "greet",
        "--user",
        "Alice",
        "-l",
      ]);

      expect(capturedResult).toBe("HELLO, ALICE!");
    });

    describe("onComplete callback", () => {
      it("calls onComplete with handler response", async () => {
        let capturedResponse: unknown;
        const handler = serviceHandler({
          alias: "test",
          input: {
            value: { type: Number, default: 42 },
          },
          service: ({ value }) => ({ doubled: value * 2 }),
        });

        registerServiceCommand({
          handler,
          onComplete: (response) => {
            capturedResponse = response;
          },
          program,
        });

        await program.parseAsync(["node", "test", "test"]);

        expect(capturedResponse).toEqual({ doubled: 84 });
      });

      it("does not require onComplete callback", async () => {
        const handler = serviceHandler({
          alias: "test",
          service: () => "result",
        });

        registerServiceCommand({ handler, program });

        // Should not throw
        await expect(
          program.parseAsync(["node", "test", "test"]),
        ).resolves.not.toThrow();
      });

      it("supports async onComplete callback", async () => {
        let completed = false;
        const handler = serviceHandler({
          alias: "test",
          service: () => "result",
        });

        registerServiceCommand({
          handler,
          onComplete: async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            completed = true;
          },
          program,
        });

        await program.parseAsync(["node", "test", "test"]);

        expect(completed).toBe(true);
      });
    });

    describe("onError callback", () => {
      it("calls onError when handler throws", async () => {
        let capturedError: unknown;
        const handler = serviceHandler({
          alias: "test",
          service: () => {
            throw new Error("Handler failed");
          },
        });

        registerServiceCommand({
          handler,
          onError: (error) => {
            capturedError = error;
          },
          program,
        });

        await program.parseAsync(["node", "test", "test"]);

        expect(capturedError).toBeInstanceOf(Error);
        expect((capturedError as Error).message).toBe("Handler failed");
      });

      it("re-throws error when no onError callback provided", async () => {
        const handler = serviceHandler({
          alias: "test",
          service: () => {
            throw new Error("Handler failed");
          },
        });

        registerServiceCommand({ handler, program });

        await expect(
          program.parseAsync(["node", "test", "test"]),
        ).rejects.toThrow("Handler failed");
      });

      it("supports async onError callback", async () => {
        let errorHandled = false;
        const handler = serviceHandler({
          alias: "test",
          service: () => {
            throw new Error("Handler failed");
          },
        });

        registerServiceCommand({
          handler,
          onError: async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            errorHandled = true;
          },
          program,
        });

        await program.parseAsync(["node", "test", "test"]);

        expect(errorHandled).toBe(true);
      });
    });

    describe("onMessage callback", () => {
      it("returns onMessage in result", () => {
        const handler = serviceHandler({
          alias: "test",
          service: () => "result",
        });

        const onMessage = vi.fn();
        const result = registerServiceCommand({
          handler,
          onMessage,
          program,
        });

        expect(result.onMessage).toBe(onMessage);
      });

      it("does not include onMessage when not provided", () => {
        const handler = serviceHandler({
          alias: "test",
          service: () => "result",
        });

        const result = registerServiceCommand({ handler, program });

        expect(result.onMessage).toBeUndefined();
      });
    });

    describe("sendMessage in service context", () => {
      it("service can call sendMessage and onMessage receives the message", async () => {
        const messages: unknown[] = [];
        const handler = serviceHandler({
          alias: "test",
          service: (_input, context) => {
            context?.sendMessage?.({ message: "Starting..." });
            context?.sendMessage?.({ level: "debug", message: "Processing" });
            return "done";
          },
        });

        registerServiceCommand({
          handler,
          onMessage: (msg) => {
            messages.push(msg);
          },
          program,
        });

        await program.parseAsync(["node", "test", "test"]);

        expect(messages).toHaveLength(2);
        expect(messages[0]).toEqual({ message: "Starting..." });
        expect(messages[1]).toEqual({ level: "debug", message: "Processing" });
      });

      it("service works when onMessage is not provided", async () => {
        let contextReceived: unknown;
        const handler = serviceHandler({
          alias: "test",
          service: (_input, context) => {
            contextReceived = context;
            // sendMessage should be undefined, calling it should not throw
            context?.sendMessage?.({ message: "test" });
            return "done";
          },
        });

        registerServiceCommand({ handler, program });

        await program.parseAsync(["node", "test", "test"]);

        expect(contextReceived).toBeDefined();
        expect(
          (contextReceived as { sendMessage: unknown }).sendMessage,
        ).toBeUndefined();
      });

      it("errors in onMessage are swallowed and do not halt execution", async () => {
        let serviceCompleted = false;
        const handler = serviceHandler({
          alias: "test",
          service: (_input, context) => {
            context?.sendMessage?.({ message: "Before error" });
            serviceCompleted = true;
            return "done";
          },
        });

        registerServiceCommand({
          handler,
          onMessage: () => {
            throw new Error("onMessage failed!");
          },
          program,
        });

        // Should not throw even though onMessage throws
        await expect(
          program.parseAsync(["node", "test", "test"]),
        ).resolves.not.toThrow();
        expect(serviceCompleted).toBe(true);
      });

      it("async onMessage errors are swallowed", async () => {
        let serviceCompleted = false;
        const handler = serviceHandler({
          alias: "test",
          service: async (_input, context) => {
            await context?.sendMessage?.({ message: "Async message" });
            serviceCompleted = true;
            return "done";
          },
        });

        registerServiceCommand({
          handler,
          onMessage: async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            throw new Error("Async onMessage failed!");
          },
          program,
        });

        await expect(
          program.parseAsync(["node", "test", "test"]),
        ).resolves.not.toThrow();
        expect(serviceCompleted).toBe(true);
      });

      it("async onMessage callbacks work correctly", async () => {
        const messages: unknown[] = [];
        const handler = serviceHandler({
          alias: "test",
          service: async (_input, context) => {
            await context?.sendMessage?.({ message: "First" });
            await context?.sendMessage?.({ message: "Second" });
            return "done";
          },
        });

        registerServiceCommand({
          handler,
          onMessage: async (msg) => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            messages.push(msg);
          },
          program,
        });

        await program.parseAsync(["node", "test", "test"]);

        expect(messages).toHaveLength(2);
        expect(messages[0]).toEqual({ message: "First" });
        expect(messages[1]).toEqual({ message: "Second" });
      });
    });
  });
});
