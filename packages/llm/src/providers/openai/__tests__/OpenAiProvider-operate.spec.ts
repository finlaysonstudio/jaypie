import { getEnvSecret } from "@jaypie/aws";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  InternalServerError,
  NotFoundError,
  OpenAI,
  PermissionDeniedError,
  RateLimitError,
} from "openai";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenAiProvider } from "../OpenAiProvider.class";
import {
  MAX_RETRIES_ABSOLUTE_LIMIT,
  MAX_RETRIES_DEFAULT_LIMIT,
} from "../operate";
import { PROVIDER } from "../../../constants.js";

vi.mock("openai");

describe("OpenAiProvider.operate", () => {
  beforeEach(() => {
    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          responses: {
            create: vi.fn(),
          },
        }) as any,
    );
    vi.mocked(getEnvSecret).mockResolvedValue("test-key");
  });

  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(OpenAiProvider).toBeClass();
      const provider = new OpenAiProvider();
      expect(provider).toBeInstanceOf(OpenAiProvider);
      expect(provider.operate).toBeFunction();
    });
    it("Works", async () => {
      const provider = new OpenAiProvider();
      const result = await provider.operate("test");
      expect(result).toBeArray();
    });
    it("Works how we expect", async () => {
      // Setup
      const mockResponse = [
        {
          id: "resp_123",
          content: [{ text: "Cilantro is a good taco ingredient" }],
        },
      ];
      const mockCreate = vi.fn().mockResolvedValue(mockResponse[0]);
      vi.mocked(OpenAI).mockImplementation(
        () =>
          ({
            responses: {
              create: mockCreate,
            },
          }) as any,
      );
      // Execute
      const provider = new OpenAiProvider("mock-model");
      const testInput = "What is a good taco ingredient?";
      const result = await provider.operate(testInput);
      // Verify
      expect(result).toBeArray();
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({
        model: "mock-model",
        input: testInput,
      });
    });
  });

  describe("Features", () => {
    describe("API Retry", () => {
      it("Retries retryable errors up to the MAX_RETRIES_DEFAULT_LIMIT limit", async () => {
        // Setup
        const mockCreate = vi.fn();
        // First MAX_RETRIES_DEFAULT_LIMIT calls will fail with 500 errors
        for (let i = 0; i < MAX_RETRIES_DEFAULT_LIMIT; i++) {
          mockCreate.mockRejectedValueOnce(
            new InternalServerError(
              500,
              "Internal Server Error",
              undefined,
              {},
            ),
          );
        }
        // The next call will succeed
        const mockResponse = {
          id: "resp_123",
          content: [{ text: "Success after retries" }],
        };
        mockCreate.mockResolvedValueOnce(mockResponse);

        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              responses: {
                create: mockCreate,
              },
            }) as any,
        );

        // Spy on sleep function to avoid waiting in tests
        const sleepSpy = vi
          .spyOn(await import("@jaypie/core"), "sleep")
          .mockResolvedValue(undefined);

        // Execute
        const provider = new OpenAiProvider();
        const result = await provider.operate("test input");

        // Verify
        expect(result).toBeArray();
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(mockResponse);

        // Verify the create function was called the expected number of times
        // MAX_RETRIES_DEFAULT_LIMIT failures + 1 success = MAX_RETRIES_DEFAULT_LIMIT + 1 total calls
        expect(mockCreate).toHaveBeenCalledTimes(MAX_RETRIES_DEFAULT_LIMIT + 1);

        // Verify sleep was called for each retry
        expect(sleepSpy).toHaveBeenCalledTimes(MAX_RETRIES_DEFAULT_LIMIT);

        // Clean up
        sleepSpy.mockRestore();
      });
      describe("Error Handling", () => {
        it.todo("Throws BadGatewayError when retryable errors exceed limit");
        describe("Not Retryable Errors", () => {
          it.todo("Throws BadGatewayError non-retryable 400 errors");
          it.todo("Throws BadGatewayError non-retryable 403 errors");
          it.todo("Throws BadGatewayError non-retryable 404 errors");
          it.todo("Throws BadGatewayError non-retryable 429 errors");
        });
      });
      describe("API Retry Observability", () => {
        it.todo("Logs debug on retry");
        it.todo("Logs warn on non-API errors");
        it.todo("Logs error on non-retryable errors");
        it.todo("Logs warn on retryable errors");
      });
      describe("Retryable Errors", () => {
        it.todo("Retries 500 errors");
        it.todo("Retries 502 errors");
        it.todo("Retries 503 errors");
        it.todo("Retries 504 errors");
        it.todo("Retries timeout errors");
        it.todo("Retries non-API errors");
      });
      describe("API Retry Context", () => {
        it.todo("Can configure the retry limit");
        it.todo("Retry limit has an absolute cap");
      });
    });
  });
});
