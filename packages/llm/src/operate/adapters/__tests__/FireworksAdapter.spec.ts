import { describe, expect, it, vi } from "vitest";

import { log } from "@jaypie/logger";

import { FireworksAdapter, fireworksAdapter } from "../FireworksAdapter.js";
import { PROVIDER } from "../../../constants.js";
import { Toolkit } from "../../../tools/Toolkit.class.js";
import { ErrorCategory, OperateRequest } from "../../types.js";
import {
  LlmMessageRole,
  LlmMessageType,
} from "../../../types/LlmProvider.interface.js";
import { LlmStreamChunkType } from "../../../types/LlmStreamChunk.interface.js";

//
//
// Mock
//

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

describe("FireworksAdapter", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("exports FireworksAdapter class", () => {
      expect(FireworksAdapter).toBeDefined();
      expect(typeof FireworksAdapter).toBe("function");
    });

    it("exports fireworksAdapter singleton", () => {
      expect(fireworksAdapter).toBeDefined();
      expect(fireworksAdapter).toBeInstanceOf(FireworksAdapter);
    });

    it("has correct name", () => {
      expect(fireworksAdapter.name).toBe(PROVIDER.FIREWORKS.NAME);
    });

    it("has correct default model", () => {
      expect(fireworksAdapter.defaultModel).toBe(PROVIDER.FIREWORKS.DEFAULT);
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    describe("buildRequest", () => {
      it("builds basic request", () => {
        const request: OperateRequest = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [
            {
              content: "Hello",
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
            },
          ],
        };

        const result = fireworksAdapter.buildRequest(request);

        expect(result.model).toBe(PROVIDER.FIREWORKS.DEFAULT);
        expect(result.messages).toHaveLength(1);
      });

      it("includes system message when provided", () => {
        const request: OperateRequest = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [
            {
              content: "Hello",
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
            },
          ],
          system: "You are helpful",
        };

        const result = fireworksAdapter.buildRequest(request);

        expect(result.messages[0].role).toBe("system");
        expect(result.messages[0].content).toBe("You are helpful");
      });

      it("appends instructions to last message", () => {
        const request: OperateRequest = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [
            {
              content: "Hello",
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
            },
          ],
          instructions: "Be concise",
        };

        const result = fireworksAdapter.buildRequest(request);

        expect(result.messages[0].content).toContain("Hello");
        expect(result.messages[0].content).toContain("Be concise");
      });

      it("includes tools when provided", () => {
        const request: OperateRequest = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [],
          tools: [
            {
              name: "test_tool",
              description: "A test tool",
              parameters: { type: "object" },
            },
          ],
        };

        const result = fireworksAdapter.buildRequest(request);

        expect(result.tools).toHaveLength(1);
        expect(result.tools![0].type).toBe("function");
        expect(result.tools![0].function.name).toBe("test_tool");
        expect(result.tool_choice).toBe("auto");
      });

      it("includes user when provided", () => {
        const request: OperateRequest = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [],
          user: "user-123",
        };

        const result = fireworksAdapter.buildRequest(request);

        expect(result.user).toBe("user-123");
      });

      it("handles FunctionCall messages from StreamLoop", () => {
        const request: OperateRequest = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [
            {
              role: LlmMessageRole.User,
              content: "List items",
              type: LlmMessageType.Message,
            },
            // This is how StreamLoop adds tool calls to history
            {
              type: LlmMessageType.FunctionCall,
              name: "list_items",
              arguments: "{}",
              call_id: "call_123",
              id: "call_123",
            } as any,
          ],
        };

        const result = fireworksAdapter.buildRequest(request);

        expect(result.messages).toHaveLength(2);
        expect(result.messages[0].role).toBe("user");
        expect(result.messages[1].role).toBe("assistant");
        expect(result.messages[1].toolCalls).toEqual([
          {
            id: "call_123",
            type: "function",
            function: {
              name: "list_items",
              arguments: "{}",
            },
          },
        ]);
      });

      it("handles FunctionCallOutput messages from StreamLoop", () => {
        const request: OperateRequest = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [
            {
              role: LlmMessageRole.User,
              content: "List items",
              type: LlmMessageType.Message,
            },
            {
              type: LlmMessageType.FunctionCall,
              name: "list_items",
              arguments: "{}",
              call_id: "call_123",
              id: "call_123",
            } as any,
            // This is how StreamLoop adds tool results to history
            {
              type: LlmMessageType.FunctionCallOutput,
              output: '{"items":[{"id":"1"}]}',
              call_id: "call_123",
              name: "list_items",
            } as any,
          ],
        };

        const result = fireworksAdapter.buildRequest(request);

        expect(result.messages).toHaveLength(3);
        expect(result.messages[2].role).toBe("tool");
        expect(result.messages[2].toolCallId).toBe("call_123");
        expect(result.messages[2].content).toBe('{"items":[{"id":"1"}]}');
      });

      it("emits response_format json_schema when format is provided", () => {
        const adapter = new FireworksAdapter();
        const schema = {
          type: "object",
          properties: { name: { type: "string" } },
        };
        const request: OperateRequest = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [
            {
              content: "Hello",
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
            },
          ],
          format: schema,
        };

        const result = adapter.buildRequest(request);

        expect(result.response_format).toEqual({
          type: "json_schema",
          json_schema: {
            name: "response",
            schema,
            strict: true,
          },
        });
        expect(result.tools).toBeUndefined();
      });

      it("does not emit response_format when format is absent", () => {
        const request: OperateRequest = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [
            {
              content: "Hello",
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
            },
          ],
        };

        const result = fireworksAdapter.buildRequest(request);

        expect(result.response_format).toBeUndefined();
      });

      it("uses legacy structured_output tool when model is cached as unsupported", () => {
        const adapter = new FireworksAdapter();
        adapter.rememberModelRejectsStructuredOutput(
          PROVIDER.FIREWORKS.DEFAULT,
        );
        const schema = {
          type: "object",
          properties: { name: { type: "string" } },
        };
        const request: OperateRequest = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [
            {
              content: "Hello",
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
            },
          ],
          format: schema,
        };

        const result = adapter.buildRequest(request);

        expect(result.response_format).toBeUndefined();
        expect(result.tools).toBeDefined();
        expect(
          result.tools!.some((t) => t.function.name === "structured_output"),
        ).toBe(true);
        expect(result.tool_choice).toBe("auto");
      });
    });

    describe("parseResponse", () => {
      it("parses response with text content", () => {
        const response = {
          id: "resp-123",
          model: PROVIDER.FIREWORKS.DEFAULT,
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "Hello there!",
              },
              finishReason: "stop",
            },
          ],
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
        };

        const result = fireworksAdapter.parseResponse(response);

        expect(result.content).toBe("Hello there!");
        expect(result.hasToolCalls).toBe(false);
        expect(result.stopReason).toBe("stop");
      });

      it("detects tool use", () => {
        const response = {
          id: "resp-123",
          model: PROVIDER.FIREWORKS.DEFAULT,
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: null,
                toolCalls: [
                  {
                    id: "call-123",
                    type: "function",
                    function: { name: "test", arguments: "{}" },
                  },
                ],
              },
              finishReason: "toolCalls",
            },
          ],
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
        };

        const result = fireworksAdapter.parseResponse(response);

        expect(result.hasToolCalls).toBe(true);
      });
    });

    describe("extractToolCalls", () => {
      it("extracts tool calls from response", () => {
        const response = {
          id: "resp-123",
          model: PROVIDER.FIREWORKS.DEFAULT,
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: null,
                toolCalls: [
                  {
                    id: "call-123",
                    type: "function",
                    function: {
                      name: "test_tool",
                      arguments: '{"key":"value"}',
                    },
                  },
                ],
              },
              finishReason: "toolCalls",
            },
          ],
        };

        const result = fireworksAdapter.extractToolCalls(response);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("test_tool");
        expect(result[0].callId).toBe("call-123");
        expect(result[0].arguments).toBe('{"key":"value"}');
      });

      it("returns empty array when no tool calls", () => {
        const response = {
          id: "resp-123",
          model: PROVIDER.FIREWORKS.DEFAULT,
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "Hello",
              },
              finishReason: "stop",
            },
          ],
        };

        const result = fireworksAdapter.extractToolCalls(response);

        expect(result).toHaveLength(0);
      });
    });

    describe("extractUsage", () => {
      it("extracts usage from camelCase response", () => {
        const response = {
          usage: {
            promptTokens: 100,
            completionTokens: 200,
            totalTokens: 300,
          },
        };

        const result = fireworksAdapter.extractUsage(
          response,
          PROVIDER.FIREWORKS.DEFAULT,
        );

        expect(result.input).toBe(100);
        expect(result.output).toBe(200);
        expect(result.total).toBe(300);
        expect(result.reasoning).toBe(0);
        expect(result.provider).toBe(PROVIDER.FIREWORKS.NAME);
        expect(result.model).toBe(PROVIDER.FIREWORKS.DEFAULT);
      });

      it("extracts usage from snake_case response", () => {
        const response = {
          usage: {
            prompt_tokens: 11,
            completion_tokens: 22,
            total_tokens: 33,
          },
        };

        const result = fireworksAdapter.extractUsage(
          response,
          PROVIDER.FIREWORKS.DEFAULT,
        );

        expect(result.input).toBe(11);
        expect(result.output).toBe(22);
        expect(result.total).toBe(33);
      });

      it("extracts reasoning tokens from completionTokensDetails", () => {
        const response = {
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
            completionTokensDetails: { reasoningTokens: 7 },
          },
        };

        const result = fireworksAdapter.extractUsage(
          response,
          PROVIDER.FIREWORKS.DEFAULT,
        );

        expect(result.reasoning).toBe(7);
      });

      it("returns zeros when usage is missing", () => {
        const response = {};

        const result = fireworksAdapter.extractUsage(
          response,
          PROVIDER.FIREWORKS.DEFAULT,
        );

        expect(result.input).toBe(0);
        expect(result.output).toBe(0);
        expect(result.total).toBe(0);
      });
    });
  });

  // Features
  describe("Features", () => {
    describe("Effort", () => {
      it("sets top-level reasoning_effort translating the neutral scale", () => {
        const result = fireworksAdapter.buildRequest({
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [
            {
              content: "Hello",
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
            },
          ],
          effort: "medium",
        } as OperateRequest);

        expect(result.reasoning_effort).toBe("medium");
        expect(
          (result as unknown as Record<string, unknown>).reasoning,
        ).toBeUndefined();
      });

      it("papers highest onto high and logs at debug", () => {
        const debug = vi.spyOn(log, "debug").mockImplementation(() => {});
        const result = fireworksAdapter.buildRequest({
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [],
          effort: "highest",
        } as OperateRequest);

        expect(result.reasoning_effort).toBe("high");
        expect(debug).toHaveBeenCalledTimes(1);
        expect(debug.mock.calls[0][0]).toContain("highest");
        vi.restoreAllMocks();
      });

      it("papers lowest onto low", () => {
        const result = fireworksAdapter.buildRequest({
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [],
          effort: "lowest",
        } as OperateRequest);

        expect(result.reasoning_effort).toBe("low");
      });

      it("omits reasoning_effort when effort is absent", () => {
        const result = fireworksAdapter.buildRequest({
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [],
        });

        expect(result.reasoning_effort).toBeUndefined();
      });
    });

    describe("Content Conversion", () => {
      it("converts input text and image content", () => {
        const request: OperateRequest = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [
            {
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
              content: [
                { type: LlmMessageType.InputText, text: "What is this?" },
                {
                  type: LlmMessageType.InputImage,
                  image_url: "https://example.com/cat.png",
                },
              ],
            } as any,
          ],
        };

        const result = fireworksAdapter.buildRequest(request);

        expect(result.messages[0].content).toEqual([
          { type: "text", text: "What is this?" },
          {
            type: "image_url",
            imageUrl: { url: "https://example.com/cat.png" },
          },
        ]);
      });

      it("warns and drops input files (unsupported by Fireworks)", () => {
        const warn = vi.spyOn(log, "warn").mockImplementation(() => {});
        const request: OperateRequest = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [
            {
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
              content: [
                { type: LlmMessageType.InputText, text: "Read this" },
                {
                  type: LlmMessageType.InputFile,
                  filename: "doc.pdf",
                  file_data: "data:application/pdf;base64,AAAA",
                },
              ],
            } as any,
          ],
        };

        const result = fireworksAdapter.buildRequest(request);

        expect(result.messages[0].content).toEqual([
          { type: "text", text: "Read this" },
        ]);
        expect(warn).toHaveBeenCalled();
        vi.restoreAllMocks();
      });

      it("warns and drops image content missing image_url", () => {
        const warn = vi.spyOn(log, "warn").mockImplementation(() => {});
        const request: OperateRequest = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [
            {
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
              content: [{ type: LlmMessageType.InputImage }],
            } as any,
          ],
        };

        const result = fireworksAdapter.buildRequest(request);

        expect(result.messages[0].content).toBe("");
        expect(warn).toHaveBeenCalled();
        vi.restoreAllMocks();
      });
    });

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

        const result = fireworksAdapter.formatTools(toolkit);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("test");
        expect(result[0].description).toBe("Test tool");
      });

      it("does not inject a structured_output tool when schema provided", () => {
        // Native response_format replaces the fake-tool injection.
        // The legacy fake tool is only added in buildRequest as a fallback.
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

        const result = fireworksAdapter.formatTools(toolkit, schema);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("test");
        expect(result.some((t) => t.name === "structured_output")).toBe(false);
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

        const formatted = fireworksAdapter.formatToolResult(toolCall, result);

        expect(formatted.toolCallId).toBe("call-123");
        expect(formatted.content).toBe('{"result": "success"}');
        expect(formatted.role).toBe("tool");
      });
    });

    describe("appendToolResult", () => {
      it("appends assistant message and tool result", () => {
        const request = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [{ role: "user", content: "Hello" }],
        };
        const toolCall = {
          callId: "call-123",
          name: "test_tool",
          arguments: "{}",
          raw: {
            id: "call-123",
            type: "function",
            function: { name: "test_tool", arguments: "{}" },
          },
        };
        const result = {
          callId: "call-123",
          output: '{"result": "success"}',
          success: true,
        };

        const updated = fireworksAdapter.appendToolResult(
          request,
          toolCall,
          result,
        );

        expect(updated.messages).toHaveLength(3);
        expect(updated.messages[1].role).toBe("assistant");
        expect(updated.messages[1].toolCalls).toBeDefined();
        expect(updated.messages[2].role).toBe("tool");
        expect(updated.messages[2].toolCallId).toBe("call-123");
      });
    });

    describe("isComplete", () => {
      it("returns true when no tool calls", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: "Done",
              },
              finishReason: "stop",
            },
          ],
        };

        expect(fireworksAdapter.isComplete(response)).toBe(true);
      });

      it("returns false when tool calls present", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                toolCalls: [
                  {
                    id: "call-123",
                    type: "function",
                    function: { name: "test", arguments: "{}" },
                  },
                ],
              },
              finishReason: "toolCalls",
            },
          ],
        };

        expect(fireworksAdapter.isComplete(response)).toBe(false);
      });
    });

    describe("hasStructuredOutput", () => {
      it("returns true when native annotation is set with parseable JSON content", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: '{"name":"John"}',
              },
              finishReason: "stop",
            },
          ],
          __jaypieStructuredOutput: true,
        };

        expect(fireworksAdapter.hasStructuredOutput(response)).toBe(true);
      });

      it("returns false when native annotation is set but content is not JSON", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: "I cannot comply with that request.",
              },
              finishReason: "stop",
            },
          ],
          __jaypieStructuredOutput: true,
        };

        expect(fireworksAdapter.hasStructuredOutput(response)).toBe(false);
      });

      it("returns false when no tool calls", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: "Hello",
              },
              finishReason: "stop",
            },
          ],
        };

        expect(fireworksAdapter.hasStructuredOutput(response)).toBe(false);
      });

      describe("Fallback Path", () => {
        it("returns true when structured_output tool is used", () => {
          const response = {
            choices: [
              {
                message: {
                  role: "assistant",
                  content: null,
                  toolCalls: [
                    {
                      id: "call-123",
                      type: "function",
                      function: {
                        name: "structured_output",
                        arguments: '{"key":"value"}',
                      },
                    },
                  ],
                },
                finishReason: "toolCalls",
              },
            ],
          };

          expect(fireworksAdapter.hasStructuredOutput(response)).toBe(true);
        });

        it("returns false for regular tool use", () => {
          const response = {
            choices: [
              {
                message: {
                  role: "assistant",
                  content: null,
                  toolCalls: [
                    {
                      id: "call-123",
                      type: "function",
                      function: { name: "other_tool", arguments: "{}" },
                    },
                  ],
                },
                finishReason: "toolCalls",
              },
            ],
          };

          expect(fireworksAdapter.hasStructuredOutput(response)).toBe(false);
        });
      });
    });

    describe("extractStructuredOutput", () => {
      it("parses message content as JSON when native annotation is set", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: '{"name":"John","age":30}',
              },
              finishReason: "stop",
            },
          ],
          __jaypieStructuredOutput: true,
        };

        const result = fireworksAdapter.extractStructuredOutput(response);

        expect(result).toEqual({ name: "John", age: 30 });
      });

      it("returns undefined when native content is not parseable JSON", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: "not valid json",
              },
              finishReason: "stop",
            },
          ],
          __jaypieStructuredOutput: true,
        };

        const result = fireworksAdapter.extractStructuredOutput(response);

        expect(result).toBeUndefined();
      });

      it("returns undefined when native content is empty", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: "",
              },
              finishReason: "stop",
            },
          ],
          __jaypieStructuredOutput: true,
        };

        const result = fireworksAdapter.extractStructuredOutput(response);

        expect(result).toBeUndefined();
      });

      it("returns undefined for non-structured responses", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: "Hello",
              },
              finishReason: "stop",
            },
          ],
        };

        const result = fireworksAdapter.extractStructuredOutput(response);

        expect(result).toBeUndefined();
      });

      describe("Fallback Path", () => {
        it("extracts structured output from response", () => {
          const response = {
            choices: [
              {
                message: {
                  role: "assistant",
                  content: null,
                  toolCalls: [
                    {
                      id: "call-123",
                      type: "function",
                      function: {
                        name: "structured_output",
                        arguments: '{"name":"John","age":30}',
                      },
                    },
                  ],
                },
                finishReason: "toolCalls",
              },
            ],
          };

          const result = fireworksAdapter.extractStructuredOutput(response);

          expect(result).toEqual({ name: "John", age: 30 });
        });

        it("returns undefined for invalid JSON", () => {
          const response = {
            choices: [
              {
                message: {
                  role: "assistant",
                  content: null,
                  toolCalls: [
                    {
                      id: "call-123",
                      type: "function",
                      function: {
                        name: "structured_output",
                        arguments: "not valid json",
                      },
                    },
                  ],
                },
                finishReason: "toolCalls",
              },
            ],
          };

          const result = fireworksAdapter.extractStructuredOutput(response);

          expect(result).toBeUndefined();
        });
      });
    });

    describe("Structured-output fallback", () => {
      it("retries with fake tool when model rejects native response_format", async () => {
        const adapter = new FireworksAdapter();
        const schema = {
          type: "object",
          properties: { name: { type: "string" } },
        };
        const error = Object.assign(
          new Error("response_format not supported"),
          {
            status: 400,
          },
        );
        const successResponse = {
          id: "resp-1",
          object: "chat.completion",
          created: 0,
          model: PROVIDER.FIREWORKS.DEFAULT,
          choices: [
            {
              index: 0,
              message: {
                role: "assistant" as const,
                content: null,
                toolCalls: [
                  {
                    id: "call-1",
                    type: "function" as const,
                    function: {
                      name: "structured_output",
                      arguments: '{"name":"Jane"}',
                    },
                  },
                ],
              },
              finishReason: "toolCalls",
            },
          ],
        };
        const mockSend = vi
          .fn()
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce(successResponse);
        const mockClient = { chatCompletion: mockSend };
        const request: OperateRequest = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [
            {
              content: "Hi",
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
            },
          ],
          format: schema,
        };

        const built = adapter.buildRequest(request);
        expect(built.response_format).toBeDefined();

        const result = await adapter.executeRequest(mockClient, built);

        expect(mockSend).toHaveBeenCalledTimes(2);
        const fallbackCallParams = mockSend.mock.calls[1][0];
        expect(fallbackCallParams.response_format).toBeUndefined();
        expect(fallbackCallParams.tools).toBeDefined();
        expect(
          fallbackCallParams.tools.some(
            (t: { function: { name: string } }) =>
              t.function.name === "structured_output",
          ),
        ).toBe(true);
        expect(result).toBe(successResponse);
      });

      it("caches the model so subsequent calls use the fallback up-front", async () => {
        const adapter = new FireworksAdapter();
        adapter.rememberModelRejectsStructuredOutput(
          PROVIDER.FIREWORKS.DEFAULT,
        );
        const schema = {
          type: "object",
          properties: { name: { type: "string" } },
        };
        const request: OperateRequest = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [],
          format: schema,
        };

        const built = adapter.buildRequest(request);

        expect(built.response_format).toBeUndefined();
        expect(built.tools).toBeDefined();
        expect(
          built.tools!.some((t) => t.function.name === "structured_output"),
        ).toBe(true);
      });

      it("does not fall back on unrelated 400 errors", async () => {
        const adapter = new FireworksAdapter();
        const schema = {
          type: "object",
          properties: { name: { type: "string" } },
        };
        const error = Object.assign(new Error("invalid api key"), {
          status: 400,
        });
        const mockSend = vi.fn().mockRejectedValue(error);
        const mockClient = { chatCompletion: mockSend };
        const request: OperateRequest = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [],
          format: schema,
        };

        const built = adapter.buildRequest(request);

        await expect(adapter.executeRequest(mockClient, built)).rejects.toThrow(
          "invalid api key",
        );
        expect(mockSend).toHaveBeenCalledTimes(1);
      });
    });

    describe("Temperature fallback", () => {
      it("retries without temperature when model rejects it", async () => {
        const adapter = new FireworksAdapter();
        const error = Object.assign(
          new Error("temperature is not supported for this model"),
          { status: 400 },
        );
        const successResponse = {
          id: "resp-1",
          choices: [{ message: { role: "assistant", content: "Hi" } }],
        } as unknown as Awaited<ReturnType<typeof adapter.executeRequest>>;
        const mockSend = vi
          .fn()
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce(successResponse);
        const mockClient = { chatCompletion: mockSend };
        const request: OperateRequest = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [],
          temperature: 0.7,
        };

        const built = adapter.buildRequest(request);
        expect((built as unknown as Record<string, unknown>).temperature).toBe(
          0.7,
        );

        const result = await adapter.executeRequest(mockClient, built);

        expect(mockSend).toHaveBeenCalledTimes(2);
        const retryParams = mockSend.mock.calls[1][0];
        expect(retryParams.temperature).toBeUndefined();
        expect(result).toBe(successResponse);
      });

      it("strips temperature up-front once the model is cached", () => {
        const adapter = new FireworksAdapter();
        adapter.rememberModelRejectsTemperature(PROVIDER.FIREWORKS.DEFAULT);
        const request: OperateRequest = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [],
          temperature: 0.7,
        };

        const built = adapter.buildRequest(request) as unknown as Record<
          string,
          unknown
        >;

        expect(built.temperature).toBeUndefined();
      });
    });

    describe("executeStreamRequest", () => {
      async function collect(iterable: AsyncIterable<unknown>) {
        const chunks: any[] = [];
        for await (const chunk of iterable) {
          chunks.push(chunk);
        }
        return chunks;
      }

      it("yields text chunks from content deltas and a Done chunk with usage", async () => {
        async function* fakeStream() {
          yield { choices: [{ delta: { content: "He" } }] };
          yield { choices: [{ delta: { content: "llo" } }] };
          yield {
            choices: [{ delta: {}, finish_reason: "stop" }],
            usage: { prompt_tokens: 3, completion_tokens: 5 },
          };
        }
        const mockClient = {
          streamChatCompletion: vi.fn(() => fakeStream()),
        };
        const request = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [],
        };

        const chunks = await collect(
          fireworksAdapter.executeStreamRequest(mockClient, request),
        );

        expect(chunks).toHaveLength(3);
        expect(chunks[0]).toEqual({
          type: LlmStreamChunkType.Text,
          content: "He",
        });
        expect(chunks[1]).toEqual({
          type: LlmStreamChunkType.Text,
          content: "llo",
        });
        expect(chunks[2].type).toBe(LlmStreamChunkType.Done);
        expect(chunks[2].usage).toEqual([
          {
            input: 3,
            output: 5,
            reasoning: 0,
            total: 8,
            provider: PROVIDER.FIREWORKS.NAME,
            model: PROVIDER.FIREWORKS.DEFAULT,
          },
        ]);
      });

      it("assembles tool-call deltas into a single ToolCall chunk", async () => {
        async function* fakeStream() {
          yield {
            choices: [
              {
                delta: {
                  tool_calls: [
                    { id: "call-1", function: { name: "test_tool" } },
                  ],
                },
              },
            ],
          };
          yield {
            choices: [
              {
                delta: {
                  tool_calls: [{ function: { arguments: '{"a"' } }],
                },
              },
            ],
          };
          yield {
            choices: [
              {
                delta: {
                  tool_calls: [{ function: { arguments: ":1}" } }],
                },
                finish_reason: "tool_calls",
              },
            ],
          };
        }
        const mockClient = {
          streamChatCompletion: vi.fn(() => fakeStream()),
        };
        const request = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [],
        };

        const chunks = await collect(
          fireworksAdapter.executeStreamRequest(mockClient, request),
        );

        const toolCallChunks = chunks.filter(
          (chunk) => chunk.type === LlmStreamChunkType.ToolCall,
        );
        expect(toolCallChunks).toHaveLength(1);
        expect(toolCallChunks[0].toolCall).toEqual({
          id: "call-1",
          name: "test_tool",
          arguments: '{"a":1}',
        });
        expect(chunks[chunks.length - 1].type).toBe(LlmStreamChunkType.Done);
      });
    });

    describe("classifyError", () => {
      it("classifies rate limit error by status code", () => {
        const error = { status: 429, message: "Too many requests" };

        const result = fireworksAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.RateLimit);
        expect(result.shouldRetry).toBe(false);
      });

      it("classifies retryable error by status code", () => {
        const error = { status: 500, message: "Internal server error" };

        const result = fireworksAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Retryable);
        expect(result.shouldRetry).toBe(true);
      });

      it("classifies 502 as retryable", () => {
        const error = { status: 502, message: "Bad gateway" };

        const result = fireworksAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Retryable);
        expect(result.shouldRetry).toBe(true);
      });

      it("classifies 503 as retryable", () => {
        const error = { status: 503, message: "Service unavailable" };

        const result = fireworksAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Retryable);
        expect(result.shouldRetry).toBe(true);
      });

      it("classifies unrecoverable error by status code", () => {
        const error = { status: 401, message: "Unauthorized" };

        const result = fireworksAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Unrecoverable);
        expect(result.shouldRetry).toBe(false);
      });

      it("classifies 400 as unrecoverable", () => {
        const error = { status: 400, message: "Bad request" };

        const result = fireworksAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Unrecoverable);
        expect(result.shouldRetry).toBe(false);
      });

      it("classifies rate limit error by message", () => {
        const error = new Error("Rate limit exceeded");

        const result = fireworksAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.RateLimit);
        expect(result.shouldRetry).toBe(false);
      });

      it("classifies transient network errors as retryable", () => {
        const error = Object.assign(new Error("socket hang up"), {
          code: "ECONNRESET",
        });

        const result = fireworksAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Retryable);
        expect(result.shouldRetry).toBe(true);
      });

      it("classifies unknown error as retryable", () => {
        const error = new Error("Unknown error");

        const result = fireworksAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Unknown);
        expect(result.shouldRetry).toBe(true);
      });
    });

    describe("responseToHistoryItems", () => {
      it("returns assistant message for text response", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: "Hello there!",
              },
              finishReason: "stop",
            },
          ],
        };

        const result = fireworksAdapter.responseToHistoryItems(response);

        expect(result).toHaveLength(1);
        expect((result[0] as { content: string }).content).toBe("Hello there!");
        expect((result[0] as { role: string }).role).toBe(
          LlmMessageRole.Assistant,
        );
      });

      it("preserves reasoning from reasoning_content", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: "Answer",
                reasoning_content: "Thinking it through",
              },
              finishReason: "stop",
            },
          ],
        };

        const result = fireworksAdapter.responseToHistoryItems(response);

        expect(result).toHaveLength(1);
        expect((result[0] as { reasoning?: string }).reasoning).toBe(
          "Thinking it through",
        );
      });

      it("falls back to message.reasoning when reasoning_content absent", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: "Answer",
                reasoning: "Alternate reasoning field",
              },
              finishReason: "stop",
            },
          ],
        };

        const result = fireworksAdapter.responseToHistoryItems(response);

        expect((result[0] as { reasoning?: string }).reasoning).toBe(
          "Alternate reasoning field",
        );
      });

      it("returns empty array for tool use response", () => {
        const response = {
          choices: [
            {
              message: {
                role: "assistant",
                content: null,
                toolCalls: [
                  {
                    id: "call-123",
                    type: "function",
                    function: { name: "test", arguments: "{}" },
                  },
                ],
              },
              finishReason: "toolCalls",
            },
          ],
        };

        const result = fireworksAdapter.responseToHistoryItems(response);

        expect(result).toHaveLength(0);
      });
    });
  });

  // AbortSignal Support
  describe("AbortSignal Support", () => {
    describe("executeRequest", () => {
      it("passes signal to client call when provided", async () => {
        const mockSend = vi.fn().mockResolvedValue({
          id: "resp-1",
          choices: [{ message: { role: "assistant", content: "Hi" } }],
        });
        const mockClient = { chatCompletion: mockSend };
        const request = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [{ role: "user", content: "Hello" }],
        };
        const controller = new AbortController();

        await fireworksAdapter.executeRequest(
          mockClient,
          request,
          controller.signal,
        );

        expect(mockSend).toHaveBeenCalledTimes(1);
        const [, options] = mockSend.mock.calls[0];
        expect(options).toEqual({ signal: controller.signal });
      });

      it("suppresses errors after signal is aborted", async () => {
        const controller = new AbortController();
        controller.abort("retry");

        const mockSend = vi.fn().mockRejectedValue(new TypeError("terminated"));
        const mockClient = { chatCompletion: mockSend };
        const request = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [{ role: "user", content: "Hello" }],
        };

        const result = await fireworksAdapter.executeRequest(
          mockClient,
          request,
          controller.signal,
        );

        expect(result).toBeUndefined();
      });

      it("throws errors when signal is not aborted", async () => {
        const controller = new AbortController();

        const mockSend = vi.fn().mockRejectedValue(new Error("real error"));
        const mockClient = { chatCompletion: mockSend };
        const request = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [{ role: "user", content: "Hello" }],
        };

        await expect(
          fireworksAdapter.executeRequest(
            mockClient,
            request,
            controller.signal,
          ),
        ).rejects.toThrow("real error");
      });

      it("does not pass options when no signal provided", async () => {
        const mockSend = vi.fn().mockResolvedValue({
          id: "resp-1",
          choices: [{ message: { role: "assistant", content: "Hi" } }],
        });
        const mockClient = { chatCompletion: mockSend };
        const request = {
          model: PROVIDER.FIREWORKS.DEFAULT,
          messages: [{ role: "user", content: "Hello" }],
        };

        await fireworksAdapter.executeRequest(mockClient, request);

        expect(mockSend).toHaveBeenCalledTimes(1);
        const [, options] = mockSend.mock.calls[0];
        expect(options).toBeUndefined();
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

      const result = fireworksAdapter.buildRequest(request);

      expect(result.model).toBe(PROVIDER.FIREWORKS.DEFAULT);
    });

    it("sets temperature on request when provided", () => {
      const request: OperateRequest = {
        model: PROVIDER.FIREWORKS.DEFAULT,
        messages: [
          {
            content: "Hello",
            role: LlmMessageRole.User,
            type: LlmMessageType.Message,
          },
        ],
        temperature: 0.7,
      };

      const result = fireworksAdapter.buildRequest(
        request,
      ) as unknown as Record<string, unknown>;

      expect(result.temperature).toBe(0.7);
    });

    it("temperature takes precedence over providerOptions", () => {
      const request: OperateRequest = {
        model: PROVIDER.FIREWORKS.DEFAULT,
        messages: [],
        providerOptions: { temperature: 0.3 },
        temperature: 0.9,
      };

      const result = fireworksAdapter.buildRequest(
        request,
      ) as unknown as Record<string, unknown>;

      expect(result.temperature).toBe(0.9);
    });

    it("does not set temperature when not provided", () => {
      const request: OperateRequest = {
        model: PROVIDER.FIREWORKS.DEFAULT,
        messages: [],
      };

      const result = fireworksAdapter.buildRequest(
        request,
      ) as unknown as Record<string, unknown>;

      expect(result.temperature).toBeUndefined();
    });

    it("sets tool_choice to auto", () => {
      const request: OperateRequest = {
        model: PROVIDER.FIREWORKS.DEFAULT,
        messages: [],
        tools: [
          {
            name: "structured_output",
            description: "Structured output",
            parameters: { type: "object" },
          },
        ],
      };

      const result = fireworksAdapter.buildRequest(request);

      expect(result.tool_choice).toBe("auto");
    });

    it("handles multiple tool calls in a single response", () => {
      const response = {
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              toolCalls: [
                {
                  id: "call-1",
                  type: "function",
                  function: { name: "tool_1", arguments: '{"a":1}' },
                },
                {
                  id: "call-2",
                  type: "function",
                  function: { name: "tool_2", arguments: '{"b":2}' },
                },
              ],
            },
            finishReason: "toolCalls",
          },
        ],
      };

      const result = fireworksAdapter.extractToolCalls(response);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("tool_1");
      expect(result[1].name).toBe("tool_2");
    });

    it("converts messages with different roles correctly", () => {
      const request: OperateRequest = {
        model: PROVIDER.FIREWORKS.DEFAULT,
        messages: [
          {
            content: "System prompt",
            role: "system" as any,
          },
          {
            content: "User message",
            role: "user" as any,
          },
          {
            content: "Assistant response",
            role: "assistant" as any,
          },
        ],
      };

      const result = fireworksAdapter.buildRequest(request);

      expect(result.messages[0].role).toBe("system");
      expect(result.messages[1].role).toBe("user");
      expect(result.messages[2].role).toBe("assistant");
    });
  });
});
