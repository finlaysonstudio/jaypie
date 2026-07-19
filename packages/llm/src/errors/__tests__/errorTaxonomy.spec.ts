import { describe, expect, it } from "vitest";

import { ErrorCategory } from "../../operate/types.js";
import { classifyProviderError } from "../../util/classifyProviderError.js";
import { toLlmError } from "../toLlmError.js";
import {
  LlmError,
  LlmQuotaError,
  LlmRateLimitError,
  LlmTransientError,
  LlmUnrecoverableError,
} from "../LlmError.js";

//
//
// classifyProviderError
//

describe("classifyProviderError", () => {
  it("Is a function", () => {
    expect(typeof classifyProviderError).toBe("function");
  });

  it("classifies grammar-compilation timeout as retryable (#422)", () => {
    const result = classifyProviderError(
      new Error("Grammar compilation timed out."),
    );
    expect(result).toMatchObject({
      category: ErrorCategory.Retryable,
      shouldRetry: true,
    });
  });

  it("classifies exhausted quota as terminal quota", () => {
    const result = classifyProviderError(
      new Error(
        "You exceeded your current quota, please check your plan and billing details.",
      ),
    );
    // "plan and billing" is a billing signal and wins
    expect(result).toMatchObject({
      category: ErrorCategory.Quota,
      reason: "billing",
      shouldRetry: false,
    });
  });

  it("classifies a daily quota metric as quota", () => {
    const result = classifyProviderError(
      new Error(
        "Quota exceeded for metric: generativelanguage.googleapis.com/generate_requests_per_model_per_day",
      ),
    );
    expect(result).toMatchObject({
      category: ErrorCategory.Quota,
      reason: "quota",
      shouldRetry: false,
    });
  });

  it("classifies insufficient funds as billing", () => {
    const result = classifyProviderError(
      new Error("Your credit balance is too low to access the API"),
    );
    expect(result).toMatchObject({
      category: ErrorCategory.Quota,
      reason: "billing",
    });
  });

  it("returns undefined when no shared pattern matches", () => {
    expect(classifyProviderError(new Error("some other failure"))).toBe(
      undefined,
    );
    expect(classifyProviderError(undefined)).toBe(undefined);
  });
});

//
//
// toLlmError
//

describe("toLlmError", () => {
  it("maps each category to its subclass and preserves cause + context", () => {
    const cause = new Error("boom");
    const rate = toLlmError(
      {
        category: ErrorCategory.RateLimit,
        error: cause,
        shouldRetry: false,
        suggestedDelayMs: 60000,
      },
      { provider: "openai", model: "gpt-4" },
    );
    expect(rate).toBeInstanceOf(LlmRateLimitError);
    expect(rate).toBeInstanceOf(LlmError);
    expect(rate.provider).toBe("openai");
    expect(rate.model).toBe("gpt-4");
    expect(rate.retryAfterMs).toBe(60000);
    expect(rate.cause).toBe(cause);
    expect(rate.message).toBe("boom");

    expect(
      toLlmError({
        category: ErrorCategory.Quota,
        error: cause,
        reason: "billing",
        shouldRetry: false,
      }),
    ).toBeInstanceOf(LlmQuotaError);
    expect(
      toLlmError({
        category: ErrorCategory.Unrecoverable,
        error: cause,
        shouldRetry: false,
      }),
    ).toBeInstanceOf(LlmUnrecoverableError);
    expect(
      toLlmError({
        category: ErrorCategory.Retryable,
        error: cause,
        shouldRetry: true,
      }),
    ).toBeInstanceOf(LlmTransientError);
    expect(
      toLlmError({
        category: ErrorCategory.Unknown,
        error: cause,
        shouldRetry: true,
      }),
    ).toBeInstanceOf(LlmTransientError);
  });

  it("carries the quota reason onto LlmQuotaError", () => {
    const err = toLlmError({
      category: ErrorCategory.Quota,
      error: new Error("no funds"),
      reason: "billing",
      shouldRetry: false,
    });
    expect(err).toBeInstanceOf(LlmQuotaError);
    expect((err as LlmQuotaError).reason).toBe("billing");
  });
});

//
//
// LlmError classes
//

describe("LlmError classes", () => {
  it("are Jaypie errors with sensible status codes", () => {
    expect(new LlmRateLimitError("x").status).toBe(429);
    expect(new LlmQuotaError("x").status).toBe(402);
    expect(new LlmUnrecoverableError("x").isJaypieError).toBe(true);
    expect(new LlmTransientError("x").status).toBe(504);
    expect(new LlmQuotaError("x").reason).toBe("quota");
  });
});
