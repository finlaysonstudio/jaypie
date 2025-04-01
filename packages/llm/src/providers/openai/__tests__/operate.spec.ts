import { describe, expect, it, vi, beforeEach } from "vitest";
import { operate } from "../operate";
import { OpenAI } from "openai";
import {
  LlmMessageRole,
  LlmMessageType,
  LlmOperateResponse,
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

    it.skip("Responds with the LlmOperateResponse shape", async () => {
      // Call operate with mock client
      const result = await operate("Hello", {}, { client: mockClient });

      // Verify result has the expected shape
      expect(result).not.toBeUndefined();
      expect(result).toBeObject();
      expect(result).toHaveProperty("history");
      expect(result).toHaveProperty("output");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("usage");
      expect(result.status).toBe(LlmResponseStatus.Completed);
    });
  });

  describe("Features", () => {
    describe("User", () => {
      it.todo("Passes user to OpenAI");
    });

    describe("API Retry", () => {
      it.todo(
        "Retries retryable errors up to the MAX_RETRIES_DEFAULT_LIMIT limit",
      );

      describe("Error Handling", () => {
        it.todo("Throws BadGatewayError when retryable errors exceed limit");

        describe("Not Retryable Errors", () => {
          it.todo("Throws BadGatewayError non-retryable APIUserAbortError");
          it.todo("Throws BadGatewayError non-retryable AuthenticationError");
          it.todo("Throws BadGatewayError non-retryable BadRequestError");
          it.todo("Throws BadGatewayError non-retryable ConflictError");
          it.todo("Throws BadGatewayError non-retryable NotFoundError");
          it.todo("Throws BadGatewayError non-retryable PermissionDeniedError");
          it.todo("Throws BadGatewayError non-retryable RateLimitError");
          it.todo(
            "Throws BadGatewayError non-retryable UnprocessableEntityError",
          );
        });
      });

      describe("API Retry Observability", () => {
        it.todo("Logs debug on retry success");
        it.todo("Logs second warn on unknown errors");
        it.todo("Logs error on non-retryable errors");
        it.todo("Logs warn on retryable errors");
      });

      describe("Retryable Errors", () => {
        it.todo("Retries APIConnectionError");
        it.todo("Retries APIConnectionTimeoutError");
        it.todo("Retries InternalServerError");
        it.todo("Retries unknown errors");
      });
    });

    describe("Message Options", () => {
      it.todo("includes instruction message when provided");
      it.todo("Warns if system message is provided");
      it.todo("applies placeholders to system message");
      it.todo("applies placeholders to user message");
      it.todo("respects placeholders.message option");
      it.todo("respects placeholders.system option");
    });

    describe("Multi Turn", () => {
      it.todo(
        "Calls tool when tools are provided without explicitly setting turns",
      );
      it.todo("Continues turns until it reaches the max turns limit");
      it.todo("Runs to default max turns (12) when no max is specified");
      it.todo("Properly resolves Promise results from toolkit calls");
    });

    describe("Provider Options", () => {
      it.todo("Passes providerOptions to the OpenAI API");
    });

    describe("Chat history", () => {
      it.todo("Instances track history by default");
    });

    describe("Structured Output", () => {
      it.todo("Structured output uses responses API");
      it.todo("Handles NaturalSchema response format");
      it.todo("Accepts json_schema output format");
    });
  });
});
