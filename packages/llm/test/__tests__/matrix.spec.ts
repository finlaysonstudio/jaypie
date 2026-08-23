import { describe, expect, it } from "vitest";

import { LlmResponseErrorReason } from "../../src/index.js";
import { classifyActual, errorResult, matchesExpected } from "../matrix.js";

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
  });
});
