import { describe, expect, it } from "vitest";
import { formatOperateInput } from "../formatOperateInput";
import {
  LlmHistory,
  LlmInputMessage,
  LlmMessageRole,
  LlmMessageType,
} from "../../types/LlmProvider.interface.js";

describe("formatOperateInput", () => {
  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(typeof formatOperateInput).toBe("function");
    });

    it("works", () => {
      expect(formatOperateInput("test")).not.toBeUndefined();
    });
  });

  describe("Happy Paths", () => {
    it("returns the same array when input is already LlmHistory", () => {
      const history: LlmHistory = [
        {
          content: "test message",
          role: LlmMessageRole.User,
          type: LlmMessageType.Message,
        },
      ];
      expect(formatOperateInput(history)).toBe(history);
    });

    it("converts string to LlmHistory with LlmInputMessage", () => {
      const input = "test message";
      const result = formatOperateInput(input);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0]).toEqual({
        content: input,
        role: LlmMessageRole.User,
        type: LlmMessageType.Message,
      });
    });

    it("wraps LlmInputMessage in an array", () => {
      const message: LlmInputMessage = {
        content: "test message",
        role: LlmMessageRole.Assistant,
        type: LlmMessageType.Message,
      };
      const result = formatOperateInput(message);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0]).toBe(message);
    });
  });

  describe("Features", () => {
    it("uses role when converting string to LlmInputMessage", () => {
      const input = "test message";
      const result = formatOperateInput(input, {
        role: LlmMessageRole.System,
      }) as LlmInputMessage[];

      expect(result[0].role).toBe(LlmMessageRole.System);
    });

    it("applies placeholders when string input has data option", () => {
      const input = "Hello {{name}}";
      const data = { name: "World" };
      const result = formatOperateInput(input, { data }) as LlmInputMessage[];

      expect(result[0].content).toBe("Hello World");
    });

    it("applies placeholders when LlmInputMessage has data option", () => {
      const message: LlmInputMessage = {
        content: "Hello {{name}}",
        role: LlmMessageRole.User,
        type: LlmMessageType.Message,
      };
      const data = { name: "World" };
      const result = formatOperateInput(message, { data }) as LlmInputMessage[];

      expect(result[0].content).toBe("Hello World");
    });

    it("does not modify LlmHistory when data option is provided", () => {
      // Create a message with content that contains placeholders
      const message: LlmInputMessage = {
        content: "Hello {{name}}",
        role: LlmMessageRole.User,
        type: LlmMessageType.Message,
      };

      // Add the message to the history
      const history: LlmHistory = [message];

      // Format the history with data for placeholders
      const data = { name: "World" };
      const result = formatOperateInput(history, { data });

      // Verify the history is not modified
      expect(result).toBe(history);

      // Use a type guard to safely access the content property
      const firstItem = result[0];
      if ("content" in firstItem && typeof firstItem.content === "string") {
        expect(firstItem.content).toBe("Hello {{name}}");
      } else {
        // This should never happen in this test, but satisfies TypeScript
        expect(false).toBe(true);
      }
    });
  });

  describe("Specific Scenarios", () => {
    it("handles empty string", () => {
      const result = formatOperateInput("") as LlmInputMessage[];

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].content).toBe("");
    });

    it("handles empty array", () => {
      const emptyHistory: LlmHistory = [];
      expect(formatOperateInput(emptyHistory)).toBe(emptyHistory);
    });
  });
});
