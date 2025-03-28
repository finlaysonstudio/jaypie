import { describe, expect, it } from "vitest";
import {
  formatInput,
  formatMessage,
  MAX_TURNS_ABSOLUTE_LIMIT,
  MAX_TURNS_DEFAULT_LIMIT,
  maxTurnsFromOptions,
} from "../operate";
import type { LlmOperateOptions } from "../../../types/LlmProvider.interface";

describe("operate", () => {
  describe("maxTurnsFromOptions", () => {
    describe("Base Cases", () => {
      it("is a Function", () => {
        expect(maxTurnsFromOptions).toBeFunction();
      });

      it("returns a number", () => {
        const result = maxTurnsFromOptions({});
        expect(result).toBeNumber();
      });
    });

    describe("Features", () => {
      it("returns default limit (12) when turns is undefined", () => {
        const options: LlmOperateOptions = {};
        const result = maxTurnsFromOptions(options);
        expect(result).toBe(MAX_TURNS_DEFAULT_LIMIT);
      });

      it("returns default limit (12) when turns is true", () => {
        const options: LlmOperateOptions = { turns: true };
        const result = maxTurnsFromOptions(options);
        expect(result).toBe(MAX_TURNS_DEFAULT_LIMIT);
      });

      it("returns 1 when turns is false", () => {
        const options: LlmOperateOptions = { turns: false };
        const result = maxTurnsFromOptions(options);
        expect(result).toBe(1);
      });

      it("returns 1 when turns is 0", () => {
        const options: LlmOperateOptions = { turns: 0 };
        const result = maxTurnsFromOptions(options);
        expect(result).toBe(1);
      });

      it("returns the specified number when turns is a positive number", () => {
        const options: LlmOperateOptions = { turns: 5 };
        const result = maxTurnsFromOptions(options);
        expect(result).toBe(5);
      });

      it("caps returns at MAX_TURNS_ABSOLUTE_LIMIT (72) when turns is a large positive number", () => {
        const options: LlmOperateOptions = { turns: 100 };
        const result = maxTurnsFromOptions(options);
        expect(result).toBe(MAX_TURNS_ABSOLUTE_LIMIT);
      });

      it("returns default limit (12) when turns is a negative number", () => {
        const options: LlmOperateOptions = { turns: -5 };
        const result = maxTurnsFromOptions(options);
        expect(result).toBe(MAX_TURNS_DEFAULT_LIMIT);
      });

      it("returns 1 for other falsy values like null", () => {
        // @ts-expect-error Testing with null even though it's not in the type
        const options: LlmOperateOptions = { turns: null };
        const result = maxTurnsFromOptions(options);
        expect(result).toBe(1);
      });
    });
  });

  describe("formatInput", () => {
    describe("Base Cases", () => {
      it("is a Function", () => {
        expect(formatInput).toBeFunction();
      });
    });
    describe("Features", () => {
      it("Formats a string", () => {
        const result = formatInput("Hello, World!");
        expect(result).toEqual([{ role: "user", content: "Hello, World!" }]);
      });
    });
  });

  describe("formatMessage", () => {
    describe("Base Cases", () => {
      it("is a Function", () => {
        expect(formatMessage).toBeFunction();
      });

      it("returns an object", () => {
        const result = formatMessage("Hello, World!");
        expect(result).toBeObject();
      });
    });

    describe("Features", () => {
      it("formats a string input with default role", () => {
        const result = formatMessage("Hello, World!");
        expect(result).toEqual({
          role: "user",
          content: "Hello, World!",
        });
      });

      it("formats a string input with custom role", () => {
        const result = formatMessage("Hello, World!", { role: "assistant" });
        expect(result).toEqual({
          role: "assistant",
          content: "Hello, World!",
        });
      });

      it("formats a string input with placeholders", () => {
        const result = formatMessage("Hello, {{name}}!", {
          data: { name: "John" },
        });
        expect(result).toEqual({
          role: "user",
          content: "Hello, John!",
        });
      });

      it("handles an object input preserving its properties", () => {
        const input = { content: "Hello, World!", role: "assistant" };
        const result = formatMessage(input);
        expect(result).toEqual(input);
      });

      it("handles an object input with default role when not provided", () => {
        const input = { content: "Hello, World!" };
        const result = formatMessage(input);
        expect(result).toEqual({
          ...input,
          role: "user",
        });
      });

      it("handles an object input with placeholders in content", () => {
        const input = { content: "Hello, {{name}}!" };
        const result = formatMessage(input, { data: { name: "John" } });
        expect(result).toEqual({
          content: "Hello, John!",
          role: "user",
        });
      });

      it("preserves additional properties in object input", () => {
        const input = {
          content: "Hello, World!",
          role: "assistant",
          name: "test_assistant",
          metadata: { version: "1.0" },
        };
        const result = formatMessage(input);
        expect(result).toEqual(input);
      });
    });
  });
});
