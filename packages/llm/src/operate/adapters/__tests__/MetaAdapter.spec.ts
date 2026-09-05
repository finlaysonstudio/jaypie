import { describe, expect, it, vi } from "vitest";

import { EFFORT, MODEL, PROVIDER } from "../../../constants.js";
import {
  LlmMessageRole,
  LlmMessageType,
} from "../../../types/LlmProvider.interface.js";
import { ErrorCategory, OperateRequest } from "../../types.js";
import { MetaAdapter, metaAdapter } from "../MetaAdapter.js";
import { OpenAiAdapter } from "../OpenAiAdapter.js";

//
//
// Mock
//

vi.mock("../../../providers/openai/client.js", () => {
  class OpenAiApiError extends Error {
    readonly status: number;
    constructor(status = 500, message = "API error") {
      super(message);
      this.name = "OpenAiApiError";
      this.status = status;
    }
  }
  class BadRequestError extends OpenAiApiError {
    constructor(..._args: any[]) {
      super(400, "Bad request");
      this.name = "BadRequestError";
    }
  }
  class AuthenticationError extends OpenAiApiError {
    constructor(..._args: any[]) {
      super(401, "Auth error");
      this.name = "AuthenticationError";
    }
  }
  class InternalServerError extends OpenAiApiError {
    constructor(..._args: any[]) {
      super(500, "Internal error");
      this.name = "InternalServerError";
    }
  }
  class RateLimitError extends OpenAiApiError {
    constructor(..._args: any[]) {
      super(429, "Rate limit");
      this.name = "RateLimitError";
    }
  }
  const stub = (name: string, status: number) =>
    class extends OpenAiApiError {
      constructor(..._args: any[]) {
        super(status, name);
        this.name = name;
      }
    };
  return {
    APIConnectionError: stub("APIConnectionError", 0),
    APIConnectionTimeoutError: stub("APIConnectionTimeoutError", 0),
    APIUserAbortError: stub("APIUserAbortError", 0),
    AuthenticationError,
    BadRequestError,
    ConflictError: stub("ConflictError", 409),
    InternalServerError,
    NotFoundError: stub("NotFoundError", 404),
    OpenAIClient: vi.fn(),
    OpenAiApiError,
    PermissionDeniedError: stub("PermissionDeniedError", 403),
    RateLimitError,
    UnprocessableEntityError: stub("UnprocessableEntityError", 422),
  };
});

vi.mock("../../../providers/openai/responseFormat.js", () => ({
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
// Helpers
//

function requestFor(
  model: string,
  extra: Partial<OperateRequest> = {},
): OperateRequest {
  return {
    model,
    messages: [
      {
        content: "Hello",
        role: LlmMessageRole.User,
        type: LlmMessageType.Message,
      },
    ],
    ...extra,
  };
}

//
//
// Tests
//

describe("MetaAdapter", () => {
  describe("Base Cases", () => {
    it("exports MetaAdapter class", () => {
      expect(MetaAdapter).toBeDefined();
      expect(typeof MetaAdapter).toBe("function");
    });

    it("exports metaAdapter singleton", () => {
      expect(metaAdapter).toBeDefined();
      expect(metaAdapter).toBeInstanceOf(MetaAdapter);
    });

    it("extends OpenAiAdapter", () => {
      expect(metaAdapter).toBeInstanceOf(OpenAiAdapter);
    });

    it("has correct name", () => {
      expect(metaAdapter.name).toBe(PROVIDER.META.NAME);
    });

    it("has correct default model", () => {
      expect(metaAdapter.defaultModel).toBe(PROVIDER.META.DEFAULT);
      expect(metaAdapter.defaultModel).toBe(MODEL.MUSE_SPARK);
    });
  });

  describe("Happy Paths", () => {
    describe("buildRequest", () => {
      it("builds basic request with the Meta model", () => {
        const request = requestFor(MODEL.MUSE_SPARK);

        const result = metaAdapter.buildRequest(request) as Record<
          string,
          unknown
        >;

        expect(result.model).toBe(MODEL.MUSE_SPARK);
        expect(result.input).toEqual(request.messages);
      });

      it("uses the Meta default model when not specified", () => {
        const result = metaAdapter.buildRequest({
          model: "",
          messages: [],
        }) as Record<string, unknown>;

        expect(result.model).toBe(PROVIDER.META.DEFAULT);
      });

      it("renames user to safety_identifier", () => {
        const result = metaAdapter.buildRequest(
          requestFor(MODEL.MUSE_SPARK, { user: "user-123" }),
        ) as Record<string, unknown>;

        expect(result.safety_identifier).toBe("user-123");
        expect(result).not.toHaveProperty("user");
      });

      it("omits safety_identifier when no user is given", () => {
        const result = metaAdapter.buildRequest(
          requestFor(MODEL.MUSE_SPARK),
        ) as Record<string, unknown>;

        expect(result).not.toHaveProperty("safety_identifier");
        expect(result).not.toHaveProperty("user");
      });

      it("requests a reasoning summary on Muse Spark models", () => {
        const result = metaAdapter.buildRequest(
          requestFor(MODEL.MUSE_SPARK),
        ) as Record<string, unknown>;

        expect(result.reasoning).toEqual({ summary: "auto" });
      });

      it("requests a reasoning summary on the contributor id", () => {
        const result = metaAdapter.buildRequest(
          requestFor(MODEL.MUSE_SPARK_CONTRIBUTOR),
        ) as Record<string, unknown>;

        expect(result.reasoning).toEqual({ summary: "auto" });
      });

      it("emits prompt_cache_key by default", () => {
        const result = metaAdapter.buildRequest(
          requestFor(MODEL.MUSE_SPARK, { system: "You are terse." }),
        ) as Record<string, unknown>;

        expect(result.prompt_cache_key).toBeString();
      });

      it("omits prompt_cache_key when cache is disabled", () => {
        const result = metaAdapter.buildRequest(
          requestFor(MODEL.MUSE_SPARK, { cache: false }),
        ) as Record<string, unknown>;

        expect(result).not.toHaveProperty("prompt_cache_key");
      });

      it("keeps temperature", () => {
        const result = metaAdapter.buildRequest(
          requestFor(MODEL.MUSE_SPARK, { temperature: 0.4 }),
        ) as Record<string, unknown>;

        expect(result.temperature).toBe(0.4);
      });
    });

    describe("effort", () => {
      it("reaches max on muse-spark-1.3", () => {
        const result = metaAdapter.buildRequest(
          requestFor(MODEL.MUSE_SPARK, { effort: EFFORT.HIGHEST }),
        ) as Record<string, unknown>;

        expect(result.reasoning).toEqual({ effort: "max", summary: "auto" });
      });

      it("clamps highest to xhigh on the contributor id", () => {
        const result = metaAdapter.buildRequest(
          requestFor(MODEL.MUSE_SPARK_CONTRIBUTOR, {
            effort: EFFORT.HIGHEST,
          }),
        ) as Record<string, unknown>;

        expect((result.reasoning as Record<string, unknown>).effort).toBe(
          "xhigh",
        );
      });

      it("sends minimal for lowest", () => {
        const result = metaAdapter.buildRequest(
          requestFor(MODEL.MUSE_SPARK, { effort: EFFORT.LOWEST }),
        ) as Record<string, unknown>;

        expect((result.reasoning as Record<string, unknown>).effort).toBe(
          "minimal",
        );
      });

      it("never emits none", () => {
        for (const effort of Object.values(EFFORT)) {
          const result = metaAdapter.buildRequest(
            requestFor(MODEL.MUSE_SPARK, { effort }),
          ) as Record<string, unknown>;
          expect((result.reasoning as Record<string, unknown>).effort).not.toBe(
            "none",
          );
        }
      });

      it("omits effort for ids outside the muse-spark family", () => {
        const result = metaAdapter.buildRequest(
          requestFor("muse-image-1.0", { effort: EFFORT.HIGH }),
        ) as Record<string, unknown>;

        expect(result.reasoning).toBeUndefined();
      });
    });

    describe("parseResponse", () => {
      it("parses response with text content", () => {
        const response = {
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "Hello from Muse!" }],
            },
          ],
          usage: {
            input_tokens: 10,
            output_tokens: 20,
            total_tokens: 30,
          },
        };

        const result = metaAdapter.parseResponse(response);

        expect(result.content).toBe("Hello from Muse!");
        expect(result.hasToolCalls).toBe(false);
      });
    });

    describe("extractUsage", () => {
      it("reports meta as provider name", () => {
        const result = metaAdapter.extractUsage(
          {
            usage: {
              input_tokens: 100,
              output_tokens: 200,
              total_tokens: 300,
            },
          },
          MODEL.MUSE_SPARK,
        );

        expect(result.provider).toBe(PROVIDER.META.NAME);
        expect(result.model).toBe(MODEL.MUSE_SPARK);
      });

      it("surfaces cached and reasoning tokens", () => {
        const result = metaAdapter.extractUsage(
          {
            usage: {
              input_tokens: 1000,
              input_tokens_details: { cached_tokens: 800 },
              output_tokens: 250,
              output_tokens_details: { reasoning_tokens: 150 },
              total_tokens: 1250,
            },
          },
          MODEL.MUSE_SPARK,
        );

        expect(result.cacheRead).toBe(800);
        expect(result.reasoning).toBe(150);
        expect(result.input).toBe(1000);
        expect(result.output).toBe(250);
      });
    });
  });

  describe("Features", () => {
    describe("classifyError", () => {
      it("classifies a 402 as a terminal billing failure", async () => {
        const { OpenAiApiError } =
          await import("../../../providers/openai/client.js");
        const error = new OpenAiApiError(402, "Account not billable");

        const result = metaAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Quota);
        expect(result.reason).toBe("billing");
        expect(result.shouldRetry).toBe(false);
      });

      it("classifies rate limit error", async () => {
        const { RateLimitError } =
          await import("../../../providers/openai/client.js");
        // @ts-expect-error Mock doesn't require constructor args
        const error = new RateLimitError();

        const result = metaAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.RateLimit);
        expect(result.shouldRetry).toBe(false);
      });

      it("classifies retryable error", async () => {
        const { InternalServerError } =
          await import("../../../providers/openai/client.js");
        // @ts-expect-error Mock doesn't require constructor args
        const error = new InternalServerError();

        const result = metaAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Retryable);
        expect(result.shouldRetry).toBe(true);
      });

      it("classifies unrecoverable error", async () => {
        const { AuthenticationError } =
          await import("../../../providers/openai/client.js");
        // @ts-expect-error Mock doesn't require constructor args
        const error = new AuthenticationError();

        const result = metaAdapter.classifyError(error);

        expect(result.category).toBe(ErrorCategory.Unrecoverable);
        expect(result.shouldRetry).toBe(false);
      });
    });
  });
});
