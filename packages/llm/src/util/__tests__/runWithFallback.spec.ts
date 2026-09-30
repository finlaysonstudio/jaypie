import { beforeEach, describe, expect, it, vi } from "vitest";

import log from "@jaypie/logger";

import { LlmTimeoutError } from "../../errors/LlmError.js";
import { runWithFallback } from "../runWithFallback.js";
import { tallyFailure } from "../tallyFailure.js";

//
//
// Mock
//

vi.mock("@jaypie/logger", () => ({
  default: {
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../tallyFailure.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../tallyFailure.js")>()),
  tallyFailure: vi.fn(),
}));

//
//
// Helpers
//

const timeout = () => new LlmTimeoutError(undefined, { timeoutMs: 1000 });

//
//
// Tests
//

describe("runWithFallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Base Cases", () => {
    it("returns the primary's result", async () => {
      const result = await runWithFallback({
        attempt: async () => "ok",
        chain: [],
        createInstance: () => "instance",
        primary: "primary",
        primaryProvider: "openai",
      });
      expect(result).toBe("ok");
      expect(tallyFailure).not.toHaveBeenCalled();
    });
  });

  describe("Features", () => {
    it("logs a failover at debug and tallies it as a fallback", async () => {
      const attempt = vi
        .fn()
        .mockRejectedValueOnce(timeout())
        .mockResolvedValueOnce("ok");

      const result = await runWithFallback({
        attempt,
        chain: [{ model: "claude-x", provider: "anthropic" }],
        createInstance: () => "fallback",
        primary: "primary",
        primaryProvider: "openai",
      });

      expect(result).toBe("ok");
      expect(log.debug).toHaveBeenCalledWith(
        "Provider openai failed; failing over",
        expect.objectContaining({ attemptsRemaining: 2, kind: "timeout" }),
      );
      expect(log.warn).not.toHaveBeenCalled();
      expect(tallyFailure).toHaveBeenCalledWith(
        expect.objectContaining({ failover: true, provider: "openai" }),
      );
    });

    it("warns only on the failure that reaches the caller", async () => {
      const attempt = vi.fn().mockRejectedValue(timeout());

      await expect(
        runWithFallback({
          attempt,
          chain: [{ model: "claude-x", provider: "anthropic" }],
          createInstance: () => "fallback",
          primary: "primary",
          primaryProvider: "openai",
        }),
      ).rejects.toThrow(LlmTimeoutError);

      expect(log.debug).toHaveBeenCalledTimes(2);
      expect(log.warn).toHaveBeenCalledTimes(1);
      expect(log.warn).toHaveBeenCalledWith(
        "Provider openai failed after lingering",
        expect.objectContaining({ attemptsRemaining: 0 }),
      );
      expect(tallyFailure).toHaveBeenCalledTimes(3);
      expect(tallyFailure).toHaveBeenLastCalledWith(
        expect.objectContaining({ failover: false }),
      );
      expect(tallyFailure).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          failover: true,
          model: "claude-x",
          provider: "anthropic",
        }),
      );
    });

    it("warns when a lone model fails", async () => {
      await expect(
        runWithFallback({
          attempt: vi.fn().mockRejectedValue(timeout()),
          chain: [],
          createInstance: () => "fallback",
          primary: "primary",
          primaryProvider: "openai",
        }),
      ).rejects.toThrow(LlmTimeoutError);

      expect(log.warn).toHaveBeenCalledWith(
        "Provider openai failed",
        expect.objectContaining({ kind: "timeout" }),
      );
      expect(tallyFailure).toHaveBeenCalledWith(
        expect.objectContaining({ failover: false }),
      );
    });
  });

  describe("Soft Failures", () => {
    const isSoft = (result: string) => result.startsWith("partial");

    it("moves past a soft failure to the next model", async () => {
      const attempt = vi
        .fn()
        .mockResolvedValueOnce("partial primary")
        .mockResolvedValueOnce("ok");

      const result = await runWithFallback({
        attempt,
        chain: [{ model: "claude-x", provider: "anthropic" }],
        createInstance: () => "fallback",
        primary: "primary",
        primaryProvider: "openai",
        shouldFailover: isSoft,
      });

      expect(result).toBe("ok");
      expect(attempt).toHaveBeenCalledTimes(2);
      expect(log.debug).toHaveBeenCalledWith(
        "Provider openai returned incomplete; failing over",
        expect.objectContaining({ attemptsRemaining: 1, kind: "incomplete" }),
      );
      expect(tallyFailure).toHaveBeenCalledWith(
        expect.objectContaining({ failover: true, provider: "openai" }),
      );
    });

    it("returns a lone model's soft failure", async () => {
      const attempt = vi.fn().mockResolvedValue("partial primary");

      const result = await runWithFallback({
        attempt,
        chain: [],
        createInstance: () => "fallback",
        primary: "primary",
        primaryProvider: "openai",
        shouldFailover: isSoft,
      });

      expect(result).toBe("partial primary");
      expect(attempt).toHaveBeenCalledTimes(1);
      expect(log.debug).not.toHaveBeenCalled();
    });

    it("skips the linger pass when the primary soft-failed", async () => {
      const attempt = vi
        .fn()
        .mockResolvedValueOnce("partial primary")
        .mockResolvedValueOnce("partial fallback");

      const result = await runWithFallback({
        attempt,
        chain: [{ model: "claude-x", provider: "anthropic" }],
        createInstance: () => "fallback",
        primary: "primary",
        primaryProvider: "openai",
        shouldFailover: isSoft,
      });

      expect(result).toBe("partial fallback");
      expect(attempt).toHaveBeenCalledTimes(2);
    });

    it("returns the soft failure over a later error", async () => {
      const attempt = vi
        .fn()
        .mockResolvedValueOnce("partial primary")
        .mockRejectedValueOnce(timeout());
      const onExhausted = vi.fn();

      const result = await runWithFallback({
        attempt,
        chain: [{ model: "claude-x", provider: "anthropic" }],
        createInstance: () => "fallback",
        onExhausted,
        primary: "primary",
        primaryProvider: "openai",
        shouldFailover: isSoft,
      });

      expect(result).toBe("partial primary");
      expect(attempt).toHaveBeenCalledTimes(2);
      expect(onExhausted).not.toHaveBeenCalled();
    });

    it("still lingers when only a fallback soft-failed", async () => {
      const attempt = vi
        .fn()
        .mockRejectedValueOnce(timeout())
        .mockResolvedValueOnce("partial fallback")
        .mockResolvedValueOnce("ok");

      const result = await runWithFallback({
        attempt,
        chain: [{ model: "claude-x", provider: "anthropic" }],
        createInstance: () => "fallback",
        primary: "primary",
        primaryProvider: "openai",
        shouldFailover: isSoft,
      });

      expect(result).toBe("ok");
      expect(attempt).toHaveBeenCalledTimes(3);
      expect(attempt).toHaveBeenLastCalledWith(
        expect.objectContaining({ failFast: false, instance: "primary" }),
      );
    });

    it("settles the returned result with total attempts", async () => {
      const settle = vi.fn(
        ({ attempts, result }: { attempts: number; result: string }) =>
          `${result}:${attempts}`,
      );

      const result = await runWithFallback({
        attempt: vi
          .fn()
          .mockResolvedValueOnce("partial primary")
          .mockRejectedValueOnce(timeout()),
        chain: [{ model: "claude-x", provider: "anthropic" }],
        createInstance: () => "fallback",
        primary: "primary",
        primaryProvider: "openai",
        settle,
        shouldFailover: isSoft,
      });

      expect(result).toBe("partial primary:2");
      expect(settle).toHaveBeenCalledTimes(1);
    });

    it("lets a throw from settle reach the caller without failing over", async () => {
      const attempt = vi.fn().mockResolvedValue("ok");

      await expect(
        runWithFallback({
          attempt,
          chain: [{ model: "claude-x", provider: "anthropic" }],
          createInstance: () => "fallback",
          primary: "primary",
          primaryProvider: "openai",
          settle: () => {
            throw timeout();
          },
        }),
      ).rejects.toThrow(LlmTimeoutError);
      expect(attempt).toHaveBeenCalledTimes(1);
    });
  });
});
