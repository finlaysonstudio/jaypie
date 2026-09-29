import { beforeEach, describe, expect, it, vi } from "vitest";

import { log } from "@jaypie/logger";

import {
  LlmRateLimitError,
  LlmTimeoutError,
  LlmUnrecoverableError,
} from "../../errors/LlmError.js";
import { failureKind, tallyFailure } from "../tallyFailure.js";

//
//
// Mock
//

vi.mock("@jaypie/logger", () => ({
  log: {
    sessionActive: true,
    tally: vi.fn(),
  },
}));

const mockLog = log as unknown as { sessionActive?: boolean };

//
//
// Tests
//

describe("tallyFailure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLog.sessionActive = true;
  });

  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof tallyFailure).toBe("function");
    });

    it("tallies a failure by provider, model, and kind", () => {
      tallyFailure({
        error: new LlmUnrecoverableError("bad request"),
        model: "gpt-x",
        provider: "openai",
      });
      expect(log.tally).toHaveBeenCalledWith({
        llm: { failures: { "openai:gpt-x": { unrecoverable: 1 } } },
      });
    });
  });

  describe("Features", () => {
    it("counts a fallback when another model takes over", () => {
      tallyFailure({
        error: new LlmTimeoutError(undefined, { timeoutMs: 1000 }),
        failover: true,
        model: "gpt-x",
        provider: "openai",
      });
      expect(log.tally).toHaveBeenCalledWith({
        llm: {
          failures: { "openai:gpt-x": { timeout: 1 } },
          fallbacks: 1,
        },
      });
    });

    it("prefers the provider and model carried on the error", () => {
      tallyFailure({
        error: new LlmRateLimitError("slow down", {
          model: "claude-x",
          provider: "anthropic",
        }),
        provider: "openai",
      });
      expect(log.tally).toHaveBeenCalledWith({
        llm: { failures: { "anthropic:claude-x": { rate_limit: 1 } } },
      });
    });

    it("keys by provider alone when the model is unknown", () => {
      tallyFailure({ error: new Error("boom"), provider: "openai" });
      expect(log.tally).toHaveBeenCalledWith({
        llm: { failures: { openai: { unknown: 1 } } },
      });
    });

    it("no-ops outside an active session", () => {
      mockLog.sessionActive = false;
      tallyFailure({ error: new Error("boom"), provider: "openai" });
      expect(log.tally).not.toHaveBeenCalled();
    });
  });

  describe("failureKind", () => {
    it("reports a timeout as timeout, not retryable", () => {
      expect(failureKind(new LlmTimeoutError())).toBe("timeout");
    });

    it("reports an LlmError by category", () => {
      expect(failureKind(new LlmRateLimitError("slow"))).toBe("rate_limit");
    });

    it("reports anything else as unknown", () => {
      expect(failureKind(new Error("boom"))).toBe("unknown");
    });
  });
});
