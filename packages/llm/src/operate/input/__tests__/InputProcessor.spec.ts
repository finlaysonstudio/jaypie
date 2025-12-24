import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InputProcessor, inputProcessor } from "../InputProcessor.js";
import {
  LlmHistory,
  LlmInputMessage,
  LlmMessageRole,
  LlmMessageType,
} from "../../../types/LlmProvider.interface.js";

//
//
// Mock
//

vi.mock("@jaypie/kit", () => ({
  JAYPIE: { LIB: { LLM: "llm" } },
  placeholders: vi.fn((template: string, data: Record<string, unknown>) => {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, "g"),
        String(value),
      );
    }
    return result;
  }),
}));

vi.mock("@jaypie/logger", () => ({
  log: {
    lib: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
      trace: vi.fn(),
      var: vi.fn(),
      warn: vi.fn(),
    })),
  },
}));

//
//
// Tests
//

describe("InputProcessor", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("exports InputProcessor class", () => {
      expect(InputProcessor).toBeDefined();
      expect(typeof InputProcessor).toBe("function");
    });

    it("exports inputProcessor singleton", () => {
      expect(inputProcessor).toBeDefined();
      expect(inputProcessor).toBeInstanceOf(InputProcessor);
    });

    it("can be instantiated", () => {
      const processor = new InputProcessor();
      expect(processor).toBeInstanceOf(InputProcessor);
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    let processor: InputProcessor;

    beforeEach(() => {
      processor = new InputProcessor();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("converts string input to history", () => {
      const result = processor.process("Hello, world!");

      expect(result.history).toHaveLength(1);
      expect(result.history[0]).toMatchObject({
        content: "Hello, world!",
        role: LlmMessageRole.User,
      });
    });

    it("passes through history array", () => {
      const history: LlmHistory = [
        {
          content: "Hi",
          role: LlmMessageRole.User,
          type: LlmMessageType.Message,
        } as LlmInputMessage,
      ];

      const result = processor.process(history);

      expect(result.history).toEqual(history);
    });

    it("applies placeholders to input when data is provided", () => {
      const result = processor.process("Hello, {{name}}!", {
        data: { name: "World" },
      });

      expect(result.history[0]).toMatchObject({
        content: "Hello, World!",
      });
    });

    it("applies placeholders to instructions", () => {
      const result = processor.process("Hello", {
        data: { task: "summarize" },
        instructions: "Please {{task}} this.",
      });

      expect(result.instructions).toBe("Please summarize this.");
    });

    it("applies placeholders to system prompt", () => {
      const result = processor.process("Hello", {
        data: { role: "assistant" },
        system: "You are a {{role}}.",
      });

      expect(result.system).toBe("You are a assistant.");
    });

    it("merges with provided history", () => {
      const existingHistory: LlmHistory = [
        {
          content: "Previous message",
          role: LlmMessageRole.User,
          type: LlmMessageType.Message,
        } as LlmInputMessage,
      ];

      const result = processor.process("New message", {
        history: existingHistory,
      });

      expect(result.history).toHaveLength(2);
      expect(result.history[0]).toMatchObject({ content: "Previous message" });
      expect(result.history[1]).toMatchObject({ content: "New message" });
    });
  });

  // Features
  describe("Features", () => {
    let processor: InputProcessor;

    beforeEach(() => {
      processor = new InputProcessor();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    describe("System message handling", () => {
      it("prepends system message to history", () => {
        const result = processor.process("User message", {
          system: "You are helpful.",
        });

        expect(result.history).toHaveLength(2);
        expect(result.history[0]).toMatchObject({
          content: "You are helpful.",
          role: LlmMessageRole.System,
          type: LlmMessageType.Message,
        });
        expect(result.history[1]).toMatchObject({
          content: "User message",
        });
      });

      it("does not duplicate identical system message", () => {
        const existingHistory: LlmHistory = [
          {
            content: "You are helpful.",
            role: LlmMessageRole.System,
            type: LlmMessageType.Message,
          } as LlmInputMessage,
          {
            content: "Hi",
            role: LlmMessageRole.User,
            type: LlmMessageType.Message,
          } as LlmInputMessage,
        ];

        const result = processor.process(existingHistory, {
          system: "You are helpful.",
        });

        expect(result.history).toHaveLength(2);
        expect(result.history[0]).toMatchObject({
          content: "You are helpful.",
          role: LlmMessageRole.System,
        });
      });

      it("replaces different system message at start", () => {
        const existingHistory: LlmHistory = [
          {
            content: "Old system prompt",
            role: LlmMessageRole.System,
            type: LlmMessageType.Message,
          } as LlmInputMessage,
          {
            content: "Hi",
            role: LlmMessageRole.User,
            type: LlmMessageType.Message,
          } as LlmInputMessage,
        ];

        const result = processor.process(existingHistory, {
          system: "New system prompt",
        });

        expect(result.history).toHaveLength(2);
        expect(result.history[0]).toMatchObject({
          content: "New system prompt",
          role: LlmMessageRole.System,
        });
      });
    });

    describe("Placeholder control", () => {
      it("skips input placeholders when placeholders.input is false", () => {
        const result = processor.process("Hello, {{name}}!", {
          data: { name: "World" },
          placeholders: { input: false },
        });

        expect(result.history[0]).toMatchObject({
          content: "Hello, {{name}}!",
        });
      });

      it("skips instructions placeholders when placeholders.instructions is false", () => {
        const result = processor.process("Hello", {
          data: { task: "summarize" },
          instructions: "Please {{task}} this.",
          placeholders: { instructions: false },
        });

        expect(result.instructions).toBe("Please {{task}} this.");
      });

      it("skips system placeholders when placeholders.system is false", () => {
        const result = processor.process("Hello", {
          data: { role: "assistant" },
          placeholders: { system: false },
          system: "You are a {{role}}.",
        });

        expect(result.system).toBe("You are a {{role}}.");
      });
    });

    describe("No data provided", () => {
      it("returns instructions without placeholder processing", () => {
        const result = processor.process("Hello", {
          instructions: "Please {{task}} this.",
        });

        expect(result.instructions).toBe("Please {{task}} this.");
      });

      it("returns system without placeholder processing", () => {
        const result = processor.process("Hello", {
          system: "You are a {{role}}.",
        });

        expect(result.system).toBe("You are a {{role}}.");
      });
    });
  });

  // Specific Scenarios
  describe("Specific Scenarios", () => {
    let processor: InputProcessor;

    beforeEach(() => {
      processor = new InputProcessor();
    });

    it("handles all options together", () => {
      const existingHistory: LlmHistory = [
        {
          content: "Earlier",
          role: LlmMessageRole.User,
          type: LlmMessageType.Message,
        } as LlmInputMessage,
      ];

      const result = processor.process("Hello, {{name}}!", {
        data: { name: "World", task: "help", role: "assistant" },
        history: existingHistory,
        instructions: "Please {{task}} me.",
        system: "You are a {{role}}.",
      });

      expect(result.history).toHaveLength(3);
      expect(result.history[0]).toMatchObject({
        content: "You are a assistant.",
        role: LlmMessageRole.System,
      });
      expect(result.history[1]).toMatchObject({ content: "Earlier" });
      expect(result.history[2]).toMatchObject({ content: "Hello, World!" });
      expect(result.instructions).toBe("Please help me.");
      expect(result.system).toBe("You are a assistant.");
    });
  });
});
