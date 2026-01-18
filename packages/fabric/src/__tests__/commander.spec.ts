// Tests for commander adapter

import { Command, Option } from "commander";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCommanderOptions,
  FabricCommander,
  parseCommanderOptions,
  fabricCommand,
} from "../commander/index.js";
import { fabricService } from "../service.js";
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

    it("creates Option for boolean field with negatable form", () => {
      const input: Record<string, InputFieldDefinition> = {
        verbose: { type: Boolean, description: "Enable verbose output" },
      };
      const { options } = createCommanderOptions(input);

      // Boolean fields create 2 options: --flag and --no-flag
      expect(options).toHaveLength(2);
      expect(options[0].flags).toBe("--verbose");
      expect(options[1].flags).toBe("--no-verbose");
    });

    it("creates Option for Date field with value placeholder", () => {
      const input: Record<string, InputFieldDefinition> = {
        startDate: { type: Date, description: "Start date" },
      };
      const { options } = createCommanderOptions(input);

      expect(options).toHaveLength(1);
      expect(options[0].flags).toBe("--start-date <startDate>");
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
      expect(options[1].flags).toBe("--no-verbose");
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

    it("works with fabricService.input", () => {
      const handler = fabricService({
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
      expect(options[1].flags).toBe("--no-verbose");
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
      expect(options[1].flags).toBe("--no-verbose");
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

    it("works with fabricService.input", () => {
      const handler = fabricService({
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

    describe("Date coercion", () => {
      it("coerces ISO string to Date with type definition", () => {
        const input: Record<string, InputFieldDefinition> = {
          startDate: { type: Date },
        };
        const result = parseCommanderOptions(
          { startDate: "2024-01-15T10:30:00Z" },
          { input },
        );
        expect(result.startDate).toBeInstanceOf(Date);
        expect((result.startDate as Date).toISOString()).toBe(
          "2024-01-15T10:30:00.000Z",
        );
      });

      it("coerces date-only string to Date", () => {
        const input: Record<string, InputFieldDefinition> = {
          birthDate: { type: Date },
        };
        const result = parseCommanderOptions(
          { birthDate: "2000-06-15" },
          { input },
        );
        expect(result.birthDate).toBeInstanceOf(Date);
      });

      it("coerces Unix timestamp number to Date", () => {
        const input: Record<string, InputFieldDefinition> = {
          timestamp: { type: Date },
        };
        const timestamp = 1705320600000; // 2024-01-15T10:30:00Z
        const result = parseCommanderOptions({ timestamp }, { input });
        expect(result.timestamp).toBeInstanceOf(Date);
        expect((result.timestamp as Date).getTime()).toBe(timestamp);
      });

      it("passes through Date values unchanged", () => {
        const input: Record<string, InputFieldDefinition> = {
          eventDate: { type: Date },
        };
        const date = new Date("2024-03-20");
        const result = parseCommanderOptions({ eventDate: date }, { input });
        expect(result.eventDate).toBe(date);
      });

      it("returns invalid date string as-is for fabricService to handle", () => {
        const input: Record<string, InputFieldDefinition> = {
          badDate: { type: Date },
        };
        const result = parseCommanderOptions(
          { badDate: "not-a-date" },
          { input },
        );
        // parseCommanderOptions returns as-is, fabricService will throw
        expect(result.badDate).toBe("not-a-date");
      });
    });

    describe("Boolean coercion", () => {
      it("coerces 'true' string to true", () => {
        const input: Record<string, InputFieldDefinition> = {
          enabled: { type: Boolean },
        };
        const result = parseCommanderOptions({ enabled: "true" }, { input });
        expect(result.enabled).toBe(true);
      });

      it("coerces 'false' string to false", () => {
        const input: Record<string, InputFieldDefinition> = {
          enabled: { type: Boolean },
        };
        const result = parseCommanderOptions({ enabled: "false" }, { input });
        expect(result.enabled).toBe(false);
      });

      it("coerces '1' string to true", () => {
        const input: Record<string, InputFieldDefinition> = {
          active: { type: Boolean },
        };
        const result = parseCommanderOptions({ active: "1" }, { input });
        expect(result.active).toBe(true);
      });

      it("coerces '0' string to false", () => {
        const input: Record<string, InputFieldDefinition> = {
          active: { type: Boolean },
        };
        const result = parseCommanderOptions({ active: "0" }, { input });
        expect(result.active).toBe(false);
      });

      it("coerces 'yes' string to true (case insensitive)", () => {
        const input: Record<string, InputFieldDefinition> = {
          confirm: { type: Boolean },
        };
        const result = parseCommanderOptions({ confirm: "YES" }, { input });
        expect(result.confirm).toBe(true);
      });

      it("coerces 'no' string to false (case insensitive)", () => {
        const input: Record<string, InputFieldDefinition> = {
          confirm: { type: Boolean },
        };
        const result = parseCommanderOptions({ confirm: "NO" }, { input });
        expect(result.confirm).toBe(false);
      });

      it("passes through boolean true unchanged", () => {
        const input: Record<string, InputFieldDefinition> = {
          flag: { type: Boolean },
        };
        const result = parseCommanderOptions({ flag: true }, { input });
        expect(result.flag).toBe(true);
      });

      it("passes through boolean false unchanged", () => {
        const input: Record<string, InputFieldDefinition> = {
          flag: { type: Boolean },
        };
        const result = parseCommanderOptions({ flag: false }, { input });
        expect(result.flag).toBe(false);
      });

      it("coerces truthy non-string values to true via Boolean()", () => {
        const input: Record<string, InputFieldDefinition> = {
          value: { type: Boolean },
        };
        const result = parseCommanderOptions({ value: 42 }, { input });
        expect(result.value).toBe(true);
      });
    });
  });

  describe("Integration with Commander.js", () => {
    let program: Command;

    beforeEach(() => {
      program = new Command();
      program.exitOverride();
    });

    it("creates working Commander options from handler input", () => {
      const handler = fabricService({
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
      const handler = fabricService({
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

  describe("fabricCommand", () => {
    let program: Command;

    beforeEach(() => {
      program = new Command();
      program.exitOverride();
    });

    it("registers a command with handler alias as name", () => {
      const handler = fabricService({
        alias: "greet",
        input: {
          name: { type: String },
        },
        service: ({ name }) => `Hello, ${name}!`,
      });

      const { command } = fabricCommand({ program, service: handler });

      expect(command.name()).toBe("greet");
    });

    it("registers a command with handler description", () => {
      const handler = fabricService({
        alias: "greet",
        description: "Greet a user",
        input: {
          name: { type: String },
        },
        service: ({ name }) => `Hello, ${name}!`,
      });

      const { command } = fabricCommand({ program, service: handler });

      expect(command.description()).toBe("Greet a user");
    });

    it("uses custom name over handler alias", () => {
      const handler = fabricService({
        alias: "greet",
        input: {
          name: { type: String },
        },
        service: ({ name }) => `Hello, ${name}!`,
      });

      const { command } = fabricCommand({
        service: handler,
        name: "hello",
        program,
      });

      expect(command.name()).toBe("hello");
    });

    it("uses custom description over handler description", () => {
      const handler = fabricService({
        alias: "greet",
        description: "Handler description",
        input: {
          name: { type: String },
        },
        service: ({ name }) => `Hello, ${name}!`,
      });

      const { command } = fabricCommand({
        description: "Custom description",
        service: handler,
        program,
      });

      expect(command.description()).toBe("Custom description");
    });

    it("defaults to 'command' when no alias or name provided", () => {
      const handler = fabricService({
        input: {
          name: { type: String },
        },
        service: ({ name }) => `Hello, ${name}!`,
      });

      const { command } = fabricCommand({ program, service: handler });

      expect(command.name()).toBe("command");
    });

    it("creates options from handler input", () => {
      const handler = fabricService({
        alias: "test",
        input: {
          name: { type: String, description: "User name" },
          count: { type: Number, default: 5 },
        },
        service: (input) => input,
      });

      fabricCommand({ program, service: handler });

      // Parse to trigger option creation
      program.parse(["node", "test", "test", "--name", "Alice"]);

      // Check that options were created
      const testCommand = program.commands.find((c) => c.name() === "test");
      expect(testCommand).toBeDefined();
      expect(testCommand!.options).toHaveLength(2);
    });

    it("excludes specified fields from options", () => {
      const handler = fabricService({
        alias: "test",
        input: {
          name: { type: String },
          secret: { type: String },
        },
        service: (input) => input,
      });

      fabricCommand({
        exclude: ["secret"],
        service: handler,
        program,
      });

      const testCommand = program.commands.find((c) => c.name() === "test");
      expect(testCommand!.options).toHaveLength(1);
      expect(testCommand!.options[0].name()).toBe("name");
    });

    it("applies overrides to options", () => {
      const handler = fabricService({
        alias: "test",
        input: {
          verbose: { type: Boolean },
        },
        service: (input) => input,
      });

      fabricCommand({
        service: handler,
        overrides: { verbose: { short: "v" } },
        program,
      });

      const testCommand = program.commands.find((c) => c.name() === "test");
      expect(testCommand!.options[0].flags).toBe("-v, --verbose");
      expect(testCommand!.options[1].flags).toBe("--no-verbose");
    });

    it("respects flag and letter in input definitions", () => {
      const handler = fabricService({
        alias: "test",
        input: {
          userName: { type: String, flag: "user", letter: "u" },
        },
        service: (input) => input,
      });

      fabricCommand({ program, service: handler });

      const testCommand = program.commands.find((c) => c.name() === "test");
      expect(testCommand!.options[0].flags).toBe("-u, --user <userName>");
    });

    it("executes handler when command is invoked", async () => {
      let capturedInput: unknown;
      const handler = fabricService({
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

      fabricCommand({ program, service: handler });

      await program.parseAsync(["node", "test", "test", "--name", "Bob"]);

      expect(capturedInput).toEqual({ name: "Bob", count: 1 });
    });

    it("coerces types when executing handler", async () => {
      let capturedInput: unknown;
      const handler = fabricService({
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

      fabricCommand({ program, service: handler });

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
      const handler = fabricService({
        alias: "test",
        input: {
          verbose: { type: Boolean, default: true },
        },
        service: (input) => input,
      });

      fabricCommand({ program, service: handler });

      // Boolean fields create both --flag and --no-flag options
      const testCommand = program.commands.find((c) => c.name() === "test");
      expect(testCommand!.options[0].flags).toBe("--verbose");
      expect(testCommand!.options[1].flags).toBe("--no-verbose");
    });

    it("--no-<flag> sets boolean to false", async () => {
      let capturedInput: unknown;
      const handler = fabricService({
        alias: "test",
        input: {
          save: { type: Boolean, default: true, description: "Save results" },
        },
        service: (input) => {
          capturedInput = input;
          return input;
        },
      });

      fabricCommand({ program, service: handler });

      await program.parseAsync(["node", "test", "test", "--no-save"]);

      expect(capturedInput).toEqual({ save: false });
    });

    it("--<flag> sets boolean to true when default is false", async () => {
      let capturedInput: unknown;
      const handler = fabricService({
        alias: "test",
        input: {
          dryRun: {
            type: Boolean,
            default: false,
            description: "Dry run mode",
          },
        },
        service: (input) => {
          capturedInput = input;
          return input;
        },
      });

      fabricCommand({ program, service: handler });

      await program.parseAsync(["node", "test", "test", "--dry-run"]);

      expect(capturedInput).toEqual({ dryRun: true });
    });

    it("works with handler that has no input", async () => {
      let called = false;
      const handler = fabricService({
        alias: "ping",
        service: () => {
          called = true;
          return "pong";
        },
      });

      fabricCommand({ program, service: handler });

      await program.parseAsync(["node", "test", "ping"]);

      expect(called).toBe(true);
    });

    it("full integration: greet command example", async () => {
      let capturedResult: unknown;
      const handler = fabricService({
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

      fabricCommand({ program, service: handler });

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

    it("coerces Date type through full command flow", async () => {
      let capturedInput: unknown;
      const handler = fabricService({
        alias: "schedule",
        input: {
          startDate: { type: Date, description: "Start date" },
        },
        service: (input) => {
          capturedInput = input;
          return input;
        },
      });

      fabricCommand({ program, service: handler });

      await program.parseAsync([
        "node",
        "test",
        "schedule",
        "--start-date",
        "2024-06-15T09:00:00Z",
      ]);

      expect(capturedInput).toBeDefined();
      const input = capturedInput as { startDate: Date };
      expect(input.startDate).toBeInstanceOf(Date);
      expect(input.startDate.toISOString()).toBe("2024-06-15T09:00:00.000Z");
    });

    describe("onComplete callback", () => {
      it("calls onComplete with handler response", async () => {
        let capturedResponse: unknown;
        const handler = fabricService({
          alias: "test",
          input: {
            value: { type: Number, default: 42 },
          },
          service: ({ value }) => ({ doubled: value * 2 }),
        });

        fabricCommand({
          service: handler,
          onComplete: (response) => {
            capturedResponse = response;
          },
          program,
        });

        await program.parseAsync(["node", "test", "test"]);

        expect(capturedResponse).toEqual({ doubled: 84 });
      });

      it("does not require onComplete callback", async () => {
        const handler = fabricService({
          alias: "test",
          service: () => "result",
        });

        fabricCommand({ program, service: handler });

        // Should not throw
        await expect(
          program.parseAsync(["node", "test", "test"]),
        ).resolves.not.toThrow();
      });

      it("supports async onComplete callback", async () => {
        let completed = false;
        const handler = fabricService({
          alias: "test",
          service: () => "result",
        });

        fabricCommand({
          service: handler,
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
        const handler = fabricService({
          alias: "test",
          service: () => {
            throw new Error("Handler failed");
          },
        });

        fabricCommand({
          service: handler,
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
        const handler = fabricService({
          alias: "test",
          service: () => {
            throw new Error("Handler failed");
          },
        });

        fabricCommand({ program, service: handler });

        await expect(
          program.parseAsync(["node", "test", "test"]),
        ).rejects.toThrow("Handler failed");
      });

      it("supports async onError callback", async () => {
        let errorHandled = false;
        const handler = fabricService({
          alias: "test",
          service: () => {
            throw new Error("Handler failed");
          },
        });

        fabricCommand({
          service: handler,
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
        const handler = fabricService({
          alias: "test",
          service: () => "result",
        });

        const onMessage = vi.fn();
        const result = fabricCommand({
          service: handler,
          onMessage,
          program,
        });

        expect(result.onMessage).toBe(onMessage);
      });

      it("does not include onMessage when not provided", () => {
        const handler = fabricService({
          alias: "test",
          service: () => "result",
        });

        const result = fabricCommand({ program, service: handler });

        expect(result.onMessage).toBeUndefined();
      });
    });

    describe("sendMessage in service context", () => {
      it("service can call sendMessage and onMessage receives the message", async () => {
        const messages: unknown[] = [];
        const handler = fabricService({
          alias: "test",
          service: (_input, context) => {
            context?.sendMessage?.({ content: "Starting..." });
            context?.sendMessage?.({ content: "Processing", level: "debug" });
            return "done";
          },
        });

        fabricCommand({
          service: handler,
          onMessage: (msg) => {
            messages.push(msg);
          },
          program,
        });

        await program.parseAsync(["node", "test", "test"]);

        expect(messages).toHaveLength(2);
        expect(messages[0]).toEqual({ content: "Starting..." });
        expect(messages[1]).toEqual({ content: "Processing", level: "debug" });
      });

      it("service works when onMessage is not provided", async () => {
        let contextReceived: unknown;
        const handler = fabricService({
          alias: "test",
          service: (_input, context) => {
            contextReceived = context;
            // sendMessage should be undefined, calling it should not throw
            context?.sendMessage?.({ content: "test" });
            return "done";
          },
        });

        fabricCommand({ program, service: handler });

        await program.parseAsync(["node", "test", "test"]);

        expect(contextReceived).toBeDefined();
        expect(
          (contextReceived as { sendMessage: unknown }).sendMessage,
        ).toBeUndefined();
      });

      it("errors in onMessage are swallowed and do not halt execution", async () => {
        let serviceCompleted = false;
        const handler = fabricService({
          alias: "test",
          service: (_input, context) => {
            context?.sendMessage?.({ content: "Before error" });
            serviceCompleted = true;
            return "done";
          },
        });

        fabricCommand({
          service: handler,
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
        const handler = fabricService({
          alias: "test",
          service: async (_input, context) => {
            await context?.sendMessage?.({ content: "Async message" });
            serviceCompleted = true;
            return "done";
          },
        });

        fabricCommand({
          service: handler,
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
        const handler = fabricService({
          alias: "test",
          service: async (_input, context) => {
            await context?.sendMessage?.({ content: "First" });
            await context?.sendMessage?.({ content: "Second" });
            return "done";
          },
        });

        fabricCommand({
          service: handler,
          onMessage: async (msg) => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            messages.push(msg);
          },
          program,
        });

        await program.parseAsync(["node", "test", "test"]);

        expect(messages).toHaveLength(2);
        expect(messages[0]).toEqual({ content: "First" });
        expect(messages[1]).toEqual({ content: "Second" });
      });
    });

    describe("onFatal callback", () => {
      it("calls onFatal for any thrown error", async () => {
        let capturedError: unknown;
        const handler = fabricService({
          alias: "test",
          service: () => {
            throw new Error("Service error");
          },
        });

        fabricCommand({
          service: handler,
          onFatal: (error) => {
            capturedError = error;
          },
          program,
        });

        await program.parseAsync(["node", "test", "test"]);

        expect(capturedError).toBeInstanceOf(Error);
        expect((capturedError as Error).message).toBe("Service error");
      });

      it("calls onFatal (not onError) when both callbacks provided and error is thrown", async () => {
        let errorCallback: string | undefined;
        const handler = fabricService({
          alias: "test",
          service: () => {
            throw new Error("Thrown error");
          },
        });

        fabricCommand({
          service: handler,
          onError: () => {
            errorCallback = "onError";
          },
          onFatal: () => {
            errorCallback = "onFatal";
          },
          program,
        });

        await program.parseAsync(["node", "test", "test"]);

        // Any thrown error goes to onFatal
        expect(errorCallback).toBe("onFatal");
      });

      it("falls back to onError when onFatal not provided", async () => {
        let capturedError: unknown;
        const handler = fabricService({
          alias: "test",
          service: () => {
            throw new Error("Service error");
          },
        });

        fabricCommand({
          service: handler,
          onError: (error) => {
            capturedError = error;
          },
          program,
        });

        await program.parseAsync(["node", "test", "test"]);

        expect(capturedError).toBeInstanceOf(Error);
        expect((capturedError as Error).message).toBe("Service error");
      });

      it("re-throws error when no error callbacks provided", async () => {
        const handler = fabricService({
          alias: "test",
          service: () => {
            throw new Error("Unhandled error");
          },
        });

        fabricCommand({ program, service: handler });

        await expect(
          program.parseAsync(["node", "test", "test"]),
        ).rejects.toThrow("Unhandled error");
      });

      it("supports async onFatal callback", async () => {
        let fatalHandled = false;
        const handler = fabricService({
          alias: "test",
          service: () => {
            throw new Error("Fatal error");
          },
        });

        fabricCommand({
          service: handler,
          onFatal: async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            fatalHandled = true;
          },
          program,
        });

        await program.parseAsync(["node", "test", "test"]);

        expect(fatalHandled).toBe(true);
      });
    });

    describe("context.onError and context.onFatal", () => {
      it("service can call context.onError for recoverable errors", async () => {
        let capturedError: unknown;
        const handler = fabricService({
          alias: "test",
          service: async (_input, context) => {
            // Service catches its own error and reports it as recoverable
            try {
              throw new Error("Recoverable error");
            } catch (err) {
              await context?.onError?.(err);
            }
            return "continued after error";
          },
        });

        fabricCommand({
          service: handler,
          onError: (error) => {
            capturedError = error;
          },
          program,
        });

        await program.parseAsync(["node", "test", "test"]);

        expect(capturedError).toBeInstanceOf(Error);
        expect((capturedError as Error).message).toBe("Recoverable error");
      });

      it("service can call context.onFatal for fatal errors", async () => {
        let capturedError: unknown;
        const handler = fabricService({
          alias: "test",
          service: async (_input, context) => {
            // Service explicitly reports a fatal error
            await context?.onFatal?.(new Error("Explicit fatal"));
            return "result";
          },
        });

        fabricCommand({
          service: handler,
          onFatal: (error) => {
            capturedError = error;
          },
          program,
        });

        await program.parseAsync(["node", "test", "test"]);

        expect(capturedError).toBeInstanceOf(Error);
        expect((capturedError as Error).message).toBe("Explicit fatal");
      });

      it("context.onError is undefined when onError not registered", async () => {
        let contextReceived: unknown;
        const handler = fabricService({
          alias: "test",
          service: (_input, context) => {
            contextReceived = context;
            // Should not throw even if calling undefined
            context?.onError?.(new Error("test"));
            return "done";
          },
        });

        fabricCommand({
          service: handler,
          onFatal: () => {},
          program,
        });

        await program.parseAsync(["node", "test", "test"]);

        expect(contextReceived).toBeDefined();
        expect(
          (contextReceived as { onError: unknown }).onError,
        ).toBeUndefined();
      });

      it("context.onFatal is undefined when onFatal not registered", async () => {
        let contextReceived: unknown;
        const handler = fabricService({
          alias: "test",
          service: (_input, context) => {
            contextReceived = context;
            // Should not throw even if calling undefined
            context?.onFatal?.(new Error("test"));
            return "done";
          },
        });

        fabricCommand({
          service: handler,
          onError: () => {},
          program,
        });

        await program.parseAsync(["node", "test", "test"]);

        expect(contextReceived).toBeDefined();
        expect(
          (contextReceived as { onFatal: unknown }).onFatal,
        ).toBeUndefined();
      });

      it("errors in context.onError callback are swallowed", async () => {
        let serviceCompleted = false;
        const handler = fabricService({
          alias: "test",
          service: async (_input, context) => {
            await context?.onError?.(new Error("test"));
            serviceCompleted = true;
            return "done";
          },
        });

        fabricCommand({
          service: handler,
          onError: () => {
            throw new Error("Callback failed");
          },
          program,
        });

        await expect(
          program.parseAsync(["node", "test", "test"]),
        ).resolves.not.toThrow();
        expect(serviceCompleted).toBe(true);
      });

      it("errors in context.onFatal callback are swallowed", async () => {
        let serviceCompleted = false;
        const handler = fabricService({
          alias: "test",
          service: async (_input, context) => {
            await context?.onFatal?.(new Error("test"));
            serviceCompleted = true;
            return "done";
          },
        });

        fabricCommand({
          service: handler,
          onFatal: () => {
            throw new Error("Callback failed");
          },
          program,
        });

        await expect(
          program.parseAsync(["node", "test", "test"]),
        ).resolves.not.toThrow();
        expect(serviceCompleted).toBe(true);
      });

      it("service can report multiple errors via context", async () => {
        const errors: unknown[] = [];
        const handler = fabricService({
          alias: "test",
          service: async (_input, context) => {
            // Report multiple recoverable errors
            await context?.onError?.(new Error("Error 1"));
            await context?.onError?.(new Error("Error 2"));
            await context?.onError?.(new Error("Error 3"));
            return "completed despite errors";
          },
        });

        fabricCommand({
          service: handler,
          onError: (error) => {
            errors.push(error);
          },
          program,
        });

        await program.parseAsync(["node", "test", "test"]);

        expect(errors).toHaveLength(3);
        expect((errors[0] as Error).message).toBe("Error 1");
        expect((errors[1] as Error).message).toBe("Error 2");
        expect((errors[2] as Error).message).toBe("Error 3");
      });
    });

    describe("inline service definition (short-form)", () => {
      it("accepts inline function with alias, description, input", async () => {
        let capturedInput: unknown;
        const { command } = fabricCommand({
          alias: "greet",
          description: "Greet a user",
          input: {
            userName: { type: String, flag: "user", letter: "u" },
            loud: { type: Boolean, letter: "l", default: false },
          },
          program,
          service: ({ loud, userName }) => {
            const greeting = `Hello, ${userName}!`;
            capturedInput = { loud, userName };
            return loud ? greeting.toUpperCase() : greeting;
          },
        });

        expect(command.name()).toBe("greet");
        expect(command.description()).toBe("Greet a user");

        await program.parseAsync([
          "node",
          "test",
          "greet",
          "--user",
          "Alice",
          "-l",
        ]);

        expect(capturedInput).toEqual({ loud: true, userName: "Alice" });
      });

      it("defaults to 'command' when no alias provided for inline function", () => {
        const { command } = fabricCommand({
          program,
          service: () => "result",
        });

        expect(command.name()).toBe("command");
      });

      it("uses name over alias for inline function", () => {
        const { command } = fabricCommand({
          alias: "greet",
          name: "hello",
          program,
          service: () => "result",
        });

        expect(command.name()).toBe("hello");
      });
    });

    describe("pre-instantiated service with overrides", () => {
      it("overrides alias with config alias", () => {
        const service = fabricService({
          alias: "original",
          service: () => "result",
        });

        const { command } = fabricCommand({
          alias: "overridden",
          program,
          service,
        });

        expect(command.name()).toBe("overridden");
      });

      it("overrides description with config description", () => {
        const service = fabricService({
          alias: "test",
          description: "Original description",
          service: () => "result",
        });

        const { command } = fabricCommand({
          description: "Overridden description",
          program,
          service,
        });

        expect(command.description()).toBe("Overridden description");
      });

      it("inherits description when not overridden", () => {
        const service = fabricService({
          alias: "test",
          description: "Original description",
          service: () => "result",
        });

        const { command } = fabricCommand({
          alias: "overridden",
          program,
          service,
        });

        expect(command.description()).toBe("Original description");
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

        fabricCommand({
          input: {
            name: { type: String },
            count: { type: Number, default: 10 },
          },
          program,
          service,
        });

        await program.parseAsync([
          "node",
          "test",
          "original",
          "--name",
          "Alice",
        ]);

        // Should have both name and count (from overridden input)
        expect(capturedInput).toEqual({ name: "Alice", count: 10 });
      });

      it("preserves original service when using with overrides", async () => {
        const originalService = fabricService({
          alias: "foo",
          description: "Foo service",
          service: () => "original",
        });

        // Use with overrides
        fabricCommand({
          alias: "bar",
          program,
          service: originalService,
        });

        // Original should be unchanged
        expect(originalService.alias).toBe("foo");
        expect(originalService.description).toBe("Foo service");
      });
    });
  });

  describe("FabricCommander", () => {
    describe("Array form", () => {
      it("creates program with array of services", () => {
        const service1 = fabricService({
          alias: "greet",
          service: () => "Hello!",
        });
        const service2 = fabricService({
          alias: "farewell",
          service: () => "Goodbye!",
        });

        const cli = new FabricCommander([service1, service2]);

        expect(cli.command).toBeInstanceOf(Command);
        expect(cli.command.commands).toHaveLength(2);
        expect(cli.command.commands[0].name()).toBe("greet");
        expect(cli.command.commands[1].name()).toBe("farewell");
      });

      it("works with empty services array", () => {
        const cli = new FabricCommander([]);

        expect(cli.command).toBeInstanceOf(Command);
        expect(cli.command.commands).toHaveLength(0);
      });
    });

    describe("Config form", () => {
      it("sets program name", () => {
        const service = fabricService({
          alias: "test",
          service: () => "result",
        });

        const cli = new FabricCommander({
          name: "my-cli",
          services: [service],
        });

        expect(cli.command.name()).toBe("my-cli");
      });

      it("sets program version", () => {
        const service = fabricService({
          alias: "test",
          service: () => "result",
        });

        const cli = new FabricCommander({
          services: [service],
          version: "1.2.3",
        });

        expect(cli.command.version()).toBe("1.2.3");
      });

      it("sets program description", () => {
        const service = fabricService({
          alias: "test",
          service: () => "result",
        });

        const cli = new FabricCommander({
          description: "My CLI application",
          services: [service],
        });

        expect(cli.command.description()).toBe("My CLI application");
      });

      it("sets all program metadata together", () => {
        const service = fabricService({
          alias: "test",
          service: () => "result",
        });

        const cli = new FabricCommander({
          description: "My CLI application",
          name: "my-cli",
          services: [service],
          version: "1.0.0",
        });

        expect(cli.command.name()).toBe("my-cli");
        expect(cli.command.version()).toBe("1.0.0");
        expect(cli.command.description()).toBe("My CLI application");
      });
    });

    describe("Inline service definitions", () => {
      it("accepts inline service definitions in services array", () => {
        const cli = new FabricCommander({
          services: [
            {
              alias: "greet",
              description: "Greet a user",
              input: { name: { type: String } },
              service: ({ name }) => `Hello, ${name}!`,
            },
          ],
        });

        expect(cli.command.commands).toHaveLength(1);
        expect(cli.command.commands[0].name()).toBe("greet");
        expect(cli.command.commands[0].description()).toBe("Greet a user");
      });

      it("mixes pre-instantiated and inline services", () => {
        const preInstantiated = fabricService({
          alias: "ping",
          service: () => "pong",
        });

        const cli = new FabricCommander({
          services: [
            preInstantiated,
            {
              alias: "greet",
              service: ({ name }) => `Hello, ${name}!`,
            },
          ],
        });

        expect(cli.command.commands).toHaveLength(2);
        expect(cli.command.commands[0].name()).toBe("ping");
        expect(cli.command.commands[1].name()).toBe("greet");
      });
    });

    describe("Shared callbacks", () => {
      it("applies shared onComplete to all commands", async () => {
        const results: unknown[] = [];
        const service1 = fabricService({
          alias: "cmd1",
          service: () => "result1",
        });
        const service2 = fabricService({
          alias: "cmd2",
          service: () => "result2",
        });

        const cli = new FabricCommander({
          onComplete: (response) => {
            results.push(response);
          },
          services: [service1, service2],
        });
        cli.command.exitOverride();

        await cli.parseAsync(["node", "test", "cmd1"]);
        expect(results).toEqual(["result1"]);
      });

      it("applies shared onError to all commands", async () => {
        let capturedError: unknown;
        const service = fabricService({
          alias: "failing",
          service: () => {
            throw new Error("Service failed");
          },
        });

        const cli = new FabricCommander({
          onError: (error) => {
            capturedError = error;
          },
          services: [service],
        });
        cli.command.exitOverride();

        await cli.parseAsync(["node", "test", "failing"]);
        expect(capturedError).toBeInstanceOf(Error);
        expect((capturedError as Error).message).toBe("Service failed");
      });

      it("applies shared onFatal to all commands", async () => {
        let capturedError: unknown;
        const service = fabricService({
          alias: "failing",
          service: () => {
            throw new Error("Fatal error");
          },
        });

        const cli = new FabricCommander({
          onFatal: (error) => {
            capturedError = error;
          },
          services: [service],
        });
        cli.command.exitOverride();

        await cli.parseAsync(["node", "test", "failing"]);
        expect(capturedError).toBeInstanceOf(Error);
        expect((capturedError as Error).message).toBe("Fatal error");
      });

      it("applies shared onMessage to all commands", async () => {
        const messages: unknown[] = [];
        const service = fabricService({
          alias: "test",
          service: (_input, context) => {
            context?.sendMessage?.({ content: "Hello" });
            return "done";
          },
        });

        const cli = new FabricCommander({
          onMessage: (msg) => {
            messages.push(msg);
          },
          services: [service],
        });
        cli.command.exitOverride();

        await cli.parseAsync(["node", "test", "test"]);
        expect(messages).toHaveLength(1);
        expect(messages[0]).toEqual({ content: "Hello" });
      });
    });

    describe("parse methods", () => {
      it("parse() returns this for chaining", () => {
        let executed = false;
        const service = fabricService({
          alias: "test",
          service: () => {
            executed = true;
            return "result";
          },
        });

        const cli = new FabricCommander([service]);
        cli.command.exitOverride();

        // Parse and execute the test command
        const result = cli.parse(["node", "script", "test"]);
        expect(result).toBe(cli);
        // Note: action is async, so executed may not be true yet
        // The important thing is parse returns this
      });

      it("parseAsync() returns promise that resolves to this", async () => {
        const service = fabricService({
          alias: "test",
          service: () => "result",
        });

        const cli = new FabricCommander([service]);
        cli.command.exitOverride();

        const result = await cli.parseAsync(["node", "test", "test"]);
        expect(result).toBe(cli);
      });

      it("exposes underlying Command for advanced use", () => {
        const cli = new FabricCommander([]);

        expect(cli.command).toBeInstanceOf(Command);
        // Can add additional options, configure, etc.
        cli.command.option("--debug", "Enable debug mode");
        expect(cli.command.opts()).toEqual({});
      });
    });

    describe("Full integration", () => {
      it("complete CLI example with multiple commands", async () => {
        const results: unknown[] = [];

        const cli = new FabricCommander({
          description: "Example CLI",
          name: "example",
          onComplete: (response) => results.push(response),
          services: [
            {
              alias: "greet",
              description: "Greet someone",
              input: {
                name: { type: String, default: "World" },
              },
              service: ({ name }) => `Hello, ${name}!`,
            },
            {
              alias: "add",
              description: "Add two numbers",
              input: {
                a: { type: Number },
                b: { type: Number },
              },
              service: ({ a, b }) => a + b,
            },
          ],
          version: "1.0.0",
        });
        cli.command.exitOverride();

        // Test greet command
        await cli.parseAsync(["node", "test", "greet", "--name", "Alice"]);
        expect(results[0]).toBe("Hello, Alice!");

        // Clear results for next test
        results.length = 0;

        // Test add command
        await cli.parseAsync(["node", "test", "add", "--a", "5", "--b", "3"]);
        expect(results[0]).toBe(8);
      });
    });
  });
});
