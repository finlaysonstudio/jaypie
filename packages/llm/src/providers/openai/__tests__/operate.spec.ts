import { describe, expect, it, vi, beforeEach } from "vitest";
import { operate } from "../operate";
import { OpenAI } from "openai";
import {
  LlmMessageRole,
  LlmMessageType,
  LlmResponseStatus,
} from "../../../types/LlmProvider.interface.js";

describe("operate", () => {
  // Mock OpenAI client setup
  let mockClient: OpenAI;

  beforeEach(() => {
    // Reset mock client before each test
    mockClient = {
      responses: {
        create: vi.fn().mockResolvedValue({
          created: 1234567890,
          error: null,
          id: "mock-id",
          model: "mock-gpt",
          object: "response",
          output: [
            {
              type: LlmMessageType.Message,
              content: [
                { type: LlmMessageType.OutputText, text: "Hello, world!" },
              ],
              role: LlmMessageRole.Assistant,
            },
          ],
          status: LlmResponseStatus.Completed,
          text: {
            format: {
              type: "text",
            },
          },
          usage: {
            input_tokens: 36,
            input_tokens_details: {
              cached_tokens: 0,
            },
            output_tokens: 87,
            output_tokens_details: {
              reasoning_tokens: 0,
            },
            total_tokens: 123,
          },
        }),
      },
    } as unknown as OpenAI;
  });

  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(operate).toBeFunction();
    });

    it("works", async () => {
      // Call operate with mock client
      const result = await operate("Hello", {}, { client: mockClient });

      // Verify result contains the expected response
      expect(result).not.toBeUndefined();

      // Verify the mock was called
      expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
    });
  });
});
