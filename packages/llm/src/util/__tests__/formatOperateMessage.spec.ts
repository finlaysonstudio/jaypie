import { describe, expect, it } from "vitest";
import { formatOperateMessage } from "../formatOperateMessage";
import {
  LlmMessageRole,
  LlmMessageType,
} from "../../types/LlmProvider.interface.js";

describe("formatOperateMessage", () => {
  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(typeof formatOperateMessage).toBe("function");
    });

    it("works", () => {
      expect(formatOperateMessage("test")).not.toBeUndefined();
    });
  });

  describe("Happy Paths", () => {
    it("converts string to LlmInputMessage", () => {
      const input = "test message";
      const result = formatOperateMessage(input);

      expect(result).toEqual({
        content: input,
        role: LlmMessageRole.User,
        type: LlmMessageType.Message,
      });
    });
  });

  describe("Features", () => {
    it("uses role when specified", () => {
      const input = "test message";
      const result = formatOperateMessage(input, {
        role: LlmMessageRole.System,
      });

      expect(result.role).toBe(LlmMessageRole.System);
    });

    it("applies placeholders when data option is provided", () => {
      const input = "Hello {{name}}";
      const data = { name: "World" };
      const result = formatOperateMessage(input, { data });

      expect(result.content).toBe("Hello World");
    });
  });

  describe("Specific Scenarios", () => {
    it("handles empty string", () => {
      const result = formatOperateMessage("");

      expect(result.content).toBe("");
      expect(result.role).toBe(LlmMessageRole.User);
      expect(result.type).toBe(LlmMessageType.Message);
    });
  });
});
