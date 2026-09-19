import { describe, expect, it, vi } from "vitest";

import {
  LlmAbortError,
  LlmRateLimitError,
  LlmTransientError,
  LlmUnrecoverableError,
} from "../../errors/LlmError.js";
import { runOcrAttempts } from "../runOcrAttempts.js";

vi.mock("../../util/abortableSleep.js", () => ({
  abortableSleep: vi.fn().mockResolvedValue(undefined),
}));

const CONTEXT = { model: "m", provider: "p" };

describe("runOcrAttempts", () => {
  it("Works", () => {
    expect(runOcrAttempts).toBeFunction();
  });

  it("Returns the first successful attempt", async () => {
    const attempt = vi.fn().mockResolvedValue("ok");
    await expect(runOcrAttempts({ ...CONTEXT, attempt })).resolves.toBe(
      "ok" as never,
    );
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("Retries a transient failure", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(new LlmTransientError("busy"))
      .mockResolvedValue("ok");
    await expect(runOcrAttempts({ ...CONTEXT, attempt })).resolves.toBe(
      "ok" as never,
    );
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("Waits out a rate limit by default", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(new LlmRateLimitError("slow"))
      .mockResolvedValue("ok");
    await expect(runOcrAttempts({ ...CONTEXT, attempt })).resolves.toBe(
      "ok" as never,
    );
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("Throws a rate limit at once when retry.rateLimit is false", async () => {
    const attempt = vi.fn().mockRejectedValue(new LlmRateLimitError("slow"));
    await expect(
      runOcrAttempts({ ...CONTEXT, attempt, retry: { rateLimit: false } }),
    ).rejects.toBeInstanceOf(LlmRateLimitError);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("Does not retry an unrecoverable error", async () => {
    const attempt = vi.fn().mockRejectedValue(new LlmUnrecoverableError("no"));
    await expect(
      runOcrAttempts({ ...CONTEXT, attempt }),
    ).rejects.toBeInstanceOf(LlmUnrecoverableError);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("Throws an abort error when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const attempt = vi.fn();
    await expect(
      runOcrAttempts({ ...CONTEXT, attempt, signal: controller.signal }),
    ).rejects.toBeInstanceOf(LlmAbortError);
    expect(attempt).not.toHaveBeenCalled();
  });

  it("Converts a failure after abort into an abort error", async () => {
    const controller = new AbortController();
    const attempt = vi.fn().mockImplementation(async () => {
      controller.abort();
      throw new Error("The operation was aborted");
    });
    await expect(
      runOcrAttempts({ ...CONTEXT, attempt, signal: controller.signal }),
    ).rejects.toBeInstanceOf(LlmAbortError);
  });
});
