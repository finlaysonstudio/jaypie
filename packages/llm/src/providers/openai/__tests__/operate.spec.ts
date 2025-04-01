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
  LlmOperateResponse,
  LlmResponseStatus,
} from "../../../types/LlmProvider.interface.js";
import { log } from "../../../util";
import { restoreLog, spyLog } from "@jaypie/testkit";

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

    describe("Multi Turn", () => {
      it("Calls tool when tools are provided without explicitly setting turns", async () => {
        // Setup
        const mockResponse1 = {
          id: "resp_123",
          output: [
            {
              type: "function_call",
              name: "test_tool",
              arguments: '{"query":"test"}',
              call_id: "call_1",
            },
          ],
        };

        const mockResponse2 = {
          id: "resp_456",
          output: [
            {
              type: "text",
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
            name: "test_tool",
            description: "Test tool",
            parameters: {
              type: "object",
              properties: {
                query: { type: "string" },
              },
            },
            type: "function",
            call: mockToolCall,
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
        expect(result).toEqual([mockResponse1, mockResponse2]);

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
        expect(result).toEqual([mockResponse1, mockResponse2, mockResponse3]);

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
        // Import the constant for default max turns
        const { MAX_TURNS_DEFAULT_LIMIT } = await import(
          "../../../util/maxTurnsFromOptions.js"
        );

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
        expect(result).toHaveLength(MAX_TURNS_DEFAULT_LIMIT);

        // Verify all responses are in the result
        for (let i = 0; i < MAX_TURNS_DEFAULT_LIMIT; i++) {
          expect(result[i]).toEqual(mockResponses[i]);
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
        expect(result).toEqual([mockResponse1, mockResponse2]);

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
        expect(result).toEqual([mockResponse]);
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
        expect(result).toEqual([mockResponse]);
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
        expect(result).toEqual([mockResponse]);
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
