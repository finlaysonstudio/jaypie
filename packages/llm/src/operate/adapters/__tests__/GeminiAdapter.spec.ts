import { describe, expect, it, vi } from "vitest";

import { GeminiAdapter, geminiAdapter } from "../GeminiAdapter.js";
import { PROVIDER } from "../../../constants.js";
import { Toolkit } from "../../../tools/Toolkit.class.js";
import { ErrorCategory, OperateRequest } from "../../types.js";
import {
  LlmMessageRole,
  LlmMessageType,
} from "../../../types/LlmProvider.interface.js";

//
//
// Mock
//

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(),
}));

vi.mock("zod/v4", () => ({
  z: {
    ZodType: class ZodType {},
    toJSONSchema: vi.fn(() => ({ type: "object", properties: {} })),
  },
}));

//
//
// Tests
//

describe("GeminiAdapter", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("exports GeminiAdapter class", () => {
      expect(GeminiAdapter).toBeDefined();
      expect(typeof GeminiAdapter).toBe("function");
    });

    it("exports geminiAdapter singleton", () => {
      expect(geminiAdapter).toBeDefined();
      expect(geminiAdapter).toBeInstanceOf(GeminiAdapter);
    });

    it("has correct name", () => {
      expect(geminiAdapter.name).toBe(PROVIDER.GEMINI.NAME);
    });

    it("has correct default model", () => {
      expect(geminiAdapter.defaultModel).toBe(PROVIDER.GEMINI.MODEL.DEFAULT);
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    describe("buildRequest", () => {
      it("builds basic request", () => {
        const request: OperateRequest = {
          model: PROVIDER.GEMINI.MODEL.SMALL,
          messages: [
            {
              content: "Hello",
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
            },
          ],
        };

        const result = geminiAdapter.buildRequest(request);

        expect(result.model).toBe(PROVIDER.GEMINI.MODEL.SMALL);
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].role).toBe("user");
        expect(result.contents[0].parts?.[0].text).toBe("Hello");
      });

      it("includes system instruction when provided", () => {
        const request: OperateRequest = {
          model: PROVIDER.GEMINI.MODEL.SMALL,
          messages: [],
          system: "You are helpful",
        };

        const result = geminiAdapter.buildRequest(request);

        expect(result.config?.systemInstruction).toBe("You are helpful");
      });

      it("appends instructions to last message", () => {
        const request: OperateRequest = {
          model: PROVIDER.GEMINI.MODEL.SMALL,
          messages: [
            {
              content: "Hello",
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
            },
          ],
          instructions: "Be concise",
        };

        const result = geminiAdapter.buildRequest(request);

        expect(result.contents[0].parts?.[0].text).toContain("Hello");
        expect(result.contents[0].parts?.[0].text).toContain("Be concise");
      });

      it("includes tools when provided", () => {
        const request: OperateRequest = {
          model: PROVIDER.GEMINI.MODEL.SMALL,
          messages: [],
          tools: [
            {
              name: "test_tool",
              description: "A test tool",
              parameters: { type: "object" },
            },
          ],
        };

        const result = geminiAdapter.buildRequest(request);

        expect(result.config?.tools).toHaveLength(1);
        expect(result.config?.tools?.[0].functionDeclarations).toHaveLength(1);
        expect(result.config?.tools?.[0].functionDeclarations?.[0].name).toBe(
          "test_tool",
        );
      });

      it("includes format when provided", () => {
        const request: OperateRequest = {
          model: PROVIDER.GEMINI.MODEL.SMALL,
          messages: [],
          format: { type: "object", properties: { name: { type: "string" } } },
        };

        const result = geminiAdapter.buildRequest(request);

        expect(result.config?.responseMimeType).toBe("application/json");
        expect(result.config?.responseJsonSchema).toEqual({
          type: "object",
          properties: { name: { type: "string" } },
        });
      });
    });

    describe("parseResponse", () => {
      it("parses response with text content", () => {
        const response = {
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Hello there!" }],
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20,
            totalTokenCount: 30,
          },
        };

        const result = geminiAdapter.parseResponse(response);

        expect(result.content).toBe("Hello there!");
        expect(result.hasToolCalls).toBe(false);
        expect(result.stopReason).toBe("STOP");
      });

      it("detects function calls", () => {
        const response = {
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    functionCall: {
                      name: "test_tool",
                      args: { key: "value" },
                    },
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20,
            totalTokenCount: 30,
          },
        };

        const result = geminiAdapter.parseResponse(response);

        expect(result.hasToolCalls).toBe(true);
      });
    });

    describe("extractToolCalls", () => {
      it("extracts function calls from response", () => {
        const response = {
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    functionCall: {
                      name: "test_tool",
                      args: { key: "value" },
                      id: "call-123",
                    },
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
        };

        const result = geminiAdapter.extractToolCalls(response);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("test_tool");
        expect(result[0].callId).toBe("call-123");
        expect(result[0].arguments).toBe('{"key":"value"}');
      });

      it("returns empty array when no function calls", () => {
        const response = {
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Hello" }],
              },
              finishReason: "STOP",
            },
          ],
        };

        const result = geminiAdapter.extractToolCalls(response);

        expect(result).toHaveLength(0);
      });

      it("generates callId when not provided", () => {
        const response = {
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    functionCall: {
                      name: "test_tool",
                      args: {},
                    },
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
        };

        const result = geminiAdapter.extractToolCalls(response);

        expect(result).toHaveLength(1);
        expect(result[0].callId).toMatch(/^call_\d+_[a-z0-9]+$/);
      });
    });

    describe("extractUsage", () => {
      it("extracts usage from response", () => {
        const response = {
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 200,
            totalTokenCount: 300,
            thoughtsTokenCount: 50,
          },
        };

        const result = geminiAdapter.extractUsage(
          response,
          PROVIDER.GEMINI.MODEL.SMALL,
        );

        expect(result.input).toBe(100);
        expect(result.output).toBe(200);
        expect(result.total).toBe(300);
        expect(result.reasoning).toBe(50);
        expect(result.provider).toBe(PROVIDER.GEMINI.NAME);
        expect(result.model).toBe(PROVIDER.GEMINI.MODEL.SMALL);
      });

      it("returns zeros when no usage metadata", () => {
        const response = {};

        const result = geminiAdapter.extractUsage(
          response,
          PROVIDER.GEMINI.MODEL.SMALL,
        );

        expect(result.input).toBe(0);
        expect(result.output).toBe(0);
        expect(result.total).toBe(0);
        expect(result.reasoning).toBe(0);
      });
    });
  });

  // Features
  describe("Features", () => {
    describe("formatTools", () => {
      it("formats toolkit to provider definitions", () => {
        const toolkit = new Toolkit([
          {
            name: "test",
            description: "Test tool",
            parameters: { type: "object" },
            type: "function",
            call: vi.fn(),
          },
        ]);

        const result = geminiAdapter.formatTools(toolkit);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("test");
        expect(result[0].description).toBe("Test tool");
      });

      it("adds structured output tool when schema provided", () => {
        const toolkit = new Toolkit([
          {
            name: "test",
            description: "Test tool",
            parameters: { type: "object" },
            type: "function",
            call: vi.fn(),
          },
        ]);
        const schema = {
          type: "object",
          properties: { name: { type: "string" } },
        };

        const result = geminiAdapter.formatTools(toolkit, schema);

        expect(result).toHaveLength(2);
        expect(result[1].name).toBe("structured_output");
      });
    });

    describe("formatToolResult", () => {
      it("formats tool result correctly", () => {
        const toolCall = {
          callId: "call-123",
          name: "test_tool",
          arguments: "{}",
          raw: {},
        };
        const result = {
          callId: "call-123",
          output: '{"result": "success"}',
          success: true,
        };

        const formatted = geminiAdapter.formatToolResult(toolCall, result);

        expect(formatted.functionResponse?.name).toBe("test_tool");
        // The output is JSON-parsed, so response contains the parsed object
        expect(formatted.functionResponse?.response).toEqual({
          result: "success",
        });
      });
    });

    describe("isComplete", () => {
      it("returns true when no function calls", () => {
        const response = {
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Done" }],
              },
              finishReason: "STOP",
            },
          ],
        };

        expect(geminiAdapter.isComplete(response)).toBe(true);
      });

      it("returns false when function calls present", () => {
        const response = {
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    functionCall: {
                      name: "test_tool",
                      args: {},
                    },
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
        };

        expect(geminiAdapter.isComplete(response)).toBe(false);
      });

      it("returns true when no candidates", () => {
        const response = {};

        expect(geminiAdapter.isComplete(response)).toBe(true);
      });
    });

    describe("hasStructuredOutput", () => {
      it("returns true when structured_output function call is present", () => {
        const response = {
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    functionCall: {
                      name: "structured_output",
                      args: { key: "value" },
                    },
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
        };

        expect(geminiAdapter.hasStructuredOutput(response)).toBe(true);
      });

      it("returns false for regular function calls", () => {
        const response = {
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    functionCall: {
                      name: "other_tool",
                      args: {},
                    },
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
        };

        expect(geminiAdapter.hasStructuredOutput(response)).toBe(false);
      });
    });

    describe("extractStructuredOutput", () => {
      it("extracts structured output from response", () => {
        const response = {
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    functionCall: {
                      name: "structured_output",
                      args: { name: "John", age: 30 },
                    },
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
        };

        const result = geminiAdapter.extractStructuredOutput(response);

        expect(result).toEqual({ name: "John", age: 30 });
      });

      it("returns undefined for non-structured responses", () => {
        const response = {
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Hello" }],
              },
              finishReason: "STOP",
            },
          ],
        };

        const result = geminiAdapter.extractStructuredOutput(response);

        expect(result).toBeUndefined();
      });
    });

    describe("classifyError", () => {
      it("classifies rate limit error by status code", () => {
        const error = { status: 429, message: "Rate limit exceeded" };

        const result = geminiAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.RateLimit);
        expect(result.shouldRetry).toBe(false);
        expect(result.suggestedDelayMs).toBe(60000);
      });

      it("classifies retryable error by status code", () => {
        const error = { status: 500, message: "Internal server error" };

        const result = geminiAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Retryable);
        expect(result.shouldRetry).toBe(true);
      });

      it("classifies unrecoverable error by status code", () => {
        const error = { status: 401, message: "Unauthorized" };

        const result = geminiAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Unrecoverable);
        expect(result.shouldRetry).toBe(false);
      });

      it("classifies rate limit by error message", () => {
        const error = { message: "quota exceeded for this resource" };

        const result = geminiAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.RateLimit);
        expect(result.shouldRetry).toBe(false);
      });

      it("classifies connection error as retryable", () => {
        const error = { message: "ECONNREFUSED" };

        const result = geminiAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Retryable);
        expect(result.shouldRetry).toBe(true);
      });

      it("classifies unknown error as potentially retryable", () => {
        const error = new Error("Unknown error");

        const result = geminiAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Unknown);
        expect(result.shouldRetry).toBe(true);
      });
    });

    describe("responseToHistoryItems", () => {
      it("returns empty array for function call response", () => {
        const response = {
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    functionCall: {
                      name: "test_tool",
                      args: {},
                    },
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
        };

        const result = geminiAdapter.responseToHistoryItems(response);

        expect(result).toHaveLength(0);
      });

      it("extracts text content for non-tool responses", () => {
        const response = {
          candidates: [
            {
              content: {
                role: "model",
                parts: [{ text: "Hello there!" }],
              },
              finishReason: "STOP",
            },
          ],
        };

        const result = geminiAdapter.responseToHistoryItems(response);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          content: "Hello there!",
          role: LlmMessageRole.Assistant,
          type: LlmMessageType.Message,
        });
      });

      it("excludes thought parts from history", () => {
        const response = {
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  { text: "Let me think...", thought: true },
                  { text: "Hello!" },
                ],
              },
              finishReason: "STOP",
            },
          ],
        };

        const result = geminiAdapter.responseToHistoryItems(response);

        expect(result).toHaveLength(1);
        expect((result[0] as any).content).toBe("Hello!");
      });
    });
  });

  // AbortSignal Support
  describe("AbortSignal Support", () => {
    describe("executeRequest", () => {
      it("suppresses errors after signal is aborted", async () => {
        const controller = new AbortController();
        controller.abort("retry");

        const mockGenerateContent = vi
          .fn()
          .mockRejectedValue(new TypeError("terminated"));
        const mockClient = {
          models: { generateContent: mockGenerateContent },
        };
        const request = {
          model: "gemini-2.0-flash",
          contents: [],
        };

        const result = await geminiAdapter.executeRequest(
          mockClient,
          request,
          controller.signal,
        );

        expect(result).toBeUndefined();
      });

      it("throws errors when signal is not aborted", async () => {
        const controller = new AbortController();

        const mockGenerateContent = vi
          .fn()
          .mockRejectedValue(new Error("real error"));
        const mockClient = {
          models: { generateContent: mockGenerateContent },
        };
        const request = {
          model: "gemini-2.0-flash",
          contents: [],
        };

        await expect(
          geminiAdapter.executeRequest(
            mockClient,
            request,
            controller.signal,
          ),
        ).rejects.toThrow("real error");
      });
    });
  });

  // Specific Scenarios
  describe("Specific Scenarios", () => {
    it("uses default model when not specified", () => {
      const request: OperateRequest = {
        model: "",
        messages: [],
      };

      const result = geminiAdapter.buildRequest(request);

      expect(result.model).toBe(PROVIDER.GEMINI.MODEL.DEFAULT);
    });

    it("sets temperature in config when provided", () => {
      const request: OperateRequest = {
        model: PROVIDER.GEMINI.MODEL.SMALL,
        messages: [
          {
            content: "Hello",
            role: LlmMessageRole.User,
            type: LlmMessageType.Message,
          },
        ],
        temperature: 0.7,
      };

      const result = geminiAdapter.buildRequest(request);

      expect(result.config?.temperature).toBe(0.7);
    });

    it("temperature takes precedence over providerOptions", () => {
      const request: OperateRequest = {
        model: PROVIDER.GEMINI.MODEL.SMALL,
        messages: [],
        providerOptions: { temperature: 0.3 },
        temperature: 0.9,
      };

      const result = geminiAdapter.buildRequest(request);

      expect(result.config?.temperature).toBe(0.9);
    });

    describe("parseResponse with code-fenced JSON (Issue #211)", () => {
      it("parses code-fenced JSON when format is provided", () => {
        const jsonData = { Decision: "Yes", Summary: "Test", Confidence: 0.9 };
        const response = {
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    text: "```json\n" + JSON.stringify(jsonData) + "\n```",
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20,
            totalTokenCount: 30,
          },
        };

        const result = geminiAdapter.parseResponse(response, {
          format: { type: "object" },
        });

        expect(result.content).toEqual(jsonData);
        expect(typeof result.content).toBe("object");
      });

      it("parses code-fenced JSON with extra whitespace", () => {
        const jsonData = { name: "test" };
        const response = {
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    text:
                      "```json\n  " + JSON.stringify(jsonData) + "  \n```",
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20,
            totalTokenCount: 30,
          },
        };

        const result = geminiAdapter.parseResponse(response, {
          format: { type: "object" },
        });

        expect(result.content).toEqual(jsonData);
      });

      it("parses plain code-fenced content (no json tag)", () => {
        const jsonData = { key: "value" };
        const response = {
          candidates: [
            {
              content: {
                role: "model",
                parts: [
                  {
                    text: "```\n" + JSON.stringify(jsonData) + "\n```",
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20,
            totalTokenCount: 30,
          },
        };

        const result = geminiAdapter.parseResponse(response, {
          format: { type: "object" },
        });

        expect(result.content).toEqual(jsonData);
      });
    });

    it("does not set temperature when not provided", () => {
      const request: OperateRequest = {
        model: PROVIDER.GEMINI.MODEL.SMALL,
        messages: [],
      };

      const result = geminiAdapter.buildRequest(request);

      expect(result.config?.temperature).toBeUndefined();
    });

    it("maps assistant role to model", () => {
      const request: OperateRequest = {
        model: PROVIDER.GEMINI.MODEL.SMALL,
        messages: [
          {
            content: "Previous response",
            role: LlmMessageRole.Assistant,
            type: LlmMessageType.Message,
          },
        ],
      };

      const result = geminiAdapter.buildRequest(request);

      expect(result.contents[0].role).toBe("model");
    });

    it("maps system role to user for contents", () => {
      const request: OperateRequest = {
        model: PROVIDER.GEMINI.MODEL.SMALL,
        messages: [
          {
            content: "System message",
            role: LlmMessageRole.System,
            type: LlmMessageType.Message,
          },
        ],
      };

      const result = geminiAdapter.buildRequest(request);

      // System messages in contents become user messages
      // (system instruction should be used via config.systemInstruction)
      expect(result.contents[0].role).toBe("user");
    });

    it("handles function call history items", () => {
      const request: OperateRequest = {
        model: PROVIDER.GEMINI.MODEL.SMALL,
        messages: [
          {
            type: LlmMessageType.FunctionCall,
            name: "test_tool",
            arguments: '{"key":"value"}',
            call_id: "call-123",
          } as any,
        ],
      };

      const result = geminiAdapter.buildRequest(request);

      expect(result.contents[0].role).toBe("model");
      expect(result.contents[0].parts?.[0].functionCall?.name).toBe(
        "test_tool",
      );
    });

    it("handles function call output history items", () => {
      const request: OperateRequest = {
        model: PROVIDER.GEMINI.MODEL.SMALL,
        messages: [
          {
            type: LlmMessageType.FunctionCallOutput,
            output: '{"result":"success"}',
          } as any,
        ],
      };

      const result = geminiAdapter.buildRequest(request);

      expect(result.contents[0].role).toBe("user");
      expect(result.contents[0].parts?.[0].functionResponse).toBeDefined();
    });
  });
});
