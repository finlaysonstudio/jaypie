import { getEnvSecret } from "@jaypie/aws";
import { OpenAI } from "openai";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod/v4";
import { OpenAiProvider } from "../OpenAiProvider.class";
import {
  LlmHistoryItem,
  LlmInputMessage,
  LlmMessageRole,
  LlmMessageType,
  LlmResponseStatus,
} from "../../../types/LlmProvider.interface.js";
// Mock the operate module
vi.mock("../operate.js");
vi.mock("openai");

// Mock the OperateLoop for conversation history tests
vi.mock("../../../operate/index.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    createOperateLoop: vi.fn(() => ({
      execute: vi.fn(),
    })),
  };
});

vi.mock("@jaypie/aws", async () => {
  const actual = await vi.importActual("@jaypie/aws");
  const module = {
    ...actual,
    getEnvSecret: vi.fn(() => "MOCK_VALUE"),
  };
  return module;
});

describe("OpenAiProvider", () => {
  beforeEach(() => {
    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          chat: {
            completions: {
              create: vi.fn(),
              parse: vi.fn(),
            },
          },
        }) as any,
    );
    vi.mocked(getEnvSecret).mockResolvedValue("test-key");
  });

  describe("Base Cases", () => {
    it("is a Class", () => {
      expect(OpenAiProvider).toBeFunction();
    });

    it("Works", () => {
      const provider = new OpenAiProvider();
      expect(provider).toBeInstanceOf(OpenAiProvider);
    });
  });

  describe("Error Conditions", () => {
    beforeEach(() => {
      vi.mocked(getEnvSecret).mockResolvedValue(null as unknown as string);
    });

    it("throws ConfigurationError when API key is missing", async () => {
      const provider = new OpenAiProvider();
      expect(async () => provider.send("test")).toThrowConfigurationError();
    });
  });

  describe("Happy Paths", () => {
    beforeEach(() => {
      vi.mocked(getEnvSecret).mockResolvedValue("test-key");
    });

    it("sends messages to OpenAI", async () => {
      const mockResponse = {
        choices: [{ message: { content: "test response" } }],
      };

      const mockCreate = vi.fn().mockResolvedValue(mockResponse);
      vi.mocked(OpenAI).mockImplementation(
        () =>
          ({
            chat: {
              completions: {
                create: mockCreate,
              },
            },
          }) as any,
      );

      const provider = new OpenAiProvider();
      const response = await provider.send("test message");

      expect(response).toBe("test response");
      expect(mockCreate).toHaveBeenCalledWith({
        messages: [{ role: "user", content: "test message" }],
        model: expect.any(String),
      });
    });
  });

  describe("Features", () => {
    describe("Structured Output", () => {
      it("Uses parse endpoint when structured output is requested", async () => {
        const mockParsedResponse = {
          salutation: "Hello",
          name: "World",
        };

        const mockResponse = {
          choices: [
            {
              message: {
                parsed: mockParsedResponse,
              },
            },
          ],
        };

        const mockParse = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              chat: {
                completions: {
                  parse: mockParse,
                },
              },
            }) as any,
        );

        const provider = new OpenAiProvider();
        const GreetingFormat = z.object({
          salutation: z.string(),
          name: z.string(),
        });
        const response = await provider.send("Hello, World", {
          response: GreetingFormat,
        });

        expect(response).toEqual(mockParsedResponse);
        expect(mockParse).toHaveBeenCalledWith({
          messages: [{ role: "user", content: "Hello, World" }],
          model: expect.any(String),
          response_format: expect.any(Object),
        });
      });

      it("Handles NaturalSchema response format", async () => {
        const mockParsedResponse = {
          salutation: "Hello",
          name: "World",
        };

        const mockResponse = {
          choices: [
            {
              message: {
                parsed: mockParsedResponse,
              },
            },
          ],
        };

        const mockParse = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              chat: {
                completions: {
                  parse: mockParse,
                },
              },
            }) as any,
        );

        const provider = new OpenAiProvider();
        const GreetingFormat = {
          salutation: String,
          name: String,
        };
        const response = await provider.send("Hello, World", {
          response: GreetingFormat,
        });

        expect(response).toEqual(mockParsedResponse);
        expect(mockParse).toHaveBeenCalledWith({
          messages: [{ role: "user", content: "Hello, World" }],
          model: expect.any(String),
          response_format: expect.any(Object),
        });
      });
    });

    describe("Message Options", () => {
      it("includes system message when provided", async () => {
        const mockResponse = {
          choices: [{ message: { content: "test response" } }],
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              chat: {
                completions: {
                  create: mockCreate,
                },
              },
            }) as any,
        );

        const provider = new OpenAiProvider();
        const response = await provider.send("test message", {
          system: "You are a test assistant",
        });

        expect(response).toBe("test response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [
            { role: "developer", content: "You are a test assistant" },
            { role: "user", content: "test message" },
          ],
          model: expect.any(String),
        });
      });

      it("applies placeholders to system message", async () => {
        const mockResponse = {
          choices: [{ message: { content: "test response" } }],
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              chat: {
                completions: {
                  create: mockCreate,
                },
              },
            }) as any,
        );

        const provider = new OpenAiProvider();
        const response = await provider.send("test message", {
          system: "You are a {{role}}",
          data: { role: "test assistant" },
        });

        expect(response).toBe("test response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [
            { role: "developer", content: "You are a test assistant" },
            { role: "user", content: "test message" },
          ],
          model: expect.any(String),
        });
      });

      it("applies placeholders to user message", async () => {
        const mockResponse = {
          choices: [{ message: { content: "test response" } }],
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              chat: {
                completions: {
                  create: mockCreate,
                },
              },
            }) as any,
        );

        const provider = new OpenAiProvider();
        const response = await provider.send("Hello, {{name}}", {
          data: { name: "World" },
        });

        expect(response).toBe("test response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [{ role: "user", content: "Hello, World" }],
          model: expect.any(String),
        });
      });

      it("respects placeholders.message option", async () => {
        const mockResponse = {
          choices: [{ message: { content: "test response" } }],
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              chat: {
                completions: {
                  create: mockCreate,
                },
              },
            }) as any,
        );

        const provider = new OpenAiProvider();
        const response = await provider.send("Hello, {{name}}", {
          data: { name: "World" },
          placeholders: { message: false },
        });

        expect(response).toBe("test response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [{ role: "user", content: "Hello, {{name}}" }],
          model: expect.any(String),
        });
      });

      it("respects placeholders.system option", async () => {
        const mockResponse = {
          choices: [{ message: { content: "test response" } }],
        };

        const mockCreate = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(OpenAI).mockImplementation(
          () =>
            ({
              chat: {
                completions: {
                  create: mockCreate,
                },
              },
            }) as any,
        );

        const provider = new OpenAiProvider();
        const response = await provider.send("test message", {
          system: "You are a {{role}}",
          data: { role: "test assistant" },
          placeholders: { system: false },
        });

        expect(response).toBe("test response");
        expect(mockCreate).toHaveBeenCalledWith({
          messages: [
            { role: "developer", content: "You are a {{role}}" },
            { role: "user", content: "test message" },
          ],
          model: expect.any(String),
        });
      });
    });
  });

  describe("Conversation History", () => {
    let executeMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      // Get the mocked createOperateLoop function
      const { createOperateLoop } = await import("../../../operate/index.js");
      executeMock = vi.fn();
      vi.mocked(createOperateLoop).mockReturnValue({
        execute: executeMock,
      } as any);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("maintains conversation history across operate calls", async () => {
      // Mock the execute function to return a history
      const mockOperateResponse1 = {
        content: "Hello, I'm an AI assistant",
        history: [
          {
            role: LlmMessageRole.User,
            content: "Hello",
            type: LlmMessageType.Message,
          },
          {
            role: LlmMessageRole.Assistant,
            content: [
              {
                text: "Hello, I'm an AI assistant",
                type: LlmMessageType.OutputText,
              },
            ],
            type: LlmMessageType.Message,
            status: LlmResponseStatus.Completed,
          },
        ],
        model: "gpt-4o",
        output: [],
        provider: "openai",
        responses: [],
        status: LlmResponseStatus.Completed,
        usage: [
          {
            input: 1,
            output: 1,
            reasoning: 0,
            total: 2,
            provider: "openai",
            model: "gpt-4o",
          },
        ],
      };

      const mockOperateResponse2 = {
        content: "Your name is John",
        history: [
          {
            role: LlmMessageRole.User,
            content: "Hello",
            type: LlmMessageType.Message,
          },
          {
            role: LlmMessageRole.Assistant,
            content: [
              {
                text: "Hello, I'm an AI assistant",
                type: LlmMessageType.OutputText,
              },
            ],
            type: LlmMessageType.Message,
            status: LlmResponseStatus.Completed,
          },
          {
            role: LlmMessageRole.User,
            content: "What's my name?",
            type: LlmMessageType.Message,
          },
          {
            role: LlmMessageRole.Assistant,
            content: [
              { text: "Your name is John", type: LlmMessageType.OutputText },
            ],
            type: LlmMessageType.Message,
            status: LlmResponseStatus.Completed,
          },
        ],
        model: "gpt-4o",
        output: [],
        provider: "openai",
        responses: [],
        status: LlmResponseStatus.Completed,
        usage: [
          {
            input: 1,
            output: 1,
            reasoning: 0,
            total: 2,
            provider: "openai",
            model: "gpt-4o",
          },
        ],
      };

      // Set up the mock responses
      executeMock
        .mockResolvedValueOnce(mockOperateResponse1)
        .mockResolvedValueOnce(mockOperateResponse2);

      const provider = new OpenAiProvider();

      // First operate call
      await provider.operate("Hello");

      // Second operate call should include history from first call
      await provider.operate("What's my name?");

      // Check that the second call included the history from the first call
      expect(executeMock).toHaveBeenCalledTimes(2);
      expect(executeMock.mock.calls[0][0]).toBe("Hello");
      expect(executeMock.mock.calls[1][0]).toBe("What's my name?");

      // The second call should have history in its options
      const secondCallOptions = executeMock.mock.calls[1][1];
      expect(secondCallOptions).toHaveProperty("history");
      expect(secondCallOptions.history).toEqual(mockOperateResponse1.history);
    });

    it("merges provided history with instance history", async () => {
      // Mock the execute function
      const existingHistory = [
        {
          role: LlmMessageRole.User,
          content: "Previous message",
          type: LlmMessageType.Message,
        },
        {
          role: LlmMessageRole.Assistant,
          content: [
            { text: "Previous response", type: LlmMessageType.OutputText },
          ],
          type: LlmMessageType.Message,
          status: LlmResponseStatus.Completed,
        },
      ];

      const mockOperateResponse = {
        content: "Combined history response",
        history: [
          ...existingHistory,
          {
            role: LlmMessageRole.User,
            content: "New message",
            type: LlmMessageType.Message,
          },
          {
            role: LlmMessageRole.Assistant,
            content: [
              {
                text: "Combined history response",
                type: LlmMessageType.OutputText,
              },
            ],
            type: LlmMessageType.Message,
            status: LlmResponseStatus.Completed,
          },
        ],
        model: "gpt-4o",
        output: [],
        provider: "openai",
        responses: [],
        status: LlmResponseStatus.Completed,
        usage: [
          {
            input: 1,
            output: 1,
            reasoning: 0,
            total: 2,
            provider: "openai",
            model: "gpt-4o",
          },
        ],
      };

      executeMock.mockResolvedValue(mockOperateResponse);

      const provider = new OpenAiProvider();

      // Set the conversation history directly for testing
      provider["conversationHistory"] = [
        ...existingHistory,
      ] as LlmHistoryItem[];

      // Provide additional history in the options
      const additionalHistory: LlmInputMessage[] = [
        {
          role: LlmMessageRole.User,
          content: "Additional context",
          type: LlmMessageType.Message,
        },
      ];

      await provider.operate("New message", { history: additionalHistory });

      // Check that both histories were merged
      expect(executeMock).toHaveBeenCalledTimes(1);
      const options = executeMock.mock.calls[0][1];
      expect(options).toHaveProperty("history");
      expect(options.history).toEqual([
        ...existingHistory,
        ...additionalHistory,
      ]);
    });

    it("updates conversation history after each operate call", async () => {
      // Mock the execute function
      const mockOperateResponse = {
        content: "Response content",
        history: [
          {
            role: LlmMessageRole.User,
            content: "Test message",
            type: LlmMessageType.Message,
          },
          {
            role: LlmMessageRole.Assistant,
            content: [
              { text: "Response content", type: LlmMessageType.OutputText },
            ],
            type: LlmMessageType.Message,
            status: LlmResponseStatus.Completed,
          },
        ],
        model: "gpt-4o",
        output: [],
        provider: "openai",
        responses: [],
        status: LlmResponseStatus.Completed,
        usage: [
          {
            input: 1,
            output: 1,
            reasoning: 0,
            total: 2,
            provider: "openai",
            model: "gpt-4o",
          },
        ],
      };

      executeMock.mockResolvedValue(mockOperateResponse);

      const provider = new OpenAiProvider();

      await provider.operate("Test message");

      // Check that the conversation history was updated
      expect(provider["conversationHistory"]).toEqual(
        mockOperateResponse.history,
      );
    });
  });
});
