import { describe, expect, it, vi } from "vitest";

import { XaiAdapter, xaiAdapter } from "../XaiAdapter.js";
import { OpenAiAdapter } from "../OpenAiAdapter.js";
import { PROVIDER } from "../../../constants.js";
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

describe("XaiAdapter", () => {
  // Base Cases
  describe("Base Cases", () => {
    it("exports XaiAdapter class", () => {
      expect(XaiAdapter).toBeDefined();
      expect(typeof XaiAdapter).toBe("function");
    });

    it("exports xaiAdapter singleton", () => {
      expect(xaiAdapter).toBeDefined();
      expect(xaiAdapter).toBeInstanceOf(XaiAdapter);
    });

    it("extends OpenAiAdapter", () => {
      expect(xaiAdapter).toBeInstanceOf(OpenAiAdapter);
    });

    it("has correct name", () => {
      expect(xaiAdapter.name).toBe(PROVIDER.XAI.NAME);
    });

    it("has correct default model", () => {
      expect(xaiAdapter.defaultModel).toBe(PROVIDER.XAI.MODEL.DEFAULT);
    });
  });

  // Happy Paths
  describe("Happy Paths", () => {
    describe("buildRequest", () => {
      it("builds basic request with xAI model", () => {
        const request: OperateRequest = {
          model: PROVIDER.XAI.MODEL.DEFAULT,
          messages: [
            {
              content: "Hello",
              role: LlmMessageRole.User,
              type: LlmMessageType.Message,
            },
          ],
        };

        const result = xaiAdapter.buildRequest(request) as Record<
          string,
          unknown
        >;

        expect(result.model).toBe(PROVIDER.XAI.MODEL.DEFAULT);
        expect(result.input).toEqual(request.messages);
      });

      it("uses xAI default model when not specified", () => {
        const request: OperateRequest = {
          model: "",
          messages: [],
        };

        const result = xaiAdapter.buildRequest(request) as Record<
          string,
          unknown
        >;

        expect(result.model).toBe(PROVIDER.XAI.MODEL.DEFAULT);
      });
    });

    describe("parseResponse", () => {
      it("parses response with text content", () => {
        const response = {
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "Hello from Grok!" }],
            },
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 20,
            total_tokens: 30,
          },
        };

        const result = xaiAdapter.parseResponse(response);

        expect(result.content).toBe("Hello from Grok!");
        expect(result.hasToolCalls).toBe(false);
      });
    });

    describe("extractUsage", () => {
      it("reports xai as provider name", () => {
        const response = {
          usage: {
            input_tokens: 100,
            output_tokens: 200,
            total_tokens: 300,
          },
        };

        const result = xaiAdapter.extractUsage(
          response,
          PROVIDER.XAI.MODEL.DEFAULT,
        );

        expect(result.provider).toBe(PROVIDER.XAI.NAME);
        expect(result.model).toBe(PROVIDER.XAI.MODEL.DEFAULT);
      });
    });
  });

  // Features
  describe("Features", () => {
    describe("classifyError", () => {
      it("classifies rate limit error", async () => {
        const { RateLimitError } = await import("openai");
        // @ts-expect-error Mock doesn't require constructor args
        const error = new RateLimitError();

        const result = xaiAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.RateLimit);
        expect(result.shouldRetry).toBe(false);
      });

      it("classifies retryable error", async () => {
        const { InternalServerError } = await import("openai");
        // @ts-expect-error Mock doesn't require constructor args
        const error = new InternalServerError();

        const result = xaiAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Retryable);
        expect(result.shouldRetry).toBe(true);
      });

      it("classifies unrecoverable error", async () => {
        const { AuthenticationError } = await import("openai");
        // @ts-expect-error Mock doesn't require constructor args
        const error = new AuthenticationError();

        const result = xaiAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Unrecoverable);
        expect(result.shouldRetry).toBe(false);
      });
    });
  });
});
