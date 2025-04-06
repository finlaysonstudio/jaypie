import { getEnvSecret } from "@jaypie/aws";
import { OpenAI } from "openai";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { OpenAiProvider } from "../OpenAiProvider.class";

vi.mock("openai");

describe("OpenAiProvider", () => {
  beforeEach(() => {
    vi.mocked(OpenAI).mockImplementation(
      () =>
        ({
          beta: {
            chat: {
              completions: {
                parse: vi.fn(),
              },
            },
          },
          chat: {
            completions: {
              create: vi.fn(),
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
      it("Uses beta endpoint when structured output is requested", async () => {
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
              beta: {
                chat: {
                  completions: {
                    parse: mockParse,
                  },
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
              beta: {
                chat: {
                  completions: {
                    parse: mockParse,
                  },
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
    it("maintains conversation history across operate calls", async () => {
      // Mock the operate function to return a history
      const mockOperateResponse1 = {
        content: "Hello, I'm an AI assistant",
        history: [
          { role: "user", content: "Hello", type: "message" },
          {
            role: "assistant",
            content: [
              { text: "Hello, I'm an AI assistant", type: "output_text" },
            ],
            type: "message",
            status: "completed",
          },
        ],
        output: [],
        responses: [],
        status: "completed",
        usage: { input: 1, output: 1, reasoning: 0, total: 2 },
      };

      const mockOperateResponse2 = {
        content: "Your name is John",
        history: [
          { role: "user", content: "Hello", type: "message" },
          {
            role: "assistant",
            content: [
              { text: "Hello, I'm an AI assistant", type: "output_text" },
            ],
            type: "message",
            status: "completed",
          },
          { role: "user", content: "What's my name?", type: "message" },
          {
            role: "assistant",
            content: [{ text: "Your name is John", type: "output_text" }],
            type: "message",
            status: "completed",
          },
        ],
        output: [],
        responses: [],
        status: "completed",
        usage: { input: 1, output: 1, reasoning: 0, total: 2 },
      };

      // Create a spy on the operate module
      const operateSpy = vi
        .fn()
        .mockResolvedValueOnce(mockOperateResponse1)
        .mockResolvedValueOnce(mockOperateResponse2);

      // Replace the imported operate function with our spy
      vi.mock("../operate.js", () => ({
        operate: operateSpy,
      }));

      const provider = new OpenAiProvider();

      // First operate call
      await provider.operate("Hello");

      // Second operate call should include history from first call
      await provider.operate("What's my name?");

      // Check that the second call included the history from the first call
      expect(operateSpy).toHaveBeenCalledTimes(2);
      expect(operateSpy.mock.calls[0][0]).toBe("Hello");
      expect(operateSpy.mock.calls[1][0]).toBe("What's my name?");

      // The second call should have history in its options
      const secondCallOptions = operateSpy.mock.calls[1][1];
      expect(secondCallOptions).toHaveProperty("history");
      expect(secondCallOptions.history).toEqual(mockOperateResponse1.history);
    });

    it("merges provided history with instance history", async () => {
      // Mock the operate function
      const existingHistory = [
        { role: "user", content: "Previous message", type: "message" },
        {
          role: "assistant",
          content: [{ text: "Previous response", type: "output_text" }],
          type: "message",
          status: "completed",
        },
      ];

      const mockOperateResponse = {
        content: "Combined history response",
        history: [
          ...existingHistory,
          { role: "user", content: "New message", type: "message" },
          {
            role: "assistant",
            content: [
              { text: "Combined history response", type: "output_text" },
            ],
            type: "message",
            status: "completed",
          },
        ],
        output: [],
        responses: [],
        status: "completed",
        usage: { input: 1, output: 1, reasoning: 0, total: 2 },
      };

      const operateSpy = vi.fn().mockResolvedValue(mockOperateResponse);
      vi.mock("../operate.js", () => ({
        operate: operateSpy,
      }));

      const provider = new OpenAiProvider();

      // Set the conversation history directly for testing
      provider["conversationHistory"] = [...existingHistory];

      // Provide additional history in the options
      const additionalHistory = [
        { role: "user", content: "Additional context", type: "message" },
      ];

      await provider.operate("New message", { history: additionalHistory });

      // Check that both histories were merged
      expect(operateSpy).toHaveBeenCalledTimes(1);
      const options = operateSpy.mock.calls[0][1];
      expect(options).toHaveProperty("history");
      expect(options.history).toEqual([
        ...existingHistory,
        ...additionalHistory,
      ]);
    });

    it("updates conversation history after each operate call", async () => {
      // Mock the operate function
      const mockOperateResponse = {
        content: "Response content",
        history: [
          { role: "user", content: "Test message", type: "message" },
          {
            role: "assistant",
            content: [{ text: "Response content", type: "output_text" }],
            type: "message",
            status: "completed",
          },
        ],
        output: [],
        responses: [],
        status: "completed",
        usage: { input: 1, output: 1, reasoning: 0, total: 2 },
      };

      const operateSpy = vi.fn().mockResolvedValue(mockOperateResponse);
      vi.mock("../operate.js", () => ({
        operate: operateSpy,
      }));

      const provider = new OpenAiProvider();

      await provider.operate("Test message");

      // Check that the conversation history was updated
      expect(provider["conversationHistory"]).toEqual(
        mockOperateResponse.history,
      );
    });
  });
});
