import { describe, expect, it, vi } from "vitest";

import { LlmIncompleteError, LlmResponseErrorReason } from "../../src/index.js";
import type { CellResult } from "../collective.js";
import {
  CellTimeoutError,
  classifyActual,
  earlyResult,
  errorResult,
  formatFlaky,
  matchesExpected,
  runWithRetries,
  shouldRetry,
  withCellTimeout,
} from "../matrix.js";

//
//
// Mock constants
//

const MAX_TURNS_ERROR = {
  detail: "Model requested function call but exceeded 24 turns",
  reason: LlmResponseErrorReason.MaxTurns,
  status: 429,
  title: "Too Many Requests",
};

const RATE_LIMIT_ERROR = {
  detail: "Rate limit exceeded",
  status: 429,
  title: "Too Many Requests",
};

// The shape `earlyResult` reads: `error`, and `stopReason` on the exchange
// envelope. Nothing else on the response is consulted.
function settled({
  error,
  stopReason,
}: {
  error?: unknown;
  stopReason?: string;
} = {}) {
  return {
    error,
    exchange: { response: { stopReason } },
  } as unknown as Parameters<typeof earlyResult>[0];
}

// The documented default cell deadline, asserted here so a change to it is a
// deliberate edit rather than a silent one.
const DEFAULT_CELL_TIMEOUT_MS = 180_000;

describe("Matrix classification", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(errorResult).toBeFunction();
      expect(classifyActual).toBeFunction();
    });
  });

  describe("Error Conditions", () => {
    it("classifies a provider rate limit as a failure", () => {
      const outcome = errorResult(RATE_LIMIT_ERROR);
      expect(outcome.inconclusive).toBeFalsy();
      expect(classifyActual(outcome, [])).toBe("fail");
      expect(matchesExpected("fail", "ok")).toBe(false);
    });

    it("classifies a thrown error as a failure", () => {
      const outcome = errorResult(new Error("boom"));
      expect(outcome.inconclusive).toBeFalsy();
      expect(classifyActual(outcome, [])).toBe("fail");
    });
  });

  describe("Features", () => {
    describe("A provider refusal is inconclusive, not a capability failure", () => {
      it("classifies a refusal stop reason as a warning", () => {
        const outcome = earlyResult(settled({ stopReason: "refusal" }));
        expect(outcome?.inconclusive).toBe(true);
        expect(classifyActual(outcome!, [])).toBe("warn");
      });

      it("keeps the stop reason so the cell stays visible in ISSUES", () => {
        const outcome = earlyResult(settled({ stopReason: "refusal" }));
        expect(outcome?.detail).toBe(
          "provider refused (stop reason 'refusal')",
        );
      });

      it("prioritizes a refusal stop reason over a settled error", () => {
        // A refusal now settles as an incomplete error (issue: OpenAI
        // `incomplete` status), so the stop reason check runs first and
        // still classifies the cell as inconclusive rather than a failure.
        const outcome = earlyResult(
          settled({ error: RATE_LIMIT_ERROR, stopReason: "refusal" }),
        );
        expect(outcome?.inconclusive).toBe(true);
        expect(classifyActual(outcome!, [])).toBe("warn");
      });

      it("falls through to errorResult when the error carries no refusal", () => {
        const outcome = earlyResult(
          settled({ error: RATE_LIMIT_ERROR, stopReason: "end_turn" }),
        );
        expect(outcome).toEqual(errorResult(RATE_LIMIT_ERROR));
      });

      it("leaves every other settlement to the runner", () => {
        expect(
          earlyResult(settled({ stopReason: "end_turn" })),
        ).toBeUndefined();
        expect(earlyResult(settled())).toBeUndefined();
      });
    });

    describe("Max turns is inconclusive, not a capability failure", () => {
      it("classifies an exhausted turn budget as a warning", () => {
        const outcome = errorResult(MAX_TURNS_ERROR);
        expect(outcome.inconclusive).toBe(true);
        expect(classifyActual(outcome, [])).toBe("warn");
      });

      it("keeps the detail so the cell stays visible in ISSUES", () => {
        const outcome = errorResult(MAX_TURNS_ERROR);
        expect(outcome.detail).toBe(
          "Too Many Requests (429): Model requested function call but exceeded 24 turns",
        );
      });
    });

    describe("A cell is bounded by a deadline", () => {
      it("resolves a cell that answers in time", async () => {
        await expect(withCellTimeout(Promise.resolve("done"))).resolves.toBe(
          "done",
        );
      });

      it("abandons a cell that never answers", async () => {
        vi.useFakeTimers();
        try {
          const cell = withCellTimeout(new Promise(() => {}));
          const settled = vi.fn();
          cell.catch(settled);
          await vi.advanceTimersByTimeAsync(DEFAULT_CELL_TIMEOUT_MS - 1);
          expect(settled).not.toHaveBeenCalled();
          await vi.advanceTimersByTimeAsync(1);
          await expect(cell).rejects.toBeInstanceOf(CellTimeoutError);
        } finally {
          vi.useRealTimers();
        }
      });

      it("classifies an abandoned cell as inconclusive, not a failure", () => {
        const outcome = errorResult(new CellTimeoutError(180));
        expect(outcome.inconclusive).toBe(true);
        expect(outcome.detail).toBe("no response within 180s");
        expect(classifyActual(outcome, [])).toBe("warn");
      });
    });
  });

  describe("An empty refusal throws instead of settling", () => {
    // Llm.operate throws LlmIncompleteError when a cut-off brings back no
    // content; claude-sonnet-5-5 / tools refused that way in CI run
    // 45872115484 and the cell failed instead of warning
    function thrownRefusal() {
      return new LlmIncompleteError("Model stopped before finishing: refusal", {
        response: {
          content: "",
          error: {
            detail: "Model stopped before finishing: refusal",
            reason: LlmResponseErrorReason.Incomplete,
            status: 502,
            title: "Incomplete Response",
          },
          exchange: { response: { stopReason: "refusal" } },
          stopReason: "refusal",
        } as unknown as Parameters<typeof earlyResult>[0],
      });
    }

    it("classifies a thrown refusal as inconclusive", () => {
      const outcome = errorResult(thrownRefusal());
      expect(outcome.inconclusive).toBe(true);
      expect(outcome.detail).toBe("provider refused (stop reason 'refusal')");
      expect(classifyActual(outcome, [])).toBe("warn");
    });

    it("reads the standardized stop reason when no envelope is attached", () => {
      const outcome = earlyResult({
        stopReason: "refusal",
      } as unknown as Parameters<typeof earlyResult>[0]);
      expect(outcome?.inconclusive).toBe(true);
    });

    it("keeps a thrown cut-off for another reason a failure", () => {
      const outcome = errorResult(
        new LlmIncompleteError("Model stopped before finishing: max_tokens", {
          response: {
            content: "",
            exchange: { response: { stopReason: "max_tokens" } },
          } as unknown as Parameters<typeof earlyResult>[0],
        }),
      );
      expect(outcome.inconclusive).toBeFalsy();
    });
  });
});

describe("Matrix retries", () => {
  const ok: CellResult = {
    actual: "ok",
    expected: "ok",
    matches: true,
    warnings: [],
  };
  const fail: CellResult = {
    actual: "fail",
    detail: "Rate limit exceeded",
    expected: "ok",
    matches: false,
    warnings: [],
  };
  const inconclusive: CellResult = {
    actual: "warn",
    detail: "provider refused (stop reason 'refusal')",
    expected: "ok",
    matches: true,
    warnings: [],
  };

  it("retries a mismatch and an inconclusive cell, not a settled one", () => {
    expect(shouldRetry(ok)).toBe(false);
    expect(shouldRetry(fail)).toBe(true);
    expect(shouldRetry(inconclusive)).toBe(true);
    expect(shouldRetry({ ...ok, actual: "skip", expected: "skip" })).toBe(
      false,
    );
  });

  it("runs a passing cell once", async () => {
    const attempt = vi.fn().mockResolvedValue(ok);
    const cell = await runWithRetries(attempt);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(cell.retries).toBeUndefined();
  });

  it("records the attempts before a pass", async () => {
    const attempt = vi
      .fn()
      .mockResolvedValueOnce(inconclusive)
      .mockResolvedValueOnce(fail)
      .mockResolvedValueOnce(ok);
    const cell = await runWithRetries(attempt);
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(cell.actual).toBe("ok");
    expect(cell.retries).toEqual([
      "warn: provider refused (stop reason 'refusal')",
      "fail: Rate limit exceeded",
    ]);
  });

  it("retries at least twice before giving up", async () => {
    const attempt = vi.fn().mockResolvedValue(fail);
    const cell = await runWithRetries(attempt);
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(cell.matches).toBe(false);
    expect(cell.retries).toHaveLength(2);
  });

  it("reports flaky cells with their earlier attempts", () => {
    const rows = new Map([
      [
        "claude-sonnet-5-5",
        new Map([
          ["plain", ok],
          ["tools", { ...ok, retries: ["warn: provider refused"] }],
        ]),
      ],
    ]) as Parameters<typeof formatFlaky>[1];
    expect(formatFlaky([{ model: "claude-sonnet-5-5" }], rows)).toEqual([
      "[claude-sonnet-5-5 / tools] ok on attempt 2",
      "  • attempt 1: warn: provider refused",
    ]);
  });
});
