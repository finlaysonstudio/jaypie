import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCompletion,
  getCompletionStream,
  operate,
} from "../../src/mock/llm";

describe("LLM Mocks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCompletion", () => {
    it("should return default mock response", async () => {
      const response = await getCompletion("What is the capital of France?");
      expect(response).toBe("This is a mock completion response");
    });

    it("should track calls with prompt and options", async () => {
      const prompt = "Tell me a joke";
      const options = { temperature: 0.7, maxTokens: 100 };

      await getCompletion(prompt, options);

      expect(getCompletion.mock.calls.length).toBe(1);
      expect(getCompletion.mock.calls[0][0]).toBe(prompt);
      expect(getCompletion.mock.calls[0][1]).toBe(options);
    });

    it("should allow customizing the response", async () => {
      const customResponse = "Paris is the capital of France";
      getCompletion.mockResolvedValueOnce(customResponse);

      const response = await getCompletion("What is the capital of France?");
      expect(response).toBe(customResponse);
    });
  });

  describe("getCompletionStream", () => {
    it("should return an async iterable with chunks", async () => {
      const stream = await getCompletionStream("Tell me a story");
      const chunks = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([
        { content: "This " },
        { content: "is " },
        { content: "a " },
        { content: "mock " },
        { content: "streaming " },
        { content: "response" },
      ]);

      // Combined content should be "This is a mock streaming response"
      const combinedContent = chunks.map((chunk) => chunk.content).join("");
      expect(combinedContent).toBe("This is a mock streaming response");
    });

    it("should track calls with prompt and options", async () => {
      const prompt = "Tell me a story";
      const options = { temperature: 0.7 };

      await getCompletionStream(prompt, options);

      expect(getCompletionStream.mock.calls.length).toBe(1);
      expect(getCompletionStream.mock.calls[0][0]).toBe(prompt);
      expect(getCompletionStream.mock.calls[0][1]).toBe(options);
    });

    it("should allow customizing the stream response", async () => {
      getCompletionStream.mockImplementationOnce(async function* () {
        yield { content: "Custom " };
        yield { content: "response" };
      });

      const stream = await getCompletionStream("Tell me a story");
      const chunks = [];

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([{ content: "Custom " }, { content: "response" }]);
    });
  });

  describe("operate", () => {
    it("should return default mock result", async () => {
      const question = "How many users registered today?";
      const context = { data: [{ date: "2025-05-05", count: 42 }] };

      const result = await operate(question, context);

      expect(result).toEqual({ result: "mock operation result" });
    });

    it("should track calls with question, context and options", async () => {
      const question = "How many users registered today?";
      const context = { data: [{ date: "2025-05-05", count: 42 }] };
      const options = { format: "json" };

      await operate(question, context, options);

      expect(operate.mock.calls.length).toBe(1);
      expect(operate.mock.calls[0][0]).toBe(question);
      expect(operate.mock.calls[0][1]).toBe(context);
      expect(operate.mock.calls[0][2]).toBe(options);
    });

    it("should allow customizing the result", async () => {
      const customResult = { count: 42, date: "2025-05-05" };
      operate.mockResolvedValueOnce(customResult);

      const result = await operate("How many users registered today?", {});

      expect(result).toEqual(customResult);
    });
  });
});
