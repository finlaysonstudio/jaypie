import { getEnvSecret } from "@jaypie/aws";
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
import { log } from "../../../util/logger.js";
import { restoreLog, spyLog } from "@jaypie/testkit";
import { sleep } from "@jaypie/core";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { z } from "zod";
import { OpenAiProvider } from "../OpenAiProvider.class";
import { MAX_RETRIES_DEFAULT_LIMIT } from "../operate";
import { OpenAIResponse } from "../types";
import { LlmTool } from "../../../types/LlmTool.interface";
import { formatOperateInput, formatOperateMessage } from "../../../util";

vi.mock("openai");

const MOCK = {
  INSTRUCTIONS: "You are a helpful assistant",
  RESPONSE: {
    TEXT: {
      id: "resp_123",
      content: [{ text: "Cilantro is a good taco ingredient" }],
    },
  },
};

beforeAll(async () => {
  vi.spyOn(await import("@jaypie/core"), "sleep").mockResolvedValue(undefined);
});
beforeEach(async () => {
  spyLog(log);
});

afterEach(() => {
  vi.clearAllMocks();
  restoreLog(log);
});

const mockCreate = vi.fn().mockResolvedValue(MOCK.RESPONSE.TEXT);

describe("OpenAiProvider.operate", () => {
  beforeEach(() => {
    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          responses: {
            create: mockCreate,
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
      const result = (await provider.operate("test")) as OpenAIResponse;
      expect(result).toBeArray();
    });
    it("Works how we expect", async () => {
      // Execute
      const provider = new OpenAiProvider("mock-model");
      const testInput = formatOperateInput("What is a good taco ingredient?");
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
    let provider: OpenAiProvider;
    beforeEach(() => {
      provider = new OpenAiProvider();
    });
    // Note: User tests and API Retry tests have been migrated to operate.spec.ts
    // Message Options tests have been migrated to operate.spec.ts
    // Multi Turn tests have been migrated to operate.spec.ts
    describe("Multi Turn", () => {
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
        const tools: LlmTool[] = [
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

        const result = (await provider.operate(testInput, {
          tools,
          turns: 3, // Set maximum turns to 3
        })) as OpenAIResponse;

        // Verify
        expect(result).toBeArray();
        expect(result).toHaveLength(3); // Should have 3 responses (one for each turn)
        expect(result[0]).toEqual(mockResponse1);
        expect(result[1]).toEqual(mockResponse2);
        expect(result[2]).toEqual(mockResponse3);

        // Verify the create function was called 3 times (once for each turn)
        expect(mockCreate).toHaveBeenCalledTimes(3);

        // First call should be with the initial input
        expect(mockCreate.mock.calls[0][0]).toEqual({
          model: expect.any(String),
          input: expect.any(Array),
          tools: expect.any(Array),
        });
        expect(mockCreate.mock.calls[0][0].input).toBeArray();
        expect(mockCreate.mock.calls[0][0].input[0]).toEqual({
          content: testInput,
          role: "user",
          type: "message",
        });
        // Second call should include the first function call and its result
        expect(mockCreate.mock.calls[1][0].input).toBeArray();
        expect(mockCreate.mock.calls[1][0].input).toContainEqual({
          type: "function_call",
          name: "test_tool",
          arguments: '{"turn":1}',
          call_id: "call_1",
        });
        expect(mockCreate.mock.calls[1][0].input).toContainEqual({
          type: "function_call_output",
          call_id: "call_1",
          output: JSON.stringify({ result: "result from turn 1" }),
        });

        // Third call should include the second function call and its result
        expect(mockCreate.mock.calls[2][0].input).toBeArray();
        expect(mockCreate.mock.calls[2][0].input).toContainEqual({
          type: "function_call",
          name: "test_tool",
          arguments: '{"turn":2}',
          call_id: "call_2",
        });
        expect(mockCreate.mock.calls[2][0].input).toContainEqual({
          type: "function_call_output",
          call_id: "call_2",
          output: JSON.stringify({ result: "result from turn 2" }),
        });

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

          // For the last response, we'll have it return a text response
          // to show that we're stopping because of max turns, not because
          // there are no more function calls
          if (i === MAX_TURNS_DEFAULT_LIMIT) {
            mockCreate.mockResolvedValueOnce(mockResponse);
          } else {
            mockCreate.mockResolvedValueOnce(mockResponse);
          }
        }

        // Mock the tool call function to return a result for each turn
        const mockCall = vi.fn();
        for (let i = 1; i <= MAX_TURNS_DEFAULT_LIMIT; i++) {
          mockCall.mockResolvedValueOnce({ result: `result from turn ${i}` });
        }

        // Execute
        const testInput = "Test input with default max turns";
        const tools: LlmTool[] = [
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
        const result = (await provider.operate(testInput, {
          tools,
          // No turns parameter specified
        })) as OpenAIResponse;

        // Verify
        expect(result).toBeArray();
        expect(result).toHaveLength(MAX_TURNS_DEFAULT_LIMIT);

        // Verify all responses are in the result
        for (let i = 0; i < MAX_TURNS_DEFAULT_LIMIT; i++) {
          expect(result[i]).toEqual(mockResponses[i]);
        }

        // Verify the create function was called MAX_TURNS_DEFAULT_LIMIT times
        expect(mockCreate).toHaveBeenCalledTimes(MAX_TURNS_DEFAULT_LIMIT);

        // Verify the first call was with the initial input
        expect(mockCreate.mock.calls[0][0]).toEqual({
          model: expect.any(String),
          input: expect.any(Array),
          tools: expect.any(Array),
        });
        expect(mockCreate.mock.calls[0][0].input).toBeArray();
        expect(mockCreate.mock.calls[0][0].input[0]).toEqual({
          content: testInput,
          role: "user",
          type: "message",
        });

        // Verify each subsequent call included the previous function call and result
        for (let i = 1; i < MAX_TURNS_DEFAULT_LIMIT; i++) {
          expect(mockCreate.mock.calls[i][0].input).toBeArray();

          // Should contain the function call from the previous turn
          expect(mockCreate.mock.calls[i][0].input).toContainEqual({
            type: "function_call",
            name: "test_tool",
            arguments: `{"turn":${i}}`,
            call_id: `call_${i}`,
          });

          // Should contain the function call result from the previous turn
          expect(mockCreate.mock.calls[i][0].input).toContainEqual({
            type: "function_call_output",
            call_id: `call_${i}`,
            output: JSON.stringify({ result: `result from turn ${i}` }),
          });
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
        // This tests our new code that handles Promise results
        const mockAsyncCall = vi.fn().mockImplementation(({ delay }) => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(asyncResult);
            }, delay);
          });
        });

        // Execute
        const testInput = "Test input with async tool";
        const tools: LlmTool[] = [
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

        const result = (await provider.operate(testInput, {
          tools,
          turns: true, // Enable multi-turn
        })) as OpenAIResponse;

        // Verify
        expect(result).toBeArray();
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(mockResponse1);
        expect(result[1]).toEqual(mockResponse2);

        // Verify the create function was called twice
        expect(mockCreate).toHaveBeenCalledTimes(2);

        // First call should be with the initial input
        expect(mockCreate.mock.calls[0][0]).toEqual({
          model: expect.any(String),
          input: expect.any(Array),
          tools: expect.any(Array),
        });
        expect(mockCreate.mock.calls[0][0].input).toBeArray();
        expect(mockCreate.mock.calls[0][0].input[0]).toEqual({
          content: testInput,
          role: "user",
          type: "message",
        });

        // Second call should include the function call and its resolved Promise result
        expect(mockCreate.mock.calls[1][0].input).toBeArray();
        expect(mockCreate.mock.calls[1][0].input).toContainEqual({
          type: "function_call",
          name: "async_tool",
          arguments: '{"delay":100}',
          call_id: "call_1",
        });
        expect(mockCreate.mock.calls[1][0].input).toContainEqual({
          type: "function_call_output",
          call_id: "call_1",
          output: JSON.stringify(asyncResult),
        });

        // Verify the async tool was called with the correct arguments
        expect(mockAsyncCall).toHaveBeenCalledTimes(1);
        expect(mockAsyncCall).toHaveBeenCalledWith({ delay: 100 });
      });
    });
    describe("Provider Options", () => {
      it("Passes providerOptions to the OpenAI API", async () => {
        // Setup
        const mockResponse = {
          id: "resp_123",
          content: [{ text: "Response with custom temperature" }],
        };
        mockCreate.mockResolvedValueOnce(mockResponse);

        // Execute
        const result = await provider.operate("test input", {
          providerOptions: {
            temperature: 0.5,
            top_p: 0.8,
            frequency_penalty: 0.2,
          },
        });

        // Verify
        expect(mockCreate).toHaveBeenCalledWith({
          model: expect.any(String),
          input: formatOperateInput("test input"),
          temperature: 0.5,
          top_p: 0.8,
          frequency_penalty: 0.2,
        });
        expect(result).toEqual([mockResponse]);
      });
    });
    describe("Chat history", () => {
      it.skip("Passes chat history to the OpenAI API", async () => {
        // Setup
        const mockResponse = {
          id: "resp_123",
          content: [{ text: "Response with chat history" }],
        };
        mockCreate.mockResolvedValueOnce(mockResponse);
        const history = [
          { role: "user", content: "test input" },
          { role: "assistant", content: "test response" },
        ];

        // Execute
        const result = await provider.operate("test message #3", {
          history,
        });

        // Verify
        const expectedInput = [
          ...history,
          formatOperateMessage("test message #3"),
        ];
        expect(mockCreate).toHaveBeenCalledWith({
          model: expect.any(String),
          input: expectedInput,
        });
        expect(result).toEqual([mockResponse]);
      });
      it.todo("Passes tool calls and results to the OpenAI API");
      it("Instances track history by default", async () => {
        // Setup
        const firstMessage = "Test message #1";
        const secondMessage = "Test message #2";
        const mockResponse = {
          id: "resp_123",
          content: [{ text: "Response to message #1" }],
        };
        mockCreate.mockResolvedValueOnce(mockResponse);
        const result = await provider.operate(firstMessage);
        expect(result).toEqual([mockResponse]);
        expect(mockCreate).toHaveBeenCalledWith({
          model: expect.any(String),
          input: formatOperateInput(firstMessage),
        });
        const secondMockResponse = {
          id: "resp_123",
          content: [{ text: "Response to message #2" }],
        };
        mockCreate.mockResolvedValueOnce(secondMockResponse);
        const secondResult = await provider.operate(secondMessage);
        expect(secondResult).toEqual([secondMockResponse]);
        expect(mockCreate).toHaveBeenCalledWith({
          model: expect.any(String),
          input: [
            formatOperateMessage(firstMessage),
            expect.any(Object),
            formatOperateMessage(secondMessage),
          ],
        });
      });
    });

    describe("Structured Output", () => {
      it("Structured output uses responses API", async () => {
        const mockResponse = {
          salutation: "Hello",
          name: "World",
        };
        mockCreate.mockResolvedValueOnce(mockResponse);

        const GreetingFormat = z.object({
          salutation: z.string(),
          name: z.string(),
        });
        const response = await provider.operate("Hello, World", {
          format: GreetingFormat,
        });
        expect(mockCreate).toHaveBeenCalledWith({
          input: formatOperateInput("Hello, World"),
          model: expect.any(String),
          text: {
            format: {
              name: expect.any(String),
              schema: expect.any(Object),
              strict: true,
              type: "json_schema",
            },
          },
        });
        expect(response).toEqual([mockResponse]);
      });

      it("Handles NaturalSchema response format", async () => {
        const mockResponse = {
          salutation: "Hello",
          name: "World",
        };
        mockCreate.mockResolvedValueOnce(mockResponse);

        const GreetingFormat = {
          salutation: String,
          name: String,
        };
        const response = await provider.operate("Hello, World", {
          format: GreetingFormat,
        });

        expect(mockCreate).toHaveBeenCalledWith({
          input: formatOperateInput("Hello, World"),
          model: expect.any(String),
          text: {
            format: {
              name: expect.any(String),
              schema: expect.any(Object),
              strict: true,
              type: "json_schema",
            },
          },
        });
        expect(response).toEqual([mockResponse]);
      });

      it("Accepts json_schema output format", async () => {
        const mockResponse = {
          salutation: "Hello",
          name: "World",
        };
        mockCreate.mockResolvedValueOnce(mockResponse);

        const GreetingFormat = {
          type: "json_schema",
          name: "greeting_response",
          schema: {
            type: "object",
            properties: {
              salutation: { type: "string" },
              name: { type: "string" },
            },
            required: ["salutation", "name"],
            additionalProperties: false,
          },
          strict: true,
        };
        const response = await provider.operate("Hello, World", {
          format: GreetingFormat,
        });

        expect(mockCreate).toHaveBeenCalledWith({
          input: formatOperateInput("Hello, World"),
          model: expect.any(String),
          text: {
            format: GreetingFormat,
          },
        });
        expect(response).toEqual([mockResponse]);
      });

      it.todo("Combines with tools on the final response?");
    });
  });
});
