import { describe, expect, it, vi } from "vitest";

import { LlmResponseErrorReason } from "../../src/index.js";
import {
  CellTimeoutError,
  classifyActual,
  errorResult,
  matchesExpected,
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
});
