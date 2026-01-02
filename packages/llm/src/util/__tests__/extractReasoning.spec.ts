import { describe, expect, it } from "vitest";

import {
  LlmHistory,
  LlmMessageRole,
  LlmMessageType,
} from "../../types/LlmProvider.interface.js";
import { extractReasoning } from "../extractReasoning.js";

describe("extractReasoning", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(extractReasoning).toBeFunction();
    });

    it("returns empty array for empty history", () => {
      const result = extractReasoning([]);
      expect(result).toEqual([]);
    });
  });

  describe("Happy Paths", () => {
    it("extracts reasoning from summary array format", () => {
      const history: LlmHistory = [
        {
          role: LlmMessageRole.User,
          content: "What is 2+2?",
          type: LlmMessageType.Message,
        },
        // Reasoning item (not typed in LlmHistory but included at runtime)
        {
          type: "reasoning",
          id: "reasoning-1",
          summary: [
            { text: "First, I need to add 2 and 2." },
            { text: "The sum is 4." },
          ],
        } as unknown as LlmHistory[number],
        {
          role: LlmMessageRole.Assistant,
          content: "The answer is 4.",
          type: LlmMessageType.Message,
        } as unknown as LlmHistory[number],
      ];

      const result = extractReasoning(history);
      expect(result).toEqual([
        "First, I need to add 2 and 2.",
        "The sum is 4.",
      ]);
    });

    it("extracts reasoning from content format", () => {
      const history: LlmHistory = [
        {
          role: LlmMessageRole.User,
          content: "Explain quantum physics",
          type: LlmMessageType.Message,
        },
        {
          type: "reasoning",
          id: "reasoning-1",
          content: "Let me think about quantum physics...",
        } as unknown as LlmHistory[number],
      ];

      const result = extractReasoning(history);
      expect(result).toEqual(["Let me think about quantum physics..."]);
    });

    it("extracts reasoning from both summary and content", () => {
      const history: LlmHistory = [
        {
          type: "reasoning",
          id: "reasoning-1",
          summary: [{ text: "From summary" }],
          content: "From content",
        } as unknown as LlmHistory[number],
      ];

      const result = extractReasoning(history);
      expect(result).toEqual(["From summary", "From content"]);
    });

    it("handles multiple reasoning items", () => {
      const history: LlmHistory = [
        {
          type: "reasoning",
          id: "reasoning-1",
          content: "First reasoning",
        } as unknown as LlmHistory[number],
        {
          role: LlmMessageRole.Assistant,
          content: "Intermediate response",
          type: LlmMessageType.Message,
        } as unknown as LlmHistory[number],
        {
          type: "reasoning",
          id: "reasoning-2",
          content: "Second reasoning",
        } as unknown as LlmHistory[number],
      ];

      const result = extractReasoning(history);
      expect(result).toEqual(["First reasoning", "Second reasoning"]);
    });
  });

  describe("Edge Cases", () => {
    it("ignores non-reasoning items", () => {
      const history: LlmHistory = [
        {
          role: LlmMessageRole.User,
          content: "Hello",
          type: LlmMessageType.Message,
        },
        {
          role: LlmMessageRole.Assistant,
          content: "Hi there!",
          type: LlmMessageType.Message,
        } as unknown as LlmHistory[number],
      ];

      const result = extractReasoning(history);
      expect(result).toEqual([]);
    });

    it("handles reasoning with empty summary array", () => {
      const history: LlmHistory = [
        {
          type: "reasoning",
          id: "reasoning-1",
          summary: [],
        } as unknown as LlmHistory[number],
      ];

      const result = extractReasoning(history);
      expect(result).toEqual([]);
    });

    it("handles reasoning with summary items missing text", () => {
      const history: LlmHistory = [
        {
          type: "reasoning",
          id: "reasoning-1",
          summary: [{ text: "Valid" }, {}, { text: undefined }],
        } as unknown as LlmHistory[number],
      ];

      const result = extractReasoning(history);
      expect(result).toEqual(["Valid"]);
    });

    it("handles reasoning with undefined content", () => {
      const history: LlmHistory = [
        {
          type: "reasoning",
          id: "reasoning-1",
          content: undefined,
        } as unknown as LlmHistory[number],
      ];

      const result = extractReasoning(history);
      expect(result).toEqual([]);
    });

    it("ignores items with type not equal to reasoning", () => {
      const history: LlmHistory = [
        {
          type: "thinking",
          content: "Not reasoning type",
        } as unknown as LlmHistory[number],
        {
          type: "internal",
          content: "Also not reasoning",
        } as unknown as LlmHistory[number],
      ];

      const result = extractReasoning(history);
      expect(result).toEqual([]);
    });
  });
});
