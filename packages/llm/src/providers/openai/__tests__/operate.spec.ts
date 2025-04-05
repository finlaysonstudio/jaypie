import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
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
  LlmOutputContentText,
  LlmOutputMessage,
  LlmResponseStatus,
} from "../../../types/LlmProvider.interface.js";
import { log, MAX_TURNS_DEFAULT_LIMIT } from "../../../util";
import { restoreLog, spyLog } from "@jaypie/testkit";
import { LlmTool } from "../../../types/LlmTool.interface";
import { BadGatewayError } from "@jaypie/errors";

describe("operate", () => {
  // Mock OpenAI client setup
  let mockClient: OpenAI;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create mock function for responses.create
    mockCreate = vi.fn().mockResolvedValue({
      created: 1234567890,
      error: null,
      id: "mock-id",
      model: "mock-gpt",
      object: "response",
      output: [
        {
          type: LlmMessageType.Message,
          content: [{ type: LlmMessageType.OutputText, text: "Hello, world!" }],
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
    });

    // Reset mock client before each test
    mockClient = {
      responses: {
        create: mockCreate,
      },
    } as unknown as OpenAI;

    // Set up log spying
    spyLog(log);
  });

  afterEach(() => {
    vi.clearAllMocks();
    restoreLog(log);
  });

  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(operate).toBeFunction();
    });

    it("Works", async () => {
      // Call operate with mock client
      const result = await operate("Hello", {}, { client: mockClient });

      // Verify result contains the expected response
      expect(result).not.toBeUndefined();

      // Verify the mock was called
      expect(mockClient.responses.create).toHaveBeenCalledTimes(1);
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
        mockCreate.mockResolvedValueOnce(mockResponse);

        // Execute
        await operate(
          "What is a good taco ingredient?",
          {},
          { client: mockClient },
        );

        // Verify the create function was called the expected number of times
        // MAX_RETRIES_DEFAULT_LIMIT failures + 1 success = MAX_RETRIES_DEFAULT_LIMIT + 1 total calls
        expect(mockCreate).toHaveBeenCalledTimes(MAX_RETRIES_DEFAULT_LIMIT + 1);
      });

      describe("Error Handling", () => {
        it("Throws BadGatewayError when retryable errors exceed limit", async () => {
          // Import the MAX_RETRIES_DEFAULT_LIMIT constant
          const { MAX_RETRIES_DEFAULT_LIMIT } = await import("../operate");

          // Setup
          // All calls will fail with 500 errors (exceeding the retry limit)
          for (let i = 0; i <= MAX_RETRIES_DEFAULT_LIMIT; i++) {
            mockCreate.mockRejectedValueOnce(
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
          expect(mockCreate).toHaveBeenCalledTimes(
            MAX_RETRIES_DEFAULT_LIMIT + 1,
          );
        });

        describe("Not Retryable Errors", () => {
          it("Throws BadGatewayError non-retryable APIUserAbortError", async () => {
            // Setup
            mockCreate.mockRejectedValueOnce(new APIUserAbortError());

            // Verify
            await expect(
              operate("test input", {}, { client: mockClient }),
            ).rejects.toThrow();

            // Should only be called once, not retried
            expect(mockCreate).toHaveBeenCalledTimes(1);
          });
          it("Throws BadGatewayError non-retryable AuthenticationError", async () => {
            // Setup
            mockCreate.mockRejectedValueOnce(
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
            expect(mockCreate).toHaveBeenCalledTimes(1);
          });
          it("Throws BadGatewayError non-retryable BadRequestError", async () => {
            // Setup
            mockCreate.mockRejectedValueOnce(
              new BadRequestError(400, "Bad request error", undefined, {}),
            );

            // Verify
            await expect(
              operate("test input", {}, { client: mockClient }),
            ).rejects.toThrow();

            // Should only be called once, not retried
            expect(mockCreate).toHaveBeenCalledTimes(1);
          });
          it("Throws BadGatewayError non-retryable ConflictError", async () => {
            // Setup
            mockCreate.mockRejectedValueOnce(
              new ConflictError(409, "Conflict error", undefined, {}),
            );

            // Verify
            await expect(
              operate("test input", {}, { client: mockClient }),
            ).rejects.toThrow();

            // Should only be called once, not retried
            expect(mockCreate).toHaveBeenCalledTimes(1);
          });
          it("Throws BadGatewayError non-retryable NotFoundError", async () => {
            // Setup
            mockCreate.mockRejectedValueOnce(
              new NotFoundError(404, "Not found error", undefined, {}),
            );

            // Verify
            await expect(
              operate("test input", {}, { client: mockClient }),
            ).rejects.toThrow();

            // Should only be called once, not retried
            expect(mockCreate).toHaveBeenCalledTimes(1);
          });
          it("Throws BadGatewayError non-retryable PermissionDeniedError", async () => {
            // Setup
            mockCreate.mockRejectedValueOnce(
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
            expect(mockCreate).toHaveBeenCalledTimes(1);
          });
          it("Throws BadGatewayError non-retryable RateLimitError", async () => {
            // Setup
            mockCreate.mockRejectedValueOnce(
              new RateLimitError(429, "Rate limit error", undefined, {}),
            );

            // Verify
            await expect(
              operate("test input", {}, { client: mockClient }),
            ).rejects.toThrow();

            // Should only be called once, not retried
            expect(mockCreate).toHaveBeenCalledTimes(1);
          });
          it("Throws BadGatewayError non-retryable UnprocessableEntityError", async () => {
            // Setup
            mockCreate.mockRejectedValueOnce(
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
            expect(mockCreate).toHaveBeenCalledTimes(1);
          });
        });
      });

      describe("API Retry Observability", () => {
        it("Logs debug on retry success", async () => {
          // Setup
          // First call fails with a retryable error
          mockCreate.mockRejectedValueOnce(
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
          mockCreate.mockResolvedValueOnce(mockResponse);

          // Execute
          await operate("test input", {}, { client: mockClient });

          // Verify debug log was called with the correct message
          expect(log.debug).toHaveBeenCalledWith(
            "OpenAI API call succeeded after 1 retries",
          );
        });
        it("Logs second warn on unknown errors", async () => {
          // Setup
          // Create an unknown error type that's not in the retryable list
          const unknownError = new Error("Unknown error");
          mockCreate.mockRejectedValueOnce(unknownError);

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
          mockCreate.mockResolvedValueOnce(mockResponse);

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
          // Setup
          const authError = new AuthenticationError(
            401,
            "Authentication error",
            undefined,
            {},
          );
          mockCreate.mockRejectedValueOnce(authError);

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
          // Setup
          // First call fails with a retryable error
          const serverError = new InternalServerError(
            500,
            "Internal Server Error",
            undefined,
            {},
          );
          mockCreate.mockRejectedValueOnce(serverError);

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
          mockCreate.mockResolvedValueOnce(mockResponse);

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
          mockCreate.mockRejectedValueOnce(
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
          mockCreate.mockResolvedValueOnce(mockResponse);

          // Execute
          await operate("test input", {}, { client: mockClient });

          // Verify the create function was called twice (1 failure + 1 success)
          expect(mockCreate).toHaveBeenCalledTimes(2);
        });
        it("Retries APIConnectionTimeoutError", async () => {
          // Setup
          // First call fails with a timeout error
          mockCreate.mockRejectedValueOnce(
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
          mockCreate.mockResolvedValueOnce(mockResponse);

          // Execute
          await operate("test input", {}, { client: mockClient });

          // Verify the create function was called twice (1 failure + 1 success)
          expect(mockCreate).toHaveBeenCalledTimes(2);
        });
        it("Retries InternalServerError", async () => {
          // Setup
          // First call fails with an internal server error
          mockCreate.mockRejectedValueOnce(
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
          mockCreate.mockResolvedValueOnce(mockResponse);

          // Execute
          await operate("test input", {}, { client: mockClient });

          // Verify the create function was called twice (1 failure + 1 success)
          expect(mockCreate).toHaveBeenCalledTimes(2);
        });
        it("Retries unknown errors", async () => {
          // Setup
          // First call fails with an unknown error
          const unknownError = new Error("Unknown error");
          mockCreate.mockRejectedValueOnce(unknownError);

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
          mockCreate.mockResolvedValueOnce(mockResponse);

          // Execute
          await operate("test input", {}, { client: mockClient });

          // Verify the create function was called twice (1 failure + 1 success)
          expect(mockCreate).toHaveBeenCalledTimes(2);
        });
      });
    });

    describe("Chat history", () => {
      it.todo("Passes chat history to the OpenAI API");
      it.todo("Instances track history by default");
    });

    describe("Message Options", () => {
      it("includes instruction message when provided", async () => {
        // Setup
        const instructions = "You are a helpful assistant";

        // Execute
        await operate(
          "test message",
          {
            instructions,
          },
          { client: mockClient },
        );

        // Verify
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            instructions,
            input: expect.any(Array),
            model: expect.any(String),
          }),
        );
      });

      it("Warns if system message is provided", async () => {
        // Execute
        await operate(
          "test message",
          {
            // @ts-expect-error Intentionally pass an old parameter
            system: "You are a helpful assistant",
          },
          { client: mockClient },
        );

        // Verify
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            instructions: "You are a helpful assistant",
            input: expect.any(Array),
            model: expect.any(String),
          }),
        );
        expect(log.warn).toHaveBeenCalled();
      });

      it("applies placeholders to instructions", async () => {
        // Setup
        const instructions = "You are a {{role}}";
        const data = { role: "test assistant" };

        // Execute
        await operate(
          "test message",
          {
            instructions,
            data,
          },
          { client: mockClient },
        );

        // Verify
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            instructions: "You are a test assistant",
            input: expect.any(Array),
            model: expect.any(String),
          }),
        );
      });

      it("applies placeholders to user message", async () => {
        // Setup
        const inputMessage = "Hello, {{name}}";
        const data = { name: "World" };

        // Execute
        await operate(
          inputMessage,
          {
            data,
          },
          { client: mockClient },
        );

        // Verify
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.arrayContaining([
              expect.objectContaining({
                content: "Hello, World",
                role: "user",
                type: "message",
              }),
            ]),
            model: expect.any(String),
          }),
        );
      });

      it("respects placeholders.input option", async () => {
        // Setup
        const inputMessage = "Hello, {{name}}";
        const data = { name: "World" };

        // Execute
        await operate(
          inputMessage,
          {
            data,
            placeholders: { input: false },
          },
          { client: mockClient },
        );

        // Verify
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.arrayContaining([
              expect.objectContaining({
                content: "Hello, {{name}}",
                role: "user",
                type: "message",
              }),
            ]),
            model: expect.any(String),
          }),
        );
      });

      it("respects placeholders.instructions option", async () => {
        // Setup
        const instructions = "You are a {{role}}";
        const data = { role: "test assistant" };

        // Execute
        await operate(
          "test message",
          {
            instructions,
            data,
            placeholders: { instructions: false },
          },
          { client: mockClient },
        );

        // Verify
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            instructions: "You are a {{role}}",
            input: expect.any(Array),
            model: expect.any(String),
          }),
        );
      });
    });

    describe("Error Conditions", () => {
      it("Handles malformed responses gracefully", async () => {
        // Setup
        // Create a malformed response that will cause processing to fail
        const malformedResponse = {
          id: "resp_123",
          // Missing output array
        };
        mockCreate.mockResolvedValueOnce(malformedResponse);

        // Execute
        const result = await operate("test input", {}, { client: mockClient });

        // Verify the function returns a valid response structure even with malformed input
        expect(result).toHaveProperty("status");
        expect(result).toHaveProperty("responses");
        expect(result.responses).toContain(malformedResponse);

        // Verify the create function was called once
        expect(mockCreate).toHaveBeenCalledTimes(1);

        expect(result.error).toBeUndefined();
      });

      it("Handles function call execution errors gracefully", async () => {
        // Setup
        // Mock a response with a function call
        const mockResponse = {
          id: "resp_123",
          output: [
            {
              type: LlmMessageType.FunctionCall,
              name: "test_function",
              arguments: "{}",
              call_id: "call_123",
            },
          ],
        };
        mockCreate.mockResolvedValueOnce(mockResponse);

        // Create a failing tool
        const mockTool: LlmTool = {
          call: vi
            .fn()
            .mockRejectedValue(new Error("Function execution failed")),
          description: "A test function",
          name: "test_function",
          parameters: {},
          type: LlmMessageType.FunctionCall,
        };

        // Execute
        const result = await operate(
          "test input",
          {
            tools: [mockTool],
            turns: true,
          },
          { client: mockClient },
        );

        // Verify the function returns a valid response
        expect(result).toHaveProperty("status");
        expect(result.responses).toContain(mockResponse);

        // Verify the tool was called
        expect(mockTool.call).toHaveBeenCalled();

        // Verify that error was logged
        expect(log.error).toHaveBeenCalledWith(
          expect.stringContaining(
            "Error executing function call test_function",
          ),
        );

        expect(result.error).not.toBeUndefined();
        expect(result.error).toBeObject();
        expect(result.error?.title).toBeString();
        expect(result.error?.detail).toBeString();
        expect(result.error?.status).toBeNumber();
      });

      it("Handles responses with invalid structure gracefully", async () => {
        // Setup
        // Create a response with invalid structure
        const invalidResponse = "not a valid response object";
        mockCreate.mockResolvedValueOnce(invalidResponse);

        // Execute
        const result = await operate("test input", {}, { client: mockClient });

        // Verify the function returns a valid response structure
        expect(result).toHaveProperty("status");
        expect(result).toHaveProperty("responses");
        expect(result.responses).toContain(invalidResponse);

        // Verify the create function was called once
        expect(mockCreate).toHaveBeenCalledTimes(1);

        // The operate function doesn't actually log a warning for invalid structure,
        // it just handles it gracefully by including it in the responses array
        expect(result.error).toBeUndefined();
      });

      it("Returns incomplete status when maxTurns is reached", async () => {
        // Setup
        // Create a response with a function call that will trigger multi-turn
        const mockResponse = {
          id: "resp_123",
          output: [
            {
              type: LlmMessageType.FunctionCall,
              name: "test_function",
              arguments: "{}",
              call_id: "call_123",
            },
          ],
        };

        // Always return the same response to force exceeding maxTurns
        mockCreate.mockResolvedValue(mockResponse);

        // Create a tool that always succeeds but doesn't stop the loop
        const mockTool: LlmTool = {
          call: vi.fn().mockResolvedValue({ result: "success" }),
          description: "A test function",
          name: "test_function",
          parameters: {},
          type: "function",
        };

        // Execute with a small maxTurns value
        const result = await operate(
          "test input",
          {
            tools: [mockTool],
            turns: 2, // Set a small number of max turns
          },
          { client: mockClient },
        );

        // Verify the function returns incomplete status
        expect(result.status).toBe(LlmResponseStatus.Incomplete);

        // Verify the create function was called maxTurns times
        expect(mockCreate).toHaveBeenCalledTimes(2); // Initial + 1 turn (2 total)

        // Verify that a warning was logged
        expect(log.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "Model requested function call but exceeded 2 turns",
          ),
        );

        expect(result.error).not.toBeUndefined();
        expect(result.error?.status).toBe(429);
        expect(result.error?.title).toBe("Too Many Requests");
        expect(result.error?.detail).toBe(
          "Model requested function call but exceeded 2 turns",
        );
      });

      it("Throws BadGatewayError when OpenAI client is not provided", async () => {
        // Execute without providing a client
        await expect(
          operate("test input", {}, { client: undefined as unknown as OpenAI }),
        ).rejects.toThrow(BadGatewayError);
      });
    });

    describe("Multi Turn", () => {
      it("Calls tool when tools are provided without explicitly setting turns", async () => {
        // Setup
        const mockResponse1 = {
          id: "resp_123",
          output: [
            {
              arguments: '{"query":"test"}',
              call_id: "call_1",
              name: "test_tool",
              type: LlmMessageType.FunctionCall,
              status: LlmResponseStatus.Completed,
            },
          ],
        };

        const mockResponse2 = {
          id: "resp_456",
          output: [
            {
              type: LlmMessageType.OutputText,
              text: "Tool call completed",
            },
          ],
        };

        // Create a mock for the OpenAI API call
        mockCreate
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        // Mock the tool call function
        const mockToolCall = vi
          .fn()
          .mockResolvedValue({ result: "test result" });

        // Execute
        const testInput = "Test input with tools";
        const tools = [
          {
            call: mockToolCall,
            description: "Test tool",
            name: "test_tool",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string" },
              },
            },
            type: "function",
          },
        ];

        const result = await operate(
          testInput,
          {
            tools,
            // Note: no turns parameter specified
          },
          { client: mockClient },
        );

        // Verify
        expect(result.responses).toEqual([mockResponse1, mockResponse2]);

        // Verify the create function was called twice
        expect(mockCreate).toHaveBeenCalledTimes(2);

        // Verify the tool was called with the correct arguments
        expect(mockToolCall).toHaveBeenCalledTimes(1);
        expect(mockToolCall).toHaveBeenCalledWith({ query: "test" });
      });

      it("Continues turns until it reaches the max turns limit", async () => {
        // Setup - Create mock responses for each turn
        const mockResponse1 = {
          id: "resp_123",
          output: [
            {
              type: "function_call",
              name: "test_tool",
              arguments: '{"turn":1}',
              call_id: "call_1",
            },
          ],
        };

        const mockResponse2 = {
          id: "resp_456",
          output: [
            {
              type: "function_call",
              name: "test_tool",
              arguments: '{"turn":2}',
              call_id: "call_2",
            },
          ],
        };

        const mockResponse3 = {
          id: "resp_789",
          output: [
            {
              type: "text",
              text: "All done after 3 turns",
            },
          ],
        };

        // Create a mock for the OpenAI API call that returns different responses for each turn
        mockCreate
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2)
          .mockResolvedValueOnce(mockResponse3);

        // Mock the tool call function
        const mockCall = vi
          .fn()
          .mockResolvedValueOnce({ result: "result from turn 1" })
          .mockResolvedValueOnce({ result: "result from turn 2" });

        // Execute
        const testInput = "Test input with multiple turns";
        const tools = [
          {
            name: "test_tool",
            description: "Test tool for multiple turns",
            parameters: {
              type: "object",
              properties: {
                turn: { type: "number" },
              },
            },
            type: "function",
            call: mockCall,
          },
        ];

        const result = await operate(
          testInput,
          {
            tools,
            turns: 3, // Set maximum turns to 3
          },
          { client: mockClient },
        );

        // Verify
        expect(result.responses).toEqual([
          mockResponse1,
          mockResponse2,
          mockResponse3,
        ]);

        // Verify the create function was called 3 times (once for each turn)
        expect(mockCreate).toHaveBeenCalledTimes(3);

        // First call should be with the initial input
        expect(mockCreate.mock.calls[0][0]).toEqual(
          expect.objectContaining({
            input: expect.any(Array),
            tools: expect.any(Array),
          }),
        );
        expect(mockCreate.mock.calls[0][0].input[0]).toEqual(
          expect.objectContaining({
            content: testInput,
            role: "user",
          }),
        );

        // Second call should include the first function call and its result
        expect(mockCreate.mock.calls[1][0].input).toContainEqual(
          expect.objectContaining({
            type: "function_call",
            name: "test_tool",
            arguments: '{"turn":1}',
            call_id: "call_1",
          }),
        );
        expect(mockCreate.mock.calls[1][0].input).toContainEqual(
          expect.objectContaining({
            type: "function_call_output",
            call_id: "call_1",
            output: JSON.stringify({ result: "result from turn 1" }),
          }),
        );

        // Third call should include the second function call and its result
        expect(mockCreate.mock.calls[2][0].input).toContainEqual(
          expect.objectContaining({
            type: "function_call",
            name: "test_tool",
            arguments: '{"turn":2}',
            call_id: "call_2",
          }),
        );
        expect(mockCreate.mock.calls[2][0].input).toContainEqual(
          expect.objectContaining({
            type: "function_call_output",
            call_id: "call_2",
            output: JSON.stringify({ result: "result from turn 2" }),
          }),
        );

        // Verify the tool was called twice (once for each function call)
        expect(mockCall).toHaveBeenCalledTimes(2);
        expect(mockCall).toHaveBeenNthCalledWith(1, { turn: 1 });
        expect(mockCall).toHaveBeenNthCalledWith(2, { turn: 2 });
      });

      it("Runs to default max turns (12) when no max is specified", async () => {
        // Setup - Create mock responses for each turn
        const mockResponses = [];

        // Create 12 mock responses, each with a function call
        for (let i = 1; i <= MAX_TURNS_DEFAULT_LIMIT; i++) {
          const mockResponse = {
            id: `resp_${i}`,
            output: [
              {
                type: "function_call",
                name: "test_tool",
                arguments: `{"turn":${i}}`,
                call_id: `call_${i}`,
              },
            ],
          };
          mockResponses.push(mockResponse);
          mockCreate.mockResolvedValueOnce(mockResponse);
        }

        // Mock the tool call function to return a result for each turn
        const mockCall = vi.fn();
        for (let i = 1; i <= MAX_TURNS_DEFAULT_LIMIT; i++) {
          mockCall.mockResolvedValueOnce({ result: `result from turn ${i}` });
        }

        // Execute
        const testInput = "Test input with default max turns";
        const tools = [
          {
            name: "test_tool",
            description: "Test tool for default max turns",
            parameters: {
              type: "object",
              properties: {
                turn: { type: "number" },
              },
            },
            type: "function",
            call: mockCall,
          },
        ];

        // Call operate with tools but no explicit turns parameter
        // This should use the default max turns (12)
        const result = await operate(
          testInput,
          {
            tools,
            turns: true, // Enable multi-turn with default limit
          },
          { client: mockClient },
        );

        // Verify
        expect(result.responses).toHaveLength(MAX_TURNS_DEFAULT_LIMIT);

        // Verify all responses are in the result
        for (let i = 0; i < MAX_TURNS_DEFAULT_LIMIT; i++) {
          expect(result.responses[i]).toEqual(mockResponses[i]);
        }

        // Verify the create function was called MAX_TURNS_DEFAULT_LIMIT times
        expect(mockCreate).toHaveBeenCalledTimes(MAX_TURNS_DEFAULT_LIMIT);

        // Verify the first call was with the initial input
        expect(mockCreate.mock.calls[0][0]).toEqual(
          expect.objectContaining({
            input: expect.any(Array),
            tools: expect.any(Array),
          }),
        );
        expect(mockCreate.mock.calls[0][0].input[0]).toEqual(
          expect.objectContaining({
            content: testInput,
            role: "user",
          }),
        );

        // Verify each subsequent call included the previous function call and result
        for (let i = 1; i < MAX_TURNS_DEFAULT_LIMIT; i++) {
          // Should contain the function call from the previous turn
          expect(mockCreate.mock.calls[i][0].input).toContainEqual(
            expect.objectContaining({
              type: "function_call",
              name: "test_tool",
              arguments: `{"turn":${i}}`,
              call_id: `call_${i}`,
            }),
          );

          // Should contain the function call result from the previous turn
          expect(mockCreate.mock.calls[i][0].input).toContainEqual(
            expect.objectContaining({
              type: "function_call_output",
              call_id: `call_${i}`,
              output: JSON.stringify({ result: `result from turn ${i}` }),
            }),
          );
        }

        // Verify the tool was called MAX_TURNS_DEFAULT_LIMIT times
        expect(mockCall).toHaveBeenCalledTimes(MAX_TURNS_DEFAULT_LIMIT);

        // Verify each call to the tool had the correct arguments
        for (let i = 1; i <= MAX_TURNS_DEFAULT_LIMIT; i++) {
          expect(mockCall).toHaveBeenNthCalledWith(i, { turn: i });
        }
      });

      it("Properly resolves Promise results from toolkit calls", async () => {
        // Setup - Create a mock response with a function call
        const mockResponse1 = {
          id: "resp_123",
          output: [
            {
              type: "function_call",
              name: "async_tool",
              arguments: '{"delay":100}',
              call_id: "call_1",
            },
          ],
        };

        const mockResponse2 = {
          id: "resp_456",
          output: [
            {
              type: "text",
              text: "Completed async operation",
            },
          ],
        };

        // Create a mock for the OpenAI API call
        mockCreate
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        // Create a Promise that will be returned by the tool
        const asyncResult = {
          status: "completed",
          data: "async operation result",
        };

        // Mock the tool call function to return a Promise
        const mockAsyncCall = vi.fn().mockImplementation(({ delay }) => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(asyncResult);
            }, delay);
          });
        });

        // Execute
        const testInput = "Test input with async tool";
        const tools = [
          {
            name: "async_tool",
            description: "Test tool that returns a Promise",
            parameters: {
              type: "object",
              properties: {
                delay: { type: "number" },
              },
            },
            type: "function",
            call: mockAsyncCall,
          },
        ];

        const result = await operate(
          testInput,
          {
            tools,
            turns: true, // Enable multi-turn
          },
          { client: mockClient },
        );

        // Verify
        expect(result.responses).toEqual([mockResponse1, mockResponse2]);

        // Verify the create function was called twice
        expect(mockCreate).toHaveBeenCalledTimes(2);

        // First call should be with the initial input
        expect(mockCreate.mock.calls[0][0]).toEqual(
          expect.objectContaining({
            input: expect.any(Array),
            tools: expect.any(Array),
          }),
        );
        expect(mockCreate.mock.calls[0][0].input[0]).toEqual(
          expect.objectContaining({
            content: testInput,
            role: "user",
          }),
        );

        // Second call should include the function call and its resolved Promise result
        expect(mockCreate.mock.calls[1][0].input).toContainEqual(
          expect.objectContaining({
            type: "function_call",
            name: "async_tool",
            arguments: '{"delay":100}',
            call_id: "call_1",
          }),
        );
        expect(mockCreate.mock.calls[1][0].input).toContainEqual(
          expect.objectContaining({
            type: "function_call_output",
            call_id: "call_1",
            output: JSON.stringify(asyncResult),
          }),
        );

        // Verify the async tool was called with the correct arguments
        expect(mockAsyncCall).toHaveBeenCalledTimes(1);
        expect(mockAsyncCall).toHaveBeenCalledWith({ delay: 100 });
      });
    });

    describe("Provider Options", () => {
      it("Passes providerOptions to the OpenAI API", async () => {
        // Setup
        const testInput = "Test input";
        const providerOptions = {
          temperature: 0.5,
          top_p: 0.8,
          frequency_penalty: 0.2,
        };

        // Execute
        await operate(
          testInput,
          {
            providerOptions,
          },
          { client: mockClient },
        );

        // Verify
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            model: expect.any(String),
            input: expect.any(Array),
            temperature: 0.5,
            top_p: 0.8,
            frequency_penalty: 0.2,
          }),
        );
      });
    });

    describe("Response Object", () => {
      it("Responds with the LlmOperateResponse shape", async () => {
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
        expect(result.output).toBeArray();
        expect(result.output).toBeArrayOfSize(1);
        expect(result.output[0]).toBeObject();
        expect(result.output[0]).toHaveProperty("type");
        expect(result.output[0].type).toBe(LlmMessageType.Message);
        expect(result.output[0]).toHaveProperty("content");
        result.output[0] = result.output[0] as LlmOutputMessage;
        expect(result.output[0].content).toBeArray();
        expect(result.output[0].content).toBeArrayOfSize(1);
        expect(result.output[0].content[0]).toBeObject();
        expect(result.output[0].content[0]).toHaveProperty("type");
        expect(result.output[0].content[0].type).toBe(
          LlmMessageType.OutputText,
        );
        expect(result.output[0].content[0]).toHaveProperty("text");
        result.output[0].content[0] = result.output[0]
          .content[0] as LlmOutputContentText;
        expect(result.output[0].content[0].text).toBeString();
        expect(result.output[0].content[0].text).toBe("Hello, world!");
        expect(result.content).toBeString();
        expect(result.content).toBe("Hello, world!");
      });

      describe("Return Status Scenarios", () => {
        it("Returns Completed status when model completes response", async () => {
          // Setup
          mockCreate.mockResolvedValueOnce({
            id: "resp_123",
            output: [
              {
                type: LlmMessageType.Message,
                content: [
                  {
                    type: LlmMessageType.OutputText,
                    text: "Complete response",
                  },
                ],
                role: LlmMessageRole.Assistant,
              },
            ],
            status: LlmResponseStatus.Completed,
          });

          // Execute
          const result = await operate(
            "Test input",
            {},
            { client: mockClient },
          );

          // Verify
          expect(result.status).toBe(LlmResponseStatus.Completed);
          expect(mockCreate).toHaveBeenCalledTimes(1);
        });

        it("Returns Incomplete status when max turns are reached with function calls", async () => {
          // Setup - Create a mock toolkit with a test function
          const mockToolkit = {
            call: vi.fn().mockResolvedValue({ result: "function result" }),
            tools: [
              {
                name: "test_function",
                description: "A test function",
                parameters: {
                  type: "object",
                  properties: {
                    param: { type: "string" },
                  },
                  required: ["param"],
                },
              },
            ],
          };

          // Mock responses that always return a function call
          for (let i = 0; i < MAX_TURNS_DEFAULT_LIMIT; i++) {
            mockCreate.mockResolvedValueOnce({
              id: `resp_${i}`,
              output: [
                {
                  type: LlmMessageType.FunctionCall,
                  name: "test_function",
                  arguments: JSON.stringify({ param: "test" }),
                  call_id: `call_${i}`,
                  id: `id_${i}`,
                },
              ],
            });
          }

          // Execute with turns enabled and tools
          const result = await operate(
            "Test input",
            {
              turns: true,
              tools: mockToolkit.tools as unknown as LlmTool[],
            },
            {
              client: mockClient,
            },
          );

          // Verify
          expect(result.status).toBe(LlmResponseStatus.Incomplete);
          // Should be called the maximum number of turns
          expect(mockCreate).toHaveBeenCalledTimes(MAX_TURNS_DEFAULT_LIMIT);
        });

        it("Returns InProgress status during multi-turn function calling", async () => {
          // Setup - Create a mock toolkit with a test function
          const mockToolkit = {
            call: vi.fn().mockResolvedValue({ result: "function result" }),
            tools: [
              {
                name: "test_function",
                description: "A test function",
                parameters: {
                  type: "object",
                  properties: {
                    param: { type: "string" },
                  },
                  required: ["param"],
                },
              },
            ],
          };

          // First response has a function call
          mockCreate.mockResolvedValueOnce({
            id: "resp_1",
            output: [
              {
                type: LlmMessageType.FunctionCall,
                name: "test_function",
                arguments: JSON.stringify({ param: "test" }),
                call_id: "call_1",
                id: "id_1",
                status: LlmResponseStatus.InProgress,
              },
            ],
          });

          // Second response completes the conversation
          mockCreate.mockResolvedValueOnce({
            id: "resp_2",
            output: [
              {
                type: LlmMessageType.Message,
                content: [
                  { type: LlmMessageType.OutputText, text: "Final response" },
                ],
                role: LlmMessageRole.Assistant,
              },
            ],
            status: LlmResponseStatus.Completed,
          });

          // Execute with turns enabled and tools
          const result = await operate(
            "Test input",
            {
              turns: true,
              tools: mockToolkit.tools as unknown as LlmTool[],
            },
            {
              client: mockClient,
            },
          );

          // Verify
          // Final status should be Completed
          expect(result.status).toBe(LlmResponseStatus.Completed);
          // Should be called twice (once for function call, once for completion)
          expect(mockCreate).toHaveBeenCalledTimes(2);
          // The first response should have been InProgress
          // @ts-expect-error // TODO: not clear why this type isn't correct
          expect(result.responses[0].output[0].status).toBe(
            LlmResponseStatus.InProgress,
          );
        });
      });
    });

    describe("Structured Output", () => {
      it("Structured output uses responses API", async () => {
        // Setup
        const mockResponse = {
          salutation: "Hello",
          name: "World",
        };
        mockCreate.mockResolvedValueOnce(mockResponse);

        const GreetingFormat = {
          type: "object",
          properties: {
            salutation: { type: "string" },
            name: { type: "string" },
          },
          required: ["salutation", "name"],
        };

        // Execute
        const result = await operate(
          "Hello, World",
          {
            format: {
              type: "json_schema",
              schema: GreetingFormat,
            },
          },
          { client: mockClient },
        );

        // Verify
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.any(Array),
            model: expect.any(String),
            text: expect.objectContaining({
              format: expect.objectContaining({
                schema: expect.any(Object),
                type: "json_schema",
              }),
            }),
          }),
        );
        expect(result.responses).toEqual([mockResponse]);
      });

      it("Handles NaturalSchema response format", async () => {
        // Setup
        const mockResponse = {
          salutation: "Hello",
          name: "World",
        };
        mockCreate.mockResolvedValueOnce(mockResponse);

        const GreetingFormat = {
          salutation: String,
          name: String,
        };

        // Execute
        const result = await operate(
          "Hello, World",
          {
            format: GreetingFormat,
          },
          { client: mockClient },
        );

        // Verify
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.any(Array),
            model: expect.any(String),
            text: expect.objectContaining({
              format: expect.objectContaining({
                schema: expect.any(Object),
                type: "json_schema",
              }),
            }),
          }),
        );
        expect(result.responses).toEqual([mockResponse]);
      });

      it("Accepts json_schema output format", async () => {
        // Setup
        const mockResponse = {
          salutation: "Hello",
          name: "World",
        };
        mockCreate.mockResolvedValueOnce(mockResponse);

        const schema = {
          type: "object",
          properties: {
            salutation: { type: "string" },
            name: { type: "string" },
          },
          required: ["salutation", "name"],
        };

        // Execute
        const result = await operate(
          "Hello, World",
          {
            format: {
              type: "json_schema",
              schema,
            },
          },
          { client: mockClient },
        );

        // Verify
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.any(Array),
            model: expect.any(String),
            text: expect.objectContaining({
              format: expect.objectContaining({
                schema,
                type: "json_schema",
              }),
            }),
          }),
        );
        expect(result.responses).toEqual([mockResponse]);
      });
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
        expect(mockCreate).toHaveBeenCalledTimes(1);
        expect(mockCreate).toHaveBeenCalledWith(
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
        expect(mockCreate).toHaveBeenCalledTimes(1);
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            model: expect.any(String),
            input: expect.any(Array),
          }),
        );
        // Verify user is not passed
        expect(mockCreate).not.toHaveBeenCalledWith(
          expect.objectContaining({
            user: "test-user",
          }),
        );
      });
    });
  });
});
