import { getEnvSecret } from "@jaypie/aws";
import { GoogleGenAI } from "@google/genai";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GeminiProvider } from "../GeminiProvider.class";
import {
  LlmHistoryItem,
  LlmInputMessage,
  LlmMessageRole,
  LlmMessageType,
  LlmResponseStatus,
} from "../../../types/LlmProvider.interface.js";

// Mock the operate module
vi.mock("@google/genai");

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

describe("GeminiProvider", () => {
  beforeEach(() => {
    vi.mocked(GoogleGenAI).mockImplementation(
      () =>
        ({
          models: {
            generateContent: vi.fn(),
          },
        }) as any,
    );
    vi.mocked(getEnvSecret).mockResolvedValue("test-key");
  });

  describe("Base Cases", () => {
    it("is a Class", () => {
      expect(GeminiProvider).toBeFunction();
    });

    it("Works", () => {
      const provider = new GeminiProvider();
      expect(provider).toBeInstanceOf(GeminiProvider);
    });
  });

  describe("Error Conditions", () => {
    beforeEach(() => {
      vi.mocked(getEnvSecret).mockResolvedValue(null as unknown as string);
    });

    it("throws ConfigurationError when API key is missing", async () => {
      const provider = new GeminiProvider();
      expect(async () => provider.send("test")).toThrowConfigurationError();
    });
  });

  describe("Happy Paths", () => {
    beforeEach(() => {
      vi.mocked(getEnvSecret).mockResolvedValue("test-key");
    });

    it("sends messages to Gemini", async () => {
      const mockResponse = {
        text: "test response",
      };

      const mockGenerateContent = vi.fn().mockResolvedValue(mockResponse);
      vi.mocked(GoogleGenAI).mockImplementation(
        () =>
          ({
            models: {
              generateContent: mockGenerateContent,
            },
          }) as any,
      );

      const provider = new GeminiProvider();
      const response = await provider.send("test message");

      expect(response).toBe("test response");
      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: expect.any(String),
        contents: [{ role: "user", parts: [{ text: "test message" }] }],
        config: undefined,
      });
    });
  });

  describe("Features", () => {
    describe("Structured Output", () => {
      it("Uses JSON mime type when structured output is requested", async () => {
        const mockParsedResponse = {
          salutation: "Hello",
          name: "World",
        };

        const mockResponse = {
          text: JSON.stringify(mockParsedResponse),
        };

        const mockGenerateContent = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(GoogleGenAI).mockImplementation(
          () =>
            ({
              models: {
                generateContent: mockGenerateContent,
              },
            }) as any,
        );

        const provider = new GeminiProvider();
        const response = await provider.send("Hello, World", {
          response: { salutation: String, name: String },
        });

        expect(response).toEqual(mockParsedResponse);
        expect(mockGenerateContent).toHaveBeenCalledWith({
          model: expect.any(String),
          contents: [{ role: "user", parts: [{ text: "Hello, World" }] }],
          config: { responseMimeType: "application/json" },
        });
      });

      it("Strips code fences from JSON response (Issue #211)", async () => {
        const mockParsedResponse = {
          Decision: "Yes",
          Summary: "Test",
          Confidence: 0.9,
        };

        const mockResponse = {
          text:
            "```json\n" + JSON.stringify(mockParsedResponse) + "\n```",
        };

        const mockGenerateContent = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(GoogleGenAI).mockImplementation(
          () =>
            ({
              models: {
                generateContent: mockGenerateContent,
              },
            }) as any,
        );

        const provider = new GeminiProvider();
        const response = await provider.send("Hello", {
          response: { Decision: String, Summary: String, Confidence: Number },
        });

        expect(response).toEqual(mockParsedResponse);
        expect(typeof response).toBe("object");
      });

      it("Returns raw text if JSON parsing fails", async () => {
        const mockResponse = {
          text: "Not valid JSON",
        };

        const mockGenerateContent = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(GoogleGenAI).mockImplementation(
          () =>
            ({
              models: {
                generateContent: mockGenerateContent,
              },
            }) as any,
        );

        const provider = new GeminiProvider();
        const response = await provider.send("Hello", {
          response: { name: String },
        });

        expect(response).toBe("Not valid JSON");
      });
    });

    describe("Message Options", () => {
      it("includes system instruction when provided", async () => {
        const mockResponse = {
          text: "test response",
        };

        const mockGenerateContent = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(GoogleGenAI).mockImplementation(
          () =>
            ({
              models: {
                generateContent: mockGenerateContent,
              },
            }) as any,
        );

        const provider = new GeminiProvider();
        const response = await provider.send("test message", {
          system: "You are a test assistant",
        });

        expect(response).toBe("test response");
        expect(mockGenerateContent).toHaveBeenCalledWith({
          model: expect.any(String),
          contents: [{ role: "user", parts: [{ text: "test message" }] }],
          config: { systemInstruction: "You are a test assistant" },
        });
      });

      it("applies placeholders to user message", async () => {
        const mockResponse = {
          text: "test response",
        };

        const mockGenerateContent = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(GoogleGenAI).mockImplementation(
          () =>
            ({
              models: {
                generateContent: mockGenerateContent,
              },
            }) as any,
        );

        const provider = new GeminiProvider();
        const response = await provider.send("Hello, {{name}}", {
          data: { name: "World" },
        });

        expect(response).toBe("test response");
        expect(mockGenerateContent).toHaveBeenCalledWith({
          model: expect.any(String),
          contents: [{ role: "user", parts: [{ text: "Hello, World" }] }],
          config: undefined,
        });
      });

      it("respects placeholders.message option", async () => {
        const mockResponse = {
          text: "test response",
        };

        const mockGenerateContent = vi.fn().mockResolvedValue(mockResponse);
        vi.mocked(GoogleGenAI).mockImplementation(
          () =>
            ({
              models: {
                generateContent: mockGenerateContent,
              },
            }) as any,
        );

        const provider = new GeminiProvider();
        const response = await provider.send("Hello, {{name}}", {
          data: { name: "World" },
          placeholders: { message: false },
        });

        expect(response).toBe("test response");
        expect(mockGenerateContent).toHaveBeenCalledWith({
          model: expect.any(String),
          contents: [{ role: "user", parts: [{ text: "Hello, {{name}}" }] }],
          config: undefined,
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
            content: "Hello, I'm an AI assistant",
            type: LlmMessageType.Message,
          },
        ],
        model: "gemini-2.5-flash",
        output: [],
        provider: "gemini",
        responses: [],
        status: LlmResponseStatus.Completed,
        usage: [
          {
            input: 1,
            output: 1,
            reasoning: 0,
            total: 2,
            provider: "gemini",
            model: "gemini-2.5-flash",
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
            content: "Hello, I'm an AI assistant",
            type: LlmMessageType.Message,
          },
          {
            role: LlmMessageRole.User,
            content: "What's my name?",
            type: LlmMessageType.Message,
          },
          {
            role: LlmMessageRole.Assistant,
            content: "Your name is John",
            type: LlmMessageType.Message,
          },
        ],
        model: "gemini-2.5-flash",
        output: [],
        provider: "gemini",
        responses: [],
        status: LlmResponseStatus.Completed,
        usage: [
          {
            input: 1,
            output: 1,
            reasoning: 0,
            total: 2,
            provider: "gemini",
            model: "gemini-2.5-flash",
          },
        ],
      };

      // Set up the mock responses
      executeMock
        .mockResolvedValueOnce(mockOperateResponse1)
        .mockResolvedValueOnce(mockOperateResponse2);

      const provider = new GeminiProvider();

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
          content: "Previous response",
          type: LlmMessageType.Message,
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
            content: "Combined history response",
            type: LlmMessageType.Message,
          },
        ],
        model: "gemini-2.5-flash",
        output: [],
        provider: "gemini",
        responses: [],
        status: LlmResponseStatus.Completed,
        usage: [
          {
            input: 1,
            output: 1,
            reasoning: 0,
            total: 2,
            provider: "gemini",
            model: "gemini-2.5-flash",
          },
        ],
      };

      executeMock.mockResolvedValue(mockOperateResponse);

      const provider = new GeminiProvider();

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
            content: "Response content",
            type: LlmMessageType.Message,
          },
        ],
        model: "gemini-2.5-flash",
        output: [],
        provider: "gemini",
        responses: [],
        status: LlmResponseStatus.Completed,
        usage: [
          {
            input: 1,
            output: 1,
            reasoning: 0,
            total: 2,
            provider: "gemini",
            model: "gemini-2.5-flash",
          },
        ],
      };

      executeMock.mockResolvedValue(mockOperateResponse);

      const provider = new GeminiProvider();

      await provider.operate("Test message");

      // Check that the conversation history was updated
      expect(provider["conversationHistory"]).toEqual(
        mockOperateResponse.history,
      );
    });
  });
});
