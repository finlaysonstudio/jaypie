import { describe, expect, it, vi } from "vitest";

import { OpenAiAdapter, openAiAdapter } from "../OpenAiAdapter.js";
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

vi.mock("openai", () => ({
  APIConnectionError: class APIConnectionError extends Error {
    constructor(..._args: any[]) {
      super("Connection error");
      this.name = "APIConnectionError";
    }
  },
  APIConnectionTimeoutError: class APIConnectionTimeoutError extends Error {
    constructor(..._args: any[]) {
      super("Timeout");
      this.name = "APIConnectionTimeoutError";
    }
  },
  APIUserAbortError: class APIUserAbortError extends Error {
    constructor(..._args: any[]) {
      super("User abort");
      this.name = "APIUserAbortError";
    }
  },
  AuthenticationError: class AuthenticationError extends Error {
    constructor(..._args: any[]) {
      super("Auth error");
      this.name = "AuthenticationError";
    }
  },
  BadRequestError: class BadRequestError extends Error {
    constructor(..._args: any[]) {
      super("Bad request");
      this.name = "BadRequestError";
    }
  },
  ConflictError: class ConflictError extends Error {
    constructor(..._args: any[]) {
      super("Conflict");
      this.name = "ConflictError";
    }
  },
  InternalServerError: class InternalServerError extends Error {
    constructor(..._args: any[]) {
      super("Internal error");
      this.name = "InternalServerError";
    }
  },
  NotFoundError: class NotFoundError extends Error {
    constructor(..._args: any[]) {
      super("Not found");
      this.name = "NotFoundError";
    }
  },
  OpenAI: vi.fn(),
  PermissionDeniedError: class PermissionDeniedError extends Error {
    constructor(..._args: any[]) {
      super("Permission denied");
      this.name = "PermissionDeniedError";
    }
  },
  RateLimitError: class RateLimitError extends Error {
    constructor(..._args: any[]) {
      super("Rate limit");
      this.name = "RateLimitError";
    }
  },
  UnprocessableEntityError: class UnprocessableEntityError extends Error {
    constructor(..._args: any[]) {
      super("Unprocessable");
      this.name = "UnprocessableEntityError";
    }
  },
}));

vi.mock("openai/helpers/zod", () => ({
  zodResponseFormat: vi.fn(() => ({
    json_schema: {
      name: "response",
      strict: true,
    },
    type: "json_schema",
  })),
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

describe("OpenAiAdapter", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("exports OpenAiAdapter class", () => {
      expect(OpenAiAdapter).toBeDefined();
      expect(typeof OpenAiAdapter).toBe("function");
    });

    it("exports openAiAdapter singleton", () => {
      expect(openAiAdapter).toBeDefined();
      expect(openAiAdapter).toBeInstanceOf(OpenAiAdapter);
    });

    it("has correct name", () => {
      expect(openAiAdapter.name).toBe(PROVIDER.OPENAI.NAME);
    });

    it("has correct default model", () => {
      expect(openAiAdapter.defaultModel).toBe(PROVIDER.OPENAI.MODEL.DEFAULT);
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    describe("buildRequest", () => {
      it("builds basic request", () => {
        const request: OperateRequest = {
          model: PROVIDER.OPENAI.MODEL.LARGE,
          messages: [
            {
              content: "Hello",
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
            },
          ],
        };

        const result = openAiAdapter.buildRequest(request) as Record<
          string,
          unknown
        >;

        expect(result.model).toBe(PROVIDER.OPENAI.MODEL.LARGE);
        expect(result.input).toEqual(request.messages);
      });

      it("includes user when provided", () => {
        const request: OperateRequest = {
          model: PROVIDER.OPENAI.MODEL.LARGE,
          messages: [],
          user: "test-user",
        };

        const result = openAiAdapter.buildRequest(request) as Record<
          string,
          unknown
        >;

        expect(result.user).toBe("test-user");
      });

      it("includes instructions when provided", () => {
        const request: OperateRequest = {
          model: PROVIDER.OPENAI.MODEL.LARGE,
          messages: [],
          instructions: "Be helpful",
        };

        const result = openAiAdapter.buildRequest(request) as Record<
          string,
          unknown
        >;

        expect(result.instructions).toBe("Be helpful");
      });

      it("includes tools when provided", () => {
        const request: OperateRequest = {
          model: PROVIDER.OPENAI.MODEL.LARGE,
          messages: [],
          tools: [
            {
              name: "test_tool",
              description: "A test tool",
              parameters: { type: "object" },
            },
          ],
        };

        const result = openAiAdapter.buildRequest(request) as Record<
          string,
          unknown
        >;

        expect(result.tools).toHaveLength(1);
      });
    });

    describe("parseResponse", () => {
      it("parses response with text content", () => {
        const response = {
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "Hello there!" }],
            },
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 20,
            total_tokens: 30,
          },
        };

        const result = openAiAdapter.parseResponse(response);

        expect(result.content).toBe("Hello there!");
        expect(result.hasToolCalls).toBe(false);
      });

      it("detects tool calls", () => {
        const response = {
          output: [
            {
              type: "function_call",
              name: "test_tool",
              arguments: "{}",
              call_id: "call-123",
            },
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 20,
            total_tokens: 30,
          },
        };

        const result = openAiAdapter.parseResponse(response);

        expect(result.hasToolCalls).toBe(true);
      });
    });

    describe("extractToolCalls", () => {
      it("extracts tool calls from response", () => {
        const response = {
          output: [
            {
              type: "function_call",
              name: "test_tool",
              arguments: '{"key": "value"}',
              call_id: "call-123",
            },
          ],
        };

        const result = openAiAdapter.extractToolCalls(response);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("test_tool");
        expect(result[0].callId).toBe("call-123");
        expect(result[0].arguments).toBe('{"key": "value"}');
      });

      it("returns empty array when no tool calls", () => {
        const response = {
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "Hello" }],
            },
          ],
        };

        const result = openAiAdapter.extractToolCalls(response);

        expect(result).toHaveLength(0);
      });
    });

    describe("extractUsage", () => {
      it("extracts usage from response", () => {
        const response = {
          usage: {
            input_tokens: 100,
            output_tokens: 200,
            total_tokens: 300,
            output_tokens_details: {
              reasoning_tokens: 50,
            },
          },
        };

        const result = openAiAdapter.extractUsage(
          response,
          PROVIDER.OPENAI.MODEL.LARGE,
        );

        expect(result.input).toBe(100);
        expect(result.output).toBe(200);
        expect(result.total).toBe(300);
        expect(result.reasoning).toBe(50);
        expect(result.provider).toBe(PROVIDER.OPENAI.NAME);
        expect(result.model).toBe(PROVIDER.OPENAI.MODEL.LARGE);
      });

      it("handles missing usage", () => {
        const response = {};

        const result = openAiAdapter.extractUsage(
          response,
          PROVIDER.OPENAI.MODEL.LARGE,
        );

        expect(result.input).toBe(0);
        expect(result.output).toBe(0);
        expect(result.total).toBe(0);
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

        const result = openAiAdapter.formatTools(toolkit);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("test");
        expect(result[0].description).toBe("Test tool");
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

        const formatted = openAiAdapter.formatToolResult(toolCall, result);

        expect(formatted.call_id).toBe("call-123");
        expect(formatted.output).toBe('{"result": "success"}');
        expect(formatted.type).toBe(LlmMessageType.FunctionCallOutput);
      });
    });

    describe("isComplete", () => {
      it("returns true when no function calls", () => {
        const response = {
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "Done" }],
            },
          ],
        };

        expect(openAiAdapter.isComplete(response)).toBe(true);
      });

      it("returns false when has function calls", () => {
        const response = {
          output: [
            {
              type: "function_call",
              name: "test",
              arguments: "{}",
              call_id: "123",
            },
          ],
        };

        expect(openAiAdapter.isComplete(response)).toBe(false);
      });
    });

    describe("classifyError", () => {
      it("classifies rate limit error", async () => {
        const { RateLimitError } = await import("openai");
        // @ts-expect-error Mock doesn't require constructor args
        const error = new RateLimitError();

        const result = openAiAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.RateLimit);
        expect(result.shouldRetry).toBe(false);
      });

      it("classifies retryable error", async () => {
        const { InternalServerError } = await import("openai");
        // @ts-expect-error Mock doesn't require constructor args
        const error = new InternalServerError();

        const result = openAiAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Retryable);
        expect(result.shouldRetry).toBe(true);
      });

      it("classifies unrecoverable error", async () => {
        const { AuthenticationError } = await import("openai");
        // @ts-expect-error Mock doesn't require constructor args
        const error = new AuthenticationError();

        const result = openAiAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Unrecoverable);
        expect(result.shouldRetry).toBe(false);
      });

      it("classifies unknown error as retryable", () => {
        const error = new Error("Unknown error");

        const result = openAiAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Unknown);
        expect(result.shouldRetry).toBe(true);
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

      const result = openAiAdapter.buildRequest(request) as Record<
        string,
        unknown
      >;

      expect(result.model).toBe(PROVIDER.OPENAI.MODEL.DEFAULT);
    });

    it("handles response with reasoning items", () => {
      const response = {
        output: [
          { type: "reasoning", id: "reason-1", content: "Thinking..." },
          {
            type: "message",
            content: [{ type: "output_text", text: "Answer" }],
          },
        ],
        usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      };

      const result = openAiAdapter.parseResponse(response);

      expect(result.content).toBe("Answer");
    });
  });
});
