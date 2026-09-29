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
});
