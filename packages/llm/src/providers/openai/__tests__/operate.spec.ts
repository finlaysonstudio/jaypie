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
  LlmOutputMessage,
  LlmResponseStatus,
  LlmInputMessage,
  LlmHistory,
  LlmToolResult,
} from "../../../types/LlmProvider.interface.js";
import { log } from "../../../util";
import { restoreLog, spyLog } from "@jaypie/testkit";
import { LlmTool } from "../../../types/LlmTool.interface";
import { Toolkit } from "../../../tools/Toolkit.class";

const mockTool = {
  name: "mock_tool",
  description: "Mock tool",
  parameters: {
    type: "object",
    properties: {
      latitude: { type: "number" },
      longitude: { type: "number" },
    },
  },
  type: "function",
  call: vi.fn().mockResolvedValue({ result: "mock_tool_result" }),
};

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
    describe("Token Counting", () => {
      it("Supports multiple usage items from different providers", async () => {
        // Setup
        const mockResponse = {
          id: "resp_123",
          output: [
            {
              type: LlmMessageType.Message,
              content: [{ type: LlmMessageType.OutputText, text: "Response" }],
              role: LlmMessageRole.Assistant,
            },
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 20,
            total_tokens: 30,
          },
        };

        mockCreate.mockResolvedValueOnce(mockResponse);

        // Execute with standard options
        const result = await operate("Test input", {}, { client: mockClient });

        // Add a second usage item manually (simulating a different provider)
        result.usage.push({
          input: 15,
          output: 25,
          total: 40,
          reasoning: 0,
          provider: "another-provider",
          model: "another-model",
        });

        // Verify that we have multiple usage items
        expect(result.usage).toBeArrayOfSize(2);

        // Verify the first item (from the original provider)
        expect(result.usage[0].provider).toBeDefined();
        expect(result.usage[0].input).toBe(10);
        expect(result.usage[0].output).toBe(20);
        expect(result.usage[0].total).toBe(30);

        // Verify the second item (our manually added one)
        expect(result.usage[1].provider).toBe("another-provider");
        expect(result.usage[1].model).toBe("another-model");
        expect(result.usage[1].input).toBe(15);
        expect(result.usage[1].output).toBe(25);
        expect(result.usage[1].total).toBe(40);
      });
      it("Tracks input tokens for each turn", async () => {
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
          usage: {
            input_tokens: 10,
            input_tokens_details: {
              cached_tokens: 0,
            },
            output_tokens: 5,
            output_tokens_details: {
              reasoning_tokens: 0,
            },
            total_tokens: 15,
          },
        };

        const mockResponse2 = {
          id: "resp_456",
          output: [
            {
              type: LlmMessageType.Message,
              content: [
                { type: LlmMessageType.OutputText, text: "Final response" },
              ],
              role: LlmMessageRole.Assistant,
            },
          ],
          usage: {
            input_tokens: 20,
            input_tokens_details: {
              cached_tokens: 0,
            },
            output_tokens: 10,
            output_tokens_details: {
              reasoning_tokens: 0,
            },
            total_tokens: 30,
          },
        };

        // Mock the API calls
        mockCreate
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        // Mock a tool that returns a simple result
        const mockTool = {
          name: "test_tool",
          description: "Test tool",
          parameters: {
            type: "object",
            properties: {
              turn: { type: "number" },
            },
          },
          type: "function",
          call: vi.fn().mockResolvedValue({ result: "test result" }),
        };

        // Execute with turns enabled and tools
        const result = await operate(
          "Test input",
          {
            tools: [mockTool],
            turns: true,
          },
          { client: mockClient },
        );

        // Verify a separate usage item is created for each response
        expect(result.usage.length).toBe(2);

        // Verify first response usage
        expect(result.usage[0].input).toBe(10);
        expect(result.usage[0].output).toBe(5);
        expect(result.usage[0].total).toBe(15);
        expect(result.usage[0].provider).toBeDefined();
        expect(result.usage[0].model).toBeDefined();

        // Verify second response usage
        expect(result.usage[1].input).toBe(20);
        expect(result.usage[1].output).toBe(10);
        expect(result.usage[1].total).toBe(30);
      });
      it("Tracks output tokens for each turn", async () => {
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
          usage: {
            input_tokens: 10,
            input_tokens_details: {
              cached_tokens: 0,
            },
            output_tokens: 5,
            output_tokens_details: {
              reasoning_tokens: 0,
            },
            total_tokens: 15,
          },
        };

        const mockResponse2 = {
          id: "resp_456",
          output: [
            {
              type: LlmMessageType.Message,
              content: [
                { type: LlmMessageType.OutputText, text: "Final response" },
              ],
              role: LlmMessageRole.Assistant,
            },
          ],
          usage: {
            input_tokens: 20,
            input_tokens_details: {
              cached_tokens: 0,
            },
            output_tokens: 10,
            output_tokens_details: {
              reasoning_tokens: 0,
            },
            total_tokens: 30,
          },
        };

        // Mock the API calls
        mockCreate
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        // Mock a tool that returns a simple result
        const mockTool = {
          name: "test_tool",
          description: "Test tool",
          parameters: {
            type: "object",
            properties: {
              turn: { type: "number" },
            },
          },
          type: "function",
          call: vi.fn().mockResolvedValue({ result: "test result" }),
        };

        // Execute with turns enabled and tools
        const result = await operate(
          "Test input",
          {
            tools: [mockTool],
            turns: true,
          },
          { client: mockClient },
        );

        // Verify a separate usage item is created for each response
        expect(result.usage.length).toBe(2);

        // Verify first response usage
        expect(result.usage[0].input).toBe(10);
        expect(result.usage[0].output).toBe(5);
        expect(result.usage[0].total).toBe(15);

        // Verify second response usage
        expect(result.usage[1].input).toBe(20);
        expect(result.usage[1].output).toBe(10);
        expect(result.usage[1].total).toBe(30);
      });
      it("Tracks total tokens for each turn", async () => {
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
          usage: {
            input_tokens: 10,
            input_tokens_details: {
              cached_tokens: 0,
            },
            output_tokens: 5,
            output_tokens_details: {
              reasoning_tokens: 2,
            },
            total_tokens: 15,
          },
        };

        const mockResponse2 = {
          id: "resp_456",
          output: [
            {
              type: LlmMessageType.Message,
              content: [
                { type: LlmMessageType.OutputText, text: "Final response" },
              ],
              role: LlmMessageRole.Assistant,
            },
          ],
          usage: {
            input_tokens: 20,
            input_tokens_details: {
              cached_tokens: 0,
            },
            output_tokens: 10,
            output_tokens_details: {
              reasoning_tokens: 3,
            },
            total_tokens: 30,
          },
        };

        // Mock the API calls
        mockCreate
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        // Mock a tool that returns a simple result
        const mockTool = {
          name: "test_tool",
          description: "Test tool",
          parameters: {
            type: "object",
            properties: {
              turn: { type: "number" },
            },
          },
          type: "function",
          call: vi.fn().mockResolvedValue({ result: "test result" }),
        };

        // Execute with turns enabled and tools
        const result = await operate(
          "Test input",
          {
            tools: [mockTool],
            turns: true,
          },
          { client: mockClient },
        );

        // Verify a separate usage item is created for each response
        expect(result.usage.length).toBe(2);

        // Verify first response usage
        expect(result.usage[0].input).toBe(10);
        expect(result.usage[0].output).toBe(5);
        expect(result.usage[0].total).toBe(15);

        // Verify second response usage
        expect(result.usage[1].input).toBe(20);
        expect(result.usage[1].output).toBe(10);
        expect(result.usage[1].total).toBe(30);
      });
      it("Tracks reasoning tokens for each turn when provided", async () => {
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
          usage: {
            input_tokens: 10,
            input_tokens_details: {
              cached_tokens: 0,
            },
            output_tokens: 5,
            output_tokens_details: {
              reasoning_tokens: 2,
            },
            total_tokens: 15,
          },
        };

        const mockResponse2 = {
          id: "resp_456",
          output: [
            {
              type: LlmMessageType.Message,
              content: [
                { type: LlmMessageType.OutputText, text: "Final response" },
              ],
              role: LlmMessageRole.Assistant,
            },
          ],
          usage: {
            input_tokens: 20,
            input_tokens_details: {
              cached_tokens: 0,
            },
            output_tokens: 10,
            output_tokens_details: {
              reasoning_tokens: 3,
            },
            total_tokens: 30,
          },
        };

        // Mock the API calls
        mockCreate
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        // Mock a tool that returns a simple result
        const mockTool = {
          name: "test_tool",
          description: "Test tool",
          parameters: {
            type: "object",
            properties: {
              turn: { type: "number" },
            },
          },
          type: "function",
          call: vi.fn().mockResolvedValue({ result: "test result" }),
        };

        // Execute with turns enabled and tools
        const result = await operate(
          "Test input",
          {
            tools: [mockTool],
            turns: true,
          },
          { client: mockClient },
        );

        // Verify a separate usage item is created for each response
        expect(result.usage.length).toBe(2);

        // Verify first response usage with reasoning tokens
        expect(result.usage[0].input).toBe(10);
        expect(result.usage[0].output).toBe(5);
        expect(result.usage[0].reasoning).toBe(2);
        expect(result.usage[0].total).toBe(15);

        // Verify second response usage with reasoning tokens
        expect(result.usage[1].input).toBe(20);
        expect(result.usage[1].output).toBe(10);
        expect(result.usage[1].reasoning).toBe(3);
        expect(result.usage[1].total).toBe(30);
      });
      it("Returns zero for missing token counts", async () => {
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
          // No usage information in first response
        };

        const mockResponse2 = {
          id: "resp_456",
          output: [
            {
              type: LlmMessageType.Message,
              content: [
                { type: LlmMessageType.OutputText, text: "Final response" },
              ],
              role: LlmMessageRole.Assistant,
            },
          ],
          usage: {
            // Missing some token counts
            input_tokens: 20,
            input_tokens_details: {
              cached_tokens: 0,
            },
            // No output_tokens
            output_tokens_details: {
              // No reasoning_tokens
            },
            // No total_tokens
          },
        };

        // Mock the API calls
        mockCreate
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        // Mock a tool that returns a simple result
        const mockTool = {
          name: "test_tool",
          description: "Test tool",
          parameters: {
            type: "object",
            properties: {
              turn: { type: "number" },
            },
          },
          type: "function",
          call: vi.fn().mockResolvedValue({ result: "test result" }),
        };

        // Execute with turns enabled and tools
        const result = await operate(
          "Test input",
          {
            tools: [mockTool],
            turns: true,
          },
          { client: mockClient },
        );

        // Verify a separate usage item is created only for responses with usage info
        expect(result.usage.length).toBe(1);

        // Verify second response usage with missing token counts
        expect(result.usage[0].input).toBe(20); // Only from second response
        expect(result.usage[0].output).toBe(0); // Missing in the response
        expect(result.usage[0].total).toBe(0); // Missing in the response
        expect(result.usage[0].reasoning).toBe(0); // Missing in the response
        expect(result.usage[0].provider).toBeDefined();
        expect(result.usage[0].model).toBeDefined();
      });
    });

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
          } catch {
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

    describe("Chat History", () => {
      it("Passes chat history to the OpenAI API", async () => {
        // Setup
        const initialHistory: LlmHistory = [
          {
            type: LlmMessageType.Message,
            role: LlmMessageRole.User,
            content: "Previous message",
          } as LlmInputMessage,
          {
            type: LlmMessageType.Message,
            role: LlmMessageRole.Assistant,
            content: [
              {
                type: LlmMessageType.OutputText,
                text: "Previous response",
              },
            ],
            id: "prev_resp",
            status: LlmResponseStatus.Completed,
          } as LlmOutputMessage,
        ];

        const testInput = "New message";

        mockCreate.mockResolvedValueOnce({
          id: "resp_123",
          output: [
            {
              type: LlmMessageType.Message,
              content: [
                { type: LlmMessageType.OutputText, text: "New response" },
              ],
              role: LlmMessageRole.Assistant,
              id: "resp_123",
              status: LlmResponseStatus.Completed,
            },
          ],
        });

        // Execute
        const result = await operate(
          testInput,
          {
            history: initialHistory,
          },
          { client: mockClient },
        );

        // Verify the history was passed to OpenAI
        const call = mockCreate.mock.calls[0][0];
        expect(call.input).toBeArray();
        expect(call.input).toBeArrayOfSize(3);
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            model: expect.any(String),
            input: expect.arrayContaining([
              expect.objectContaining({
                content: "Previous message",
                role: "user",
                type: "message",
              }),
              expect.any(Object),
              expect.any(Object),
            ]),
          }),
        );

        // Verify the history is included in the returned history
        expect(result.history).toBeArray();
        expect(result.history).toBeArrayOfSize(4); // 2 initial + new message + new response
        expect(result.history[0]).toEqual(initialHistory[0]); // First history message
        expect(result.history[1]).toEqual(initialHistory[1]); // First history response
        expect(result.history[2]).toEqual({
          type: LlmMessageType.Message,
          role: LlmMessageRole.User,
          content: testInput,
        } as LlmInputMessage); // New message
        expect(result.history[3]).toEqual({
          type: LlmMessageType.Message,
          content: [{ type: LlmMessageType.OutputText, text: "New response" }],
          role: LlmMessageRole.Assistant,
          id: "resp_123",
          status: LlmResponseStatus.Completed,
        } as LlmOutputMessage); // New response
      });
      it.todo("Instances track history by default");
    });

    describe("History", () => {
      it("Stores initial user message in history", async () => {
        // Setup
        const testInput = "Test input message";
        mockCreate.mockResolvedValueOnce({
          id: "resp_123",
          output: [
            {
              type: LlmMessageType.Message,
              content: [{ type: LlmMessageType.OutputText, text: "Response" }],
              role: LlmMessageRole.Assistant,
            },
          ],
        });

        // Execute
        const result = await operate(testInput, {}, { client: mockClient });

        // Verify
        expect(result.history).toBeArray();
        expect(result.history).toBeArrayOfSize(2); // User message + assistant response
        expect(result.history[0]).toEqual({
          content: testInput,
          role: LlmMessageRole.User,
          type: LlmMessageType.Message,
        });
        expect(result.history[1]).toEqual({
          type: LlmMessageType.Message,
          content: [{ type: LlmMessageType.OutputText, text: "Response" }],
          role: LlmMessageRole.Assistant,
        });
      });
      it("Stores function calls and results in history", async () => {
        // Setup
        const testInput = "Test input message";
        const mockResponse1 = {
          id: "resp_123",
          output: [
            {
              type: LlmMessageType.FunctionCall,
              name: "test_tool",
              arguments: '{"param":"test"}',
              call_id: "call_1",
            },
          ],
        };

        const mockResponse2 = {
          id: "resp_456",
          output: [
            {
              type: LlmMessageType.Message,
              content: [
                { type: LlmMessageType.OutputText, text: "Final response" },
              ],
              role: LlmMessageRole.Assistant,
            },
          ],
        };

        // Mock the API calls
        mockCreate
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        // Mock a tool that returns a simple result
        const mockTool: LlmTool = {
          name: "test_tool",
          description: "Test tool",
          parameters: {
            type: "object",
            properties: {
              param: { type: "string" },
            },
          },
          type: "function",
          call: vi.fn().mockResolvedValue({ result: "test result" }),
        };

        // Execute
        const result = await operate(
          testInput,
          {
            tools: [mockTool],
            turns: true,
          },
          { client: mockClient },
        );

        // Verify
        expect(result.history).toBeArray();
        expect(result.history).toBeArrayOfSize(4); // Initial message + function call + function result + final response

        // Initial message
        expect(result.history[0]).toEqual({
          content: testInput,
          role: LlmMessageRole.User,
          type: LlmMessageType.Message,
        });

        // Function call
        expect(result.history[1]).toEqual({
          type: LlmMessageType.FunctionCall,
          name: "test_tool",
          arguments: '{"param":"test"}',
          call_id: "call_1",
        });

        // Function result
        expect(result.history[2]).toEqual({
          type: LlmMessageType.FunctionCallOutput,
          call_id: "call_1",
          output: JSON.stringify({ result: "test result" }),
        });

        // Final response
        expect(result.history[3]).toEqual({
          type: LlmMessageType.Message,
          content: [
            { type: LlmMessageType.OutputText, text: "Final response" },
          ],
          role: LlmMessageRole.Assistant,
        });
      });
      it("Stores assistant responses in history", async () => {
        // Setup
        const testInput = "Test input message";
        const mockResponse = {
          id: "resp_123",
          output: [
            {
              type: LlmMessageType.Message,
              content: [
                { type: LlmMessageType.OutputText, text: "First response" },
                { type: LlmMessageType.OutputText, text: "Second response" },
              ],
              role: LlmMessageRole.Assistant,
            },
          ],
        };

        // Mock the API call
        mockCreate.mockResolvedValueOnce(mockResponse);

        // Execute
        const result = await operate(testInput, {}, { client: mockClient });

        // Verify
        expect(result.history).toBeArray();
        expect(result.history).toBeArrayOfSize(2); // User message + assistant response

        // Initial message
        expect(result.history[0]).toEqual({
          content: testInput,
          role: LlmMessageRole.User,
          type: LlmMessageType.Message,
        });

        // Assistant response with multiple content items
        expect(result.history[1]).toEqual({
          type: LlmMessageType.Message,
          content: [
            { type: LlmMessageType.OutputText, text: "First response" },
            { type: LlmMessageType.OutputText, text: "Second response" },
          ],
          role: LlmMessageRole.Assistant,
        });
      });
      it("Maintains history across multiple turns", async () => {
        // Setup
        const testInput = "Test input message";
        const mockResponse1 = {
          id: "resp_123",
          output: [
            {
              type: LlmMessageType.FunctionCall,
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
              type: LlmMessageType.FunctionCall,
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
              type: LlmMessageType.Message,
              content: [
                { type: LlmMessageType.OutputText, text: "Final response" },
              ],
              role: LlmMessageRole.Assistant,
            },
          ],
        };

        // Mock the API calls
        mockCreate
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2)
          .mockResolvedValueOnce(mockResponse3);

        // Mock a tool that returns a simple result
        const mockTool: LlmTool = {
          name: "test_tool",
          description: "Test tool",
          parameters: {
            type: "object",
            properties: {
              turn: { type: "number" },
            },
          },
          type: "function",
          call: vi
            .fn()
            .mockResolvedValueOnce({ result: "result from turn 1" })
            .mockResolvedValueOnce({ result: "result from turn 2" }),
        };

        // Execute
        const result = await operate(
          testInput,
          {
            tools: [mockTool],
            turns: true,
          },
          { client: mockClient },
        );

        // Verify
        expect(result.history).toBeArray();
        expect(result.history).toBeArrayOfSize(6); // Initial + 2 function calls + 2 results + final response

        // Initial message
        expect(result.history[0]).toEqual({
          content: testInput,
          role: LlmMessageRole.User,
          type: LlmMessageType.Message,
        });

        // First function call
        expect(result.history[1]).toEqual({
          type: LlmMessageType.FunctionCall,
          name: "test_tool",
          arguments: '{"turn":1}',
          call_id: "call_1",
        });

        // First function result
        expect(result.history[2]).toEqual({
          type: LlmMessageType.FunctionCallOutput,
          call_id: "call_1",
          output: JSON.stringify({ result: "result from turn 1" }),
        });

        // Second function call
        expect(result.history[3]).toEqual({
          type: LlmMessageType.FunctionCall,
          name: "test_tool",
          arguments: '{"turn":2}',
          call_id: "call_2",
        });

        // Second function result
        expect(result.history[4]).toEqual({
          type: LlmMessageType.FunctionCallOutput,
          call_id: "call_2",
          output: JSON.stringify({ result: "result from turn 2" }),
        });

        // Final response
        expect(result.history[5]).toEqual({
          type: LlmMessageType.Message,
          content: [
            { type: LlmMessageType.OutputText, text: "Final response" },
          ],
          role: LlmMessageRole.Assistant,
        });
      });
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

      describe("System Message", () => {
        it("includes system message when provided", async () => {
          // Setup
          const systemMessage = "You are a test assistant";

          // Execute
          await operate(
            "test message",
            {
              system: systemMessage,
            },
            { client: mockClient },
          );

          // Verify
          expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
              input: expect.arrayContaining([
                expect.objectContaining({
                  content: systemMessage,
                  role: LlmMessageRole.System,
                  type: LlmMessageType.Message,
                }),
              ]),
              model: expect.any(String),
            }),
          );
        });

        it("applies placeholders to system message when data is provided", async () => {
          // Setup
          const systemMessage = "You are a {{role}}";
          const data = { role: "test assistant" };

          // Execute
          await operate(
            "test message",
            {
              system: systemMessage,
              data,
            },
            { client: mockClient },
          );

          // Verify
          expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
              input: expect.arrayContaining([
                expect.objectContaining({
                  content: "You are a test assistant",
                  role: LlmMessageRole.System,
                  type: LlmMessageType.Message,
                }),
              ]),
              model: expect.any(String),
            }),
          );
        });

        it("respects placeholders.system option", async () => {
          // Setup
          const systemMessage = "You are a {{role}}";
          const data = { role: "test assistant" };

          // Execute
          await operate(
            "test message",
            {
              system: systemMessage,
              data,
              placeholders: { system: false },
            },
            { client: mockClient },
          );

          // Verify
          expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
              input: expect.arrayContaining([
                expect.objectContaining({
                  content: "You are a {{role}}",
                  role: LlmMessageRole.System,
                  type: LlmMessageType.Message,
                }),
              ]),
              model: expect.any(String),
            }),
          );
        });

        it("deduplicates identical system message from history", async () => {
          // Setup
          const systemMessage = "You are a test assistant";
          const initialHistory: LlmHistory = [
            {
              content: systemMessage,
              role: LlmMessageRole.System,
              type: LlmMessageType.Message,
            },
            {
              content: "Previous message",
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
            },
          ];

          // Execute
          await operate(
            "test message",
            {
              system: systemMessage,
              history: initialHistory,
            },
            { client: mockClient },
          );

          // Verify
          expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
              input: expect.arrayContaining([
                expect.objectContaining({
                  content: systemMessage,
                  role: LlmMessageRole.System,
                  type: LlmMessageType.Message,
                }),
                expect.objectContaining({
                  content: "Previous message",
                  role: LlmMessageRole.User,
                  type: LlmMessageType.Message,
                }),
              ]),
              model: expect.any(String),
            }),
          );

          // Verify the system message appears only once
          const call = mockCreate.mock.calls[0][0];
          const systemMessages = call.input.filter(
            (msg: LlmInputMessage) =>
              msg.type === LlmMessageType.Message &&
              msg.role === LlmMessageRole.System &&
              msg.content === systemMessage,
          );
          expect(systemMessages).toHaveLength(1);
        });

        it("prepends different system message before history system message", async () => {
          // Setup
          const oldSystemMessage = "You are a test assistant";
          const newSystemMessage = "You are a different assistant";
          const initialHistory: LlmHistory = [
            {
              content: oldSystemMessage,
              role: LlmMessageRole.System,
              type: LlmMessageType.Message,
            },
            {
              content: "Previous message",
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
            },
          ];

          // Execute
          await operate(
            "test message",
            {
              system: newSystemMessage,
              history: initialHistory,
            },
            { client: mockClient },
          );

          // Verify
          const call = mockCreate.mock.calls[0][0];
          expect(call.input[0]).toEqual({
            content: newSystemMessage,
            role: LlmMessageRole.System,
            type: LlmMessageType.Message,
          });
          expect(call.input[1]).toEqual({
            content: "Previous message",
            role: LlmMessageRole.User,
            type: LlmMessageType.Message,
          });
          expect(call.input[2]).toEqual({
            content: "test message",
            role: LlmMessageRole.User,
            type: LlmMessageType.Message,
          });
        });
      });
    });

    describe("Developer Warning", () => {
      it("Logs warning when developer message is provided", async () => {
        // Setup
        const developerMessage = "You are a test assistant";

        // Execute
        await operate(
          "test message",
          {
            // @ts-expect-error Testing invalid option
            developer: developerMessage,
          },
          { client: mockClient },
        );

        // Verify warning was logged
        expect(log.warn).toHaveBeenCalledWith(
          "Developer message provided but not supported. Using as system message.",
        );
      });

      it("Treats developer message like system message", async () => {
        // Setup
        const developerMessage = "You are a test assistant";

        // Execute
        await operate(
          "test message",
          {
            // @ts-expect-error Testing invalid option
            developer: developerMessage,
          },
          { client: mockClient },
        );

        // Verify developer message was passed as system message
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            system: developerMessage,
          }),
        );
      });

      it("Does not add developer to message type", async () => {
        // Setup
        const developerMessage = "You are a test assistant";

        // Execute
        await operate(
          "test message",
          {
            // @ts-expect-error Testing invalid option
            developer: developerMessage,
          },
          { client: mockClient },
        );

        // Verify developer is not added as a message type
        expect(mockCreate).not.toHaveBeenCalledWith(
          expect.objectContaining({
            developer: expect.any(String),
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

      it("Parses JSON content when format is provided and response is valid JSON", async () => {
        // Setup
        const jsonContent = '{"answer": 42, "question": "meaning of life"}';
        const expectedParsedContent = {
          answer: 42,
          question: "meaning of life",
        };

        mockCreate.mockResolvedValueOnce({
          id: "resp_123",
          output: [
            {
              type: LlmMessageType.Message,
              content: [{ type: LlmMessageType.OutputText, text: jsonContent }],
              role: LlmMessageRole.Assistant,
            },
          ],
        });

        // Execute
        const result = await operate(
          "What is the meaning of life?",
          {
            format: {
              type: "json_schema",
              schema: {
                type: "object",
                properties: {
                  answer: { type: "number" },
                  question: { type: "string" },
                },
              },
            },
          },
          { client: mockClient },
        );

        // Verify
        expect(result.content).toEqual(expectedParsedContent);
        expect(typeof result.content).toBe("object");
      });

      it("Keeps original content when format is provided but response is not valid JSON", async () => {
        // Setup
        const textContent = "The answer is 42";

        mockCreate.mockResolvedValueOnce({
          id: "resp_123",
          output: [
            {
              type: LlmMessageType.Message,
              content: [{ type: LlmMessageType.OutputText, text: textContent }],
              role: LlmMessageRole.Assistant,
            },
          ],
        });

        // Execute
        const result = await operate(
          "What is the meaning of life?",
          {
            format: {
              type: "json_schema",
              schema: {
                type: "object",
                properties: {
                  answer: { type: "number" },
                },
              },
            },
          },
          { client: mockClient },
        );

        // Verify
        expect(result.content).toEqual(textContent);
        expect(typeof result.content).toBe("string");
        expect(log.debug).toHaveBeenCalledWith(
          "Failed to parse formatted response as JSON",
        );
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

  describe("Hooks", () => {
    it("calls beforeEachTool hook before executing a tool", async () => {
      // Setup
      const mockResponse1 = {
        id: "resp_123",
        output: [
          {
            type: "function_call",
            name: "test_tool",
            arguments: '{"param":"test"}',
            call_id: "call_1",
          },
        ],
      };

      const mockResponse2 = {
        id: "resp_456",
        output: [
          {
            type: LlmMessageType.Message,
            content: [
              { type: LlmMessageType.OutputText, text: "Final response" },
            ],
            role: LlmMessageRole.Assistant,
          },
        ],
      };

      // Mock the API calls
      mockCreate
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      // Create a spy for the hook
      const beforeEachToolSpy = vi.fn().mockReturnValue(undefined);

      // Mock a tool that returns a simple result
      const mockTool = {
        name: "test_tool",
        description: "Test tool",
        parameters: {
          type: "object",
          properties: {
            param: { type: "string" },
          },
        },
        type: "function",
        call: vi.fn().mockResolvedValue({ result: "test result" }),
      };

      // Execute with hooks
      await operate(
        "Test input",
        {
          tools: [mockTool],
          turns: true,
          hooks: {
            beforeEachTool: beforeEachToolSpy,
          },
        },
        { client: mockClient },
      );

      // Verify the beforeEachTool hook was called with correct parameters
      expect(beforeEachToolSpy).toHaveBeenCalledTimes(1);
      expect(beforeEachToolSpy).toHaveBeenCalledWith({
        toolName: "test_tool",
        args: '{"param":"test"}',
      });
      // Verify the tool was called after the hook
      expect(mockTool.call).toHaveBeenCalledAfter(beforeEachToolSpy);
    });

    it("calls afterEachTool hook after executing a tool", async () => {
      // Setup
      const mockResponse1 = {
        id: "resp_123",
        output: [
          {
            type: "function_call",
            name: "test_tool",
            arguments: '{"param":"test"}',
            call_id: "call_1",
          },
        ],
      };

      const mockResponse2 = {
        id: "resp_456",
        output: [
          {
            type: LlmMessageType.Message,
            content: [
              { type: LlmMessageType.OutputText, text: "Final response" },
            ],
            role: LlmMessageRole.Assistant,
          },
        ],
      };

      // Mock the API calls
      mockCreate
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      // Create a spy for the hook
      const afterEachToolSpy = vi.fn().mockReturnValue(undefined);

      // Mock a tool that returns a simple result
      const toolResult = { result: "test result" };
      const mockTool = {
        name: "test_tool",
        description: "Test tool",
        parameters: {
          type: "object",
          properties: {
            param: { type: "string" },
          },
        },
        type: "function",
        call: vi.fn().mockResolvedValue(toolResult),
      };

      // Execute with hooks
      await operate(
        "Test input",
        {
          tools: [mockTool],
          turns: true,
          hooks: {
            afterEachTool: afterEachToolSpy,
          },
        },
        { client: mockClient },
      );

      // Verify the afterEachTool hook was called with correct parameters
      expect(afterEachToolSpy).toHaveBeenCalledTimes(1);
      expect(afterEachToolSpy).toHaveBeenCalledWith({
        result: toolResult,
        toolName: "test_tool",
        args: '{"param":"test"}',
      });
      // Verify the tool was called before the hook
      expect(mockTool.call).toHaveBeenCalledBefore(afterEachToolSpy);
    });

    it("calls onToolError hook when a tool throws an error", async () => {
      // Setup
      const mockResponse1 = {
        id: "resp_123",
        output: [
          {
            type: "function_call",
            name: "test_tool",
            arguments: '{"param":"test"}',
            call_id: "call_1",
          },
        ],
      };

      // Mock the API calls
      mockCreate.mockResolvedValueOnce(mockResponse1);

      // Create a spy for the hook
      const onToolErrorSpy = vi.fn().mockReturnValue(undefined);

      // Mock error to be thrown
      const toolError = new Error("Tool execution failed");

      // Mock a tool that throws an error
      const mockTool = {
        name: "test_tool",
        description: "Test tool",
        parameters: {
          type: "object",
          properties: {
            param: { type: "string" },
          },
        },
        type: "function",
        call: vi.fn().mockRejectedValue(toolError),
      };

      // Execute with hooks
      await operate(
        "Test input",
        {
          tools: [mockTool],
          turns: true,
          hooks: {
            onToolError: onToolErrorSpy,
          },
        },
        { client: mockClient },
      );

      // Verify the onToolError hook was called with correct parameters
      expect(onToolErrorSpy).toHaveBeenCalledTimes(1);
      expect(onToolErrorSpy).toHaveBeenCalledWith({
        error: toolError,
        toolName: "test_tool",
        args: '{"param":"test"}',
      });
    });

    it("allows beforeEachTool to return a Promise", async () => {
      // Setup
      const mockResponse1 = {
        id: "resp_123",
        output: [
          {
            type: "function_call",
            name: "test_tool",
            arguments: '{"param":"test"}',
            call_id: "call_1",
          },
        ],
      };

      const mockResponse2 = {
        id: "resp_456",
        output: [
          {
            type: LlmMessageType.Message,
            content: [
              { type: LlmMessageType.OutputText, text: "Final response" },
            ],
            role: LlmMessageRole.Assistant,
          },
        ],
      };

      // Mock the API calls
      mockCreate
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      // Create a spy for the hook that returns a Promise
      const asyncValue = "async value";
      const beforeEachToolSpy = vi.fn().mockResolvedValue(asyncValue);

      // Mock a tool that returns a simple result
      const mockTool = {
        name: "test_tool",
        description: "Test tool",
        parameters: {
          type: "object",
          properties: {
            param: { type: "string" },
          },
        },
        type: "function",
        call: vi.fn().mockResolvedValue({ result: "test result" }),
      };

      // Execute with hooks
      await operate(
        "Test input",
        {
          tools: [mockTool],
          turns: true,
          hooks: {
            beforeEachTool: beforeEachToolSpy,
          },
        },
        { client: mockClient },
      );

      // Verify the beforeEachTool hook was called
      expect(beforeEachToolSpy).toHaveBeenCalledTimes(1);
      // The promise should have been resolved
      await expect(beforeEachToolSpy.mock.results[0].value).resolves.toBe(
        asyncValue,
      );
    });

    it("afterEachTool does not modify the tool result", async () => {
      // Setup
      const mockResponse1 = {
        id: "resp_123",
        output: [
          {
            type: "function_call",
            name: "test_tool",
            arguments: '{"param":"test"}',
            call_id: "call_1",
          },
        ],
      };

      const mockResponse2 = {
        id: "resp_456",
        output: [
          {
            type: LlmMessageType.Message,
            content: [
              { type: LlmMessageType.OutputText, text: "Final response" },
            ],
            role: LlmMessageRole.Assistant,
          },
        ],
      };

      // Mock the API calls
      mockCreate
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      // Original tool result
      const toolResult = { result: "original result" };

      // Modified tool result from the hook
      const modifiedResult = { result: "modified result" };

      // Create a spy for the hook that modifies the result
      const afterEachToolSpy = vi.fn().mockReturnValue(modifiedResult);

      // Mock a tool that returns the original result
      const mockTool = {
        name: "test_tool",
        description: "Test tool",
        parameters: {
          type: "object",
          properties: {
            param: { type: "string" },
          },
        },
        type: "function",
        call: vi.fn().mockResolvedValue(toolResult),
      };

      // Execute with hooks
      const result = await operate(
        "Test input",
        {
          tools: [mockTool],
          turns: true,
          hooks: {
            afterEachTool: afterEachToolSpy,
          },
        },
        { client: mockClient },
      );

      // Check that the functionCallOutput contains the modified result
      const functionCallOutput = result.history.find(
        (item) => item.type === LlmMessageType.FunctionCallOutput,
      ) as LlmToolResult;

      expect(JSON.parse(functionCallOutput.output)).toEqual(toolResult);
    });

    describe("Model Hooks", () => {
      it("calls beforeEachModelRequest hook before making a request", async () => {
        // Setup
        const mockResponse = {
          id: "resp_123",
          output: [
            {
              type: LlmMessageType.Message,
              content: [{ type: LlmMessageType.OutputText, text: "Response" }],
              role: LlmMessageRole.Assistant,
            },
          ],
        };
        mockCreate.mockResolvedValueOnce(mockResponse);

        // Create a spy for the hook
        const beforeEachModelRequestSpy = vi.fn().mockReturnValue(undefined);

        // Execute with hook
        await operate(
          "Test input",
          {
            hooks: {
              beforeEachModelRequest: beforeEachModelRequestSpy,
            },
          },
          { client: mockClient },
        );

        // Verify the hook was called with correct parameters
        expect(beforeEachModelRequestSpy).toHaveBeenCalledTimes(1);
        expect(beforeEachModelRequestSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            input: "Test input",
            options: expect.objectContaining({
              hooks: expect.objectContaining({
                beforeEachModelRequest: beforeEachModelRequestSpy,
              }),
            }),
            providerRequest: expect.objectContaining({
              model: expect.any(String),
              input: expect.any(Array),
            }),
          }),
        );
      });

      it("calls afterEachModelResponse hook after receiving a response", async () => {
        // Setup
        const mockResponse = {
          id: "resp_123",
          output: [
            {
              type: LlmMessageType.Message,
              content: [
                { type: LlmMessageType.OutputText, text: "Test response" },
              ],
              role: LlmMessageRole.Assistant,
            },
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 20,
            total_tokens: 30,
          },
        };
        mockCreate.mockResolvedValueOnce(mockResponse);

        // Create a spy for the hook
        const afterEachModelResponseSpy = vi.fn().mockReturnValue(undefined);

        // Execute with hook
        await operate(
          "Test input",
          {
            hooks: {
              afterEachModelResponse: afterEachModelResponseSpy,
            },
          },
          { client: mockClient },
        );

        // Verify the hook was called with correct parameters
        expect(afterEachModelResponseSpy).toHaveBeenCalledTimes(1);
        expect(afterEachModelResponseSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            input: "Test input",
            options: expect.objectContaining({
              hooks: expect.objectContaining({
                afterEachModelResponse: afterEachModelResponseSpy,
              }),
            }),
            providerRequest: expect.objectContaining({
              model: expect.any(String),
              input: expect.any(Array),
            }),
            providerResponse: mockResponse,
            content: "Test response",
            usage: expect.arrayContaining([
              expect.objectContaining({
                input: 10,
                output: 20,
                total: 30,
                provider: expect.any(String),
                model: expect.any(String),
              }),
            ]),
          }),
        );
      });

      it("calls afterEachModelResponse hook immediately after usage processing, before function calls", async () => {
        // Setup - First response with function call, second response with final answer
        const mockResponse1 = {
          id: "resp_123",
          output: [
            {
              type: "function_call",
              name: "test_tool",
              arguments: '{"param":"test"}',
              call_id: "call_1",
            },
          ],
          usage: {
            input_tokens: 15,
            output_tokens: 5,
            total_tokens: 20,
          },
        };

        const mockResponse2 = {
          id: "resp_456",
          output: [
            {
              type: LlmMessageType.Message,
              content: [
                { type: LlmMessageType.OutputText, text: "Final response" },
              ],
              role: LlmMessageRole.Assistant,
            },
          ],
          usage: {
            input_tokens: 25,
            output_tokens: 10,
            total_tokens: 35,
          },
        };

        mockCreate
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        // Track call order
        const callOrder: string[] = [];

        // Create spies that track call order
        const afterEachModelResponseSpy = vi.fn().mockImplementation(() => {
          callOrder.push("afterEachModelResponse");
        });

        const mockTool = {
          name: "test_tool",
          description: "Test tool",
          parameters: {
            type: "object",
            properties: {
              param: { type: "string" },
            },
          },
          type: "function",
          call: vi.fn().mockImplementation(() => {
            callOrder.push("toolCall");
            return { result: "test result" };
          }),
        };

        // Execute with hook and tool
        await operate(
          "Test input",
          {
            tools: [mockTool],
            turns: true,
            hooks: {
              afterEachModelResponse: afterEachModelResponseSpy,
            },
          },
          { client: mockClient },
        );

        // Verify the hook was called before tool execution on first turn, then again on second turn
        expect(callOrder).toEqual([
          "afterEachModelResponse",
          "toolCall",
          "afterEachModelResponse",
        ]);
        expect(afterEachModelResponseSpy).toHaveBeenCalledTimes(2);

        // Verify first call had function call content
        expect(afterEachModelResponseSpy).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            content: 'function_call:test_tool{"param":"test"}#call_1',
            usage: expect.arrayContaining([
              expect.objectContaining({
                input: 15,
                output: 5,
                total: 20,
              }),
            ]),
          }),
        );

        // Verify second call had message content
        expect(afterEachModelResponseSpy).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            content: "Final response",
            usage: expect.arrayContaining([
              expect.objectContaining({
                input: 15,
                output: 5,
                total: 20,
              }),
              expect.objectContaining({
                input: 25,
                output: 10,
                total: 35,
              }),
            ]),
          }),
        );
      });

      it("calls onRetryableModelError hook on retryable errors", async () => {
        // Setup
        const retryableError = new InternalServerError(
          500,
          "Internal Server Error",
          undefined,
          {},
        );

        // First call fails, second succeeds
        mockCreate.mockRejectedValueOnce(retryableError);
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

        // Create a spy for the hook
        const onRetryableModelErrorSpy = vi.fn().mockReturnValue(undefined);

        // Execute with hook
        await operate(
          "Test input",
          {
            hooks: {
              onRetryableModelError: onRetryableModelErrorSpy,
            },
          },
          { client: mockClient },
        );

        // Verify the hook was called with correct parameters
        expect(onRetryableModelErrorSpy).toHaveBeenCalledTimes(1);
        expect(onRetryableModelErrorSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            input: "Test input",
            options: expect.objectContaining({
              hooks: expect.objectContaining({
                onRetryableModelError: onRetryableModelErrorSpy,
              }),
            }),
            providerRequest: expect.objectContaining({
              model: expect.any(String),
              input: expect.any(Array),
            }),
            error: retryableError,
          }),
        );
      });

      it("calls onUnrecoverableModelError hook on non-retryable errors", async () => {
        // Setup
        const nonRetryableError = new AuthenticationError(
          401,
          "Authentication error",
          undefined,
          {},
        );
        mockCreate.mockRejectedValueOnce(nonRetryableError);

        // Create a spy for the hook
        const onUnrecoverableModelErrorSpy = vi.fn().mockReturnValue(undefined);

        // Execute with hook and expect it to throw
        await expect(
          operate(
            "Test input",
            {
              hooks: {
                onUnrecoverableModelError: onUnrecoverableModelErrorSpy,
              },
            },
            { client: mockClient },
          ),
        ).rejects.toThrow();

        // Verify the hook was called with correct parameters
        expect(onUnrecoverableModelErrorSpy).toHaveBeenCalledTimes(1);
        expect(onUnrecoverableModelErrorSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            input: "Test input",
            options: expect.objectContaining({
              hooks: expect.objectContaining({
                onUnrecoverableModelError: onUnrecoverableModelErrorSpy,
              }),
            }),
            providerRequest: expect.objectContaining({
              model: expect.any(String),
              input: expect.any(Array),
            }),
            error: nonRetryableError,
          }),
        );
      });

      it("calls onUnrecoverableModelError hook when retries are exhausted", async () => {
        // Import MAX_RETRIES_DEFAULT_LIMIT to use in test
        const { MAX_RETRIES_DEFAULT_LIMIT } = await import("../operate");

        // Setup - All calls fail with retryable errors (exceeding retry limit)
        const retryableError = new InternalServerError(
          500,
          "Internal Server Error",
          undefined,
          {},
        );

        for (let i = 0; i <= MAX_RETRIES_DEFAULT_LIMIT; i++) {
          mockCreate.mockRejectedValueOnce(retryableError);
        }

        // Create a spy for the hook
        const onUnrecoverableModelErrorSpy = vi.fn().mockReturnValue(undefined);

        // Execute with hook and expect it to throw
        await expect(
          operate(
            "Test input",
            {
              hooks: {
                onUnrecoverableModelError: onUnrecoverableModelErrorSpy,
              },
            },
            { client: mockClient },
          ),
        ).rejects.toThrow();

        // Verify the hook was called with correct parameters
        expect(onUnrecoverableModelErrorSpy).toHaveBeenCalledTimes(1);
        expect(onUnrecoverableModelErrorSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            input: "Test input",
            options: expect.objectContaining({
              hooks: expect.objectContaining({
                onUnrecoverableModelError: onUnrecoverableModelErrorSpy,
              }),
            }),
            providerRequest: expect.objectContaining({
              model: expect.any(String),
              input: expect.any(Array),
            }),
            error: retryableError,
          }),
        );
      });
    });
  });

  describe("Tools and Toolkit", () => {
    describe("Toolkit Support", () => {
      it("accepts Toolkit instance as tools parameter", async () => {
        // Setup
        const mockTool: LlmTool = {
          name: "test_tool",
          description: "Test tool",
          parameters: {
            type: "object",
            properties: {
              param: { type: "string" },
            },
          },
          type: "function",
          call: vi.fn().mockResolvedValue({ result: "test result" }),
        };

        const toolkit = new Toolkit([mockTool]);

        const mockResponse = {
          id: "resp_123",
          output: [
            {
              type: LlmMessageType.Message,
              content: [{ type: LlmMessageType.OutputText, text: "Response" }],
              role: LlmMessageRole.Assistant,
            },
          ],
        };
        mockCreate.mockResolvedValueOnce(mockResponse);

        // Execute
        const result = await operate(
          "Test input",
          {
            tools: toolkit,
          },
          { client: mockClient },
        );

        // Verify
        expect(result).toBeDefined();
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            tools: expect.arrayContaining([
              expect.objectContaining({
                name: "test_tool",
                description: "Test tool",
                type: "function",
              }),
            ]),
          }),
        );
      });

      it("uses provided Toolkit directly without recreating it", async () => {
        // Setup
        const mockTool: LlmTool = {
          name: "test_tool",
          description: "Test tool",
          parameters: {
            type: "object",
            properties: {
              param: { type: "string" },
            },
          },
          type: "function",
          call: vi.fn().mockResolvedValue({ result: "test result" }),
        };

        const toolkit = new Toolkit([mockTool], { explain: true });

        const mockResponse1 = {
          id: "resp_123",
          output: [
            {
              type: "function_call",
              name: "test_tool",
              arguments: '{"param":"test","__Explanation":"Testing"}',
              call_id: "call_1",
            },
          ],
        };

        const mockResponse2 = {
          id: "resp_456",
          output: [
            {
              type: LlmMessageType.Message,
              content: [
                { type: LlmMessageType.OutputText, text: "Final response" },
              ],
              role: LlmMessageRole.Assistant,
            },
          ],
        };

        mockCreate
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        // Execute
        await operate(
          "Test input",
          {
            tools: toolkit,
            turns: true,
          },
          { client: mockClient },
        );

        // Verify the toolkit's explain functionality was preserved
        expect(mockCreate).toHaveBeenCalled();
        expect(mockCreate).toHaveBeenCalledTimes(2);
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            tools: expect.arrayContaining([
              expect.objectContaining({
                name: "test_tool",
                parameters: expect.objectContaining({
                  properties: expect.objectContaining({
                    __Explanation: expect.objectContaining({
                      type: "string",
                      description: expect.stringContaining(
                        "Clearly state why the tool is being called",
                      ),
                    }),
                  }),
                }),
              }),
            ]),
          }),
        );

        // Verify the tool was called and __Explanation was removed
        expect(mockTool.call).toHaveBeenCalledWith({ param: "test" });
      });

      it("works with both array of tools and Toolkit instance in multi-turn", async () => {
        // Setup - Test that both types work the same way
        const mockTool: LlmTool = {
          name: "test_tool",
          description: "Test tool",
          parameters: {
            type: "object",
            properties: {
              param: { type: "string" },
            },
          },
          type: "function",
          call: vi.fn().mockResolvedValue({ result: "test result" }),
        };

        const mockResponse1 = {
          id: "resp_123",
          output: [
            {
              type: "function_call",
              name: "test_tool",
              arguments: '{"param":"test"}',
              call_id: "call_1",
            },
          ],
        };

        const mockResponse2 = {
          id: "resp_456",
          output: [
            {
              type: LlmMessageType.Message,
              content: [
                { type: LlmMessageType.OutputText, text: "Final response" },
              ],
              role: LlmMessageRole.Assistant,
            },
          ],
        };

        mockCreate
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        // Test with array first
        await operate(
          "Test input",
          {
            tools: [mockTool],
            turns: true,
          },
          { client: mockClient },
        );

        // Reset mock
        mockCreate.mockClear();
        mockTool.call = vi.fn().mockResolvedValue({ result: "test result" });

        mockCreate
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        // Test with Toolkit
        const toolkit = new Toolkit([mockTool]);
        await operate(
          "Test input",
          {
            tools: toolkit,
            turns: true,
          },
          { client: mockClient },
        );

        // Both should have called the tool
        expect(mockTool.call).toHaveBeenCalledWith({ param: "test" });
      });
    });
  });

  describe("Specific Scenarios", () => {
    describe("Multi-turn conversation with function calling", () => {
      beforeEach(async () => {
        // const mockResponse = await mockCreate();
        const mockResponse = {
          created: 1234567890,
          error: null,
          id: "mock-id",
          model: "mock-gpt",
          object: "response",
          output: [
            {
              arguments: `{"taco":"true"}`,
              type: "function_call",
              call_id: "call_AqV9ihaQqvQBEJmvmUOAJ7RD",
              name: "mock_tool",
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
        };
        mockCreate.mockResolvedValueOnce(mockResponse);
        vi.clearAllMocks();
        expect(mockCreate).not.toHaveBeenCalled();
      });

      it("Simulates multi-turn conversation with function calling", async () => {
        // Call operate with mock client
        const result = await operate(
          "Hello",
          {
            tools: [mockTool],
          },
          { client: mockClient },
        );

        // Verify result contains the expected response
        expect(result).not.toBeUndefined();

        // Verify the mock was called twice: the call requesting the function and the call with the result
        expect(mockClient.responses.create).toHaveBeenCalled();
        expect(mockClient.responses.create).toHaveBeenCalledTimes(2);

        // Verify tool was called
        expect(mockTool.call).toHaveBeenCalled();
        expect(mockTool.call).toHaveBeenCalledTimes(1);

        // Verify tool was called with the correct arguments
        expect(mockTool.call).toHaveBeenCalledWith({
          taco: "true",
        });
      });
    });
  });
});
