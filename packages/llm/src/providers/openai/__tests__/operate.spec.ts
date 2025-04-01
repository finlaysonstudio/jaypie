import { describe, expect, it, vi, beforeEach } from "vitest";
import { operate } from "../operate";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  OpenAI,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
} from "openai";
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
    describe("API Retry", () => {
      it("Retries retryable errors up to the MAX_RETRIES_DEFAULT_LIMIT limit", async () => {
        // Import the MAX_RETRIES_DEFAULT_LIMIT constant
        const { MAX_RETRIES_DEFAULT_LIMIT } = await import("../operate");

        // Setup
        // First MAX_RETRIES_DEFAULT_LIMIT calls will fail with 500 errors
        for (let i = 0; i < MAX_RETRIES_DEFAULT_LIMIT; i++) {
          mockClient.responses.create.mockRejectedValueOnce(
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
          output: [
            {
              type: LlmMessageType.Message,
              content: [
                {
                  type: LlmMessageType.OutputText,
                  text: "Success after retries",
                },
              ],
              role: LlmMessageRole.Assistant,
            },
          ],
        };
        mockClient.responses.create.mockResolvedValueOnce(mockResponse);

        // Execute
        await operate(
          "What is a good taco ingredient?",
          {},
          { client: mockClient },
        );

        // Verify the create function was called the expected number of times
        // MAX_RETRIES_DEFAULT_LIMIT failures + 1 success = MAX_RETRIES_DEFAULT_LIMIT + 1 total calls
        expect(mockClient.responses.create).toHaveBeenCalledTimes(
          MAX_RETRIES_DEFAULT_LIMIT + 1,
        );
      });

      describe("Error Handling", () => {
        it("Throws BadGatewayError when retryable errors exceed limit", async () => {
          // Import the MAX_RETRIES_DEFAULT_LIMIT constant
          const { MAX_RETRIES_DEFAULT_LIMIT } = await import("../operate");

          // Setup
          // All calls will fail with 500 errors (exceeding the retry limit)
          for (let i = 0; i <= MAX_RETRIES_DEFAULT_LIMIT; i++) {
            mockClient.responses.create.mockRejectedValueOnce(
              new InternalServerError(
                500,
                "Internal Server Error",
                undefined,
                {},
              ),
            );
          }

          // Verify
          await expect(
            operate("test input", {}, { client: mockClient }),
          ).rejects.toThrow();

          // Verify the create function was called the expected number of times
          // Should be called MAX_RETRIES_DEFAULT_LIMIT + 1 times (initial + retries)
          expect(mockClient.responses.create).toHaveBeenCalledTimes(
            MAX_RETRIES_DEFAULT_LIMIT + 1,
          );
        });

        describe("Not Retryable Errors", () => {
          it("Throws BadGatewayError non-retryable APIUserAbortError", async () => {
            // Setup
            mockClient.responses.create.mockRejectedValueOnce(
              new APIUserAbortError(),
            );

            // Verify
            await expect(
              operate("test input", {}, { client: mockClient }),
            ).rejects.toThrow();

            // Should only be called once, not retried
            expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
          });
          it("Throws BadGatewayError non-retryable AuthenticationError", async () => {
            // Setup
            mockClient.responses.create.mockRejectedValueOnce(
              new AuthenticationError(
                401,
                "Authentication error",
                undefined,
                {},
              ),
            );

            // Verify
            await expect(
              operate("test input", {}, { client: mockClient }),
            ).rejects.toThrow();

            // Should only be called once, not retried
            expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
          });
          it("Throws BadGatewayError non-retryable BadRequestError", async () => {
            // Setup
            mockClient.responses.create.mockRejectedValueOnce(
              new BadRequestError(400, "Bad request error", undefined, {}),
            );

            // Verify
            await expect(
              operate("test input", {}, { client: mockClient }),
            ).rejects.toThrow();

            // Should only be called once, not retried
            expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
          });
          it("Throws BadGatewayError non-retryable ConflictError", async () => {
            // Setup
            mockClient.responses.create.mockRejectedValueOnce(
              new ConflictError(409, "Conflict error", undefined, {}),
            );

            // Verify
            await expect(
              operate("test input", {}, { client: mockClient }),
            ).rejects.toThrow();

            // Should only be called once, not retried
            expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
          });
          it("Throws BadGatewayError non-retryable NotFoundError", async () => {
            // Setup
            mockClient.responses.create.mockRejectedValueOnce(
              new NotFoundError(404, "Not found error", undefined, {}),
            );

            // Verify
            await expect(
              operate("test input", {}, { client: mockClient }),
            ).rejects.toThrow();

            // Should only be called once, not retried
            expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
          });
          it("Throws BadGatewayError non-retryable PermissionDeniedError", async () => {
            // Setup
            mockClient.responses.create.mockRejectedValueOnce(
              new PermissionDeniedError(
                403,
                "Permission denied error",
                undefined,
                {},
              ),
            );

            // Verify
            await expect(
              operate("test input", {}, { client: mockClient }),
            ).rejects.toThrow();

            // Should only be called once, not retried
            expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
          });
          it("Throws BadGatewayError non-retryable RateLimitError", async () => {
            // Setup
            mockClient.responses.create.mockRejectedValueOnce(
              new RateLimitError(429, "Rate limit error", undefined, {}),
            );

            // Verify
            await expect(
              operate("test input", {}, { client: mockClient }),
            ).rejects.toThrow();

            // Should only be called once, not retried
            expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
          });
          it("Throws BadGatewayError non-retryable UnprocessableEntityError", async () => {
            // Setup
            mockClient.responses.create.mockRejectedValueOnce(
              new UnprocessableEntityError(
                422,
                "Unprocessable entity error",
                undefined,
                {},
              ),
            );

            // Verify
            await expect(
              operate("test input", {}, { client: mockClient }),
            ).rejects.toThrow();

            // Should only be called once, not retried
            expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
          });
        });
      });

      describe("API Retry Observability", () => {
        it("Logs debug on retry success", async () => {
          // Import log module
          const { log } = await import("../../../util/logger.js");
          // Spy on the log.debug method
          vi.spyOn(log, "debug");

          // Setup
          // First call fails with a retryable error
          mockClient.responses.create.mockRejectedValueOnce(
            new InternalServerError(
              500,
              "Internal Server Error",
              undefined,
              {},
            ),
          );
          // Second call succeeds
          const mockResponse = {
            id: "resp_123",
            output: [
              {
                type: LlmMessageType.Message,
                content: [
                  {
                    type: LlmMessageType.OutputText,
                    text: "Success after retry",
                  },
                ],
                role: LlmMessageRole.Assistant,
              },
            ],
          };
          mockClient.responses.create.mockResolvedValueOnce(mockResponse);

          // Execute
          await operate("test input", {}, { client: mockClient });

          // Verify debug log was called with the correct message
          expect(log.debug).toHaveBeenCalledWith(
            "OpenAI API call succeeded after 1 retries",
          );
        });
        it("Logs second warn on unknown errors", async () => {
          // Import log module
          const { log } = await import("../../../util/logger.js");
          // Spy on the log methods
          vi.spyOn(log, "warn");
          vi.spyOn(log, "var");

          // Setup
          // Create an unknown error type that's not in the retryable list
          const unknownError = new Error("Unknown error");
          mockClient.responses.create.mockRejectedValueOnce(unknownError);

          // Second call succeeds
          const mockResponse = {
            id: "resp_123",
            output: [
              {
                type: LlmMessageType.Message,
                content: [
                  {
                    type: LlmMessageType.OutputText,
                    text: "Success after unknown error",
                  },
                ],
                role: LlmMessageRole.Assistant,
              },
            ],
          };
          mockClient.responses.create.mockResolvedValueOnce(mockResponse);

          // Execute
          await operate("test input", {}, { client: mockClient });

          // Verify warn log was called with the correct messages
          expect(log.warn).toHaveBeenCalledWith(
            "OpenAI API returned unknown error",
          );
          expect(log.var).toHaveBeenCalledWith({ error: unknownError });
          expect(log.warn).toHaveBeenCalledWith(
            expect.stringContaining("OpenAI API call failed. Retrying"),
          );
        });
        it("Logs error on non-retryable errors", async () => {
          // Import log module
          const { log } = await import("../../../util/logger.js");
          // Spy on the log methods
          vi.spyOn(log, "error");
          vi.spyOn(log, "var");

          // Setup
          const authError = new AuthenticationError(
            401,
            "Authentication error",
            undefined,
            {},
          );
          mockClient.responses.create.mockRejectedValueOnce(authError);

          // Execute
          try {
            await operate("test input", {}, { client: mockClient });
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (error) {
            // Expected to throw
          }

          // Verify error log was called with the correct message
          expect(log.error).toHaveBeenCalledWith(
            "OpenAI API call failed with non-retryable error",
          );
          expect(log.var).toHaveBeenCalledWith({ error: authError });
        });
        it("Logs warn on retryable errors", async () => {
          // Import log module
          const { log } = await import("../../../util/logger.js");
          // Spy on the log methods
          vi.spyOn(log, "warn");

          // Setup
          // First call fails with a retryable error
          const serverError = new InternalServerError(
            500,
            "Internal Server Error",
            undefined,
            {},
          );
          mockClient.responses.create.mockRejectedValueOnce(serverError);

          // Second call succeeds
          const mockResponse = {
            id: "resp_123",
            output: [
              {
                type: LlmMessageType.Message,
                content: [
                  {
                    type: LlmMessageType.OutputText,
                    text: "Success after retry",
                  },
                ],
                role: LlmMessageRole.Assistant,
              },
            ],
          };
          mockClient.responses.create.mockResolvedValueOnce(mockResponse);

          // Execute
          await operate("test input", {}, { client: mockClient });

          // Verify warn log was called with the correct message
          expect(log.warn).toHaveBeenCalledWith(
            expect.stringContaining("OpenAI API call failed. Retrying"),
          );
        });
      });

      describe("Retryable Errors", () => {
        it("Retries APIConnectionError", async () => {
          // Setup
          // First call fails with a connection error
          mockClient.responses.create.mockRejectedValueOnce(
            new APIConnectionError({ message: "Connection error" }),
          );
          // Second call succeeds
          const mockResponse = {
            id: "resp_123",
            output: [
              {
                type: LlmMessageType.Message,
                content: [
                  {
                    type: LlmMessageType.OutputText,
                    text: "Success after connection error",
                  },
                ],
                role: LlmMessageRole.Assistant,
              },
            ],
          };
          mockClient.responses.create.mockResolvedValueOnce(mockResponse);

          // Execute
          await operate("test input", {}, { client: mockClient });

          // Verify the create function was called twice (1 failure + 1 success)
          expect(mockClient.responses.create).toHaveBeenCalledTimes(2);
        });
        it("Retries APIConnectionTimeoutError", async () => {
          // Setup
          // First call fails with a timeout error
          mockClient.responses.create.mockRejectedValueOnce(
            new APIConnectionTimeoutError({ message: "Connection timeout" }),
          );
          // Second call succeeds
          const mockResponse = {
            id: "resp_123",
            output: [
              {
                type: LlmMessageType.Message,
                content: [
                  {
                    type: LlmMessageType.OutputText,
                    text: "Success after timeout",
                  },
                ],
                role: LlmMessageRole.Assistant,
              },
            ],
          };
          mockClient.responses.create.mockResolvedValueOnce(mockResponse);

          // Execute
          await operate("test input", {}, { client: mockClient });

          // Verify the create function was called twice (1 failure + 1 success)
          expect(mockClient.responses.create).toHaveBeenCalledTimes(2);
        });
        it("Retries InternalServerError", async () => {
          // Setup
          // First call fails with an internal server error
          mockClient.responses.create.mockRejectedValueOnce(
            new InternalServerError(
              500,
              "Internal Server Error",
              undefined,
              {},
            ),
          );
          // Second call succeeds
          const mockResponse = {
            id: "resp_123",
            output: [
              {
                type: LlmMessageType.Message,
                content: [
                  {
                    type: LlmMessageType.OutputText,
                    text: "Success after server error",
                  },
                ],
                role: LlmMessageRole.Assistant,
              },
            ],
          };
          mockClient.responses.create.mockResolvedValueOnce(mockResponse);

          // Execute
          await operate("test input", {}, { client: mockClient });

          // Verify the create function was called twice (1 failure + 1 success)
          expect(mockClient.responses.create).toHaveBeenCalledTimes(2);
        });
        it("Retries unknown errors", async () => {
          // Setup
          // First call fails with an unknown error
          const unknownError = new Error("Unknown error");
          mockClient.responses.create.mockRejectedValueOnce(unknownError);

          // Second call succeeds
          const mockResponse = {
            id: "resp_123",
            output: [
              {
                type: LlmMessageType.Message,
                content: [
                  {
                    type: LlmMessageType.OutputText,
                    text: "Success after unknown error",
                  },
                ],
                role: LlmMessageRole.Assistant,
              },
            ],
          };
          mockClient.responses.create.mockResolvedValueOnce(mockResponse);

          // Execute
          await operate("test input", {}, { client: mockClient });

          // Verify the create function was called twice (1 failure + 1 success)
          expect(mockClient.responses.create).toHaveBeenCalledTimes(2);
        });
      });
    });

    describe("Chat history", () => {
      it.todo("Instances track history by default");
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

    describe("Structured Output", () => {
      it.todo("Structured output uses responses API");
      it.todo("Handles NaturalSchema response format");
      it.todo("Accepts json_schema output format");
    });

    describe("User", () => {
      it("Passes user to OpenAI", async () => {
        // Execute
        const testInput = "What is a good taco ingredient?";
        await operate(
          testInput,
          {
            user: "test-user",
          },
          { client: mockClient },
        );

        // Verify
        expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
        expect(mockClient.responses.create).toHaveBeenCalledWith(
          expect.objectContaining({
            model: expect.any(String),
            input: expect.any(Array),
            user: "test-user",
          }),
        );
      });
      it("Does not pass user if not provided", async () => {
        // Execute
        const testInput = "What is a good taco ingredient?";
        await operate(testInput, {}, { client: mockClient });

        // Verify
        expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
        expect(mockClient.responses.create).toHaveBeenCalledWith(
          expect.objectContaining({
            model: expect.any(String),
            input: expect.any(Array),
          }),
        );
        // Verify user is not passed
        expect(mockClient.responses.create).not.toHaveBeenCalledWith(
          expect.objectContaining({
            user: "test-user",
          }),
        );
      });
    });
  });
});
