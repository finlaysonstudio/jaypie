import { describe, expect, it } from "vitest";

import { LlmResponseErrorReason } from "../../types/LlmProvider.interface.js";
import {
  ERROR,
  incompleteStop,
  maxTurnsStop,
  toolErrorsStop,
} from "../loopStop.js";

describe("loopStop", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(incompleteStop).toBeFunction();
      expect(maxTurnsStop).toBeFunction();
      expect(toolErrorsStop).toBeFunction();
    });
  });

  describe("Happy Paths", () => {
    it("builds the max-turns stop", () => {
      const stop = maxTurnsStop(24);
      expect(stop).toEqual({
        detail: "Model requested function call but exceeded 24 turns",
        reason: LlmResponseErrorReason.MaxTurns,
        status: 429,
        title: "Too Many Requests",
      });
    });

    it("builds the consecutive-tool-errors stop", () => {
      const stop = toolErrorsStop(6);
      expect(stop).toEqual({
        detail: "Stopped after 6 consecutive tool errors",
        reason: LlmResponseErrorReason.ToolErrors,
        status: 502,
        title: ERROR.BAD_FUNCTION_CALL,
      });
    });

    it("builds the incomplete-response stop from the provider's reason", () => {
      const stop = incompleteStop("content_filter");
      expect(stop).toEqual({
        detail: "Model stopped before finishing: content_filter",
        reason: LlmResponseErrorReason.Incomplete,
        status: 502,
        title: ERROR.INCOMPLETE_RESPONSE,
      });
    });
  });

  describe("Features", () => {
    it("distinguishes an exhausted budget from a provider rate limit", () => {
      // Status alone cannot: a provider 429 carries no reason.
      const stop = maxTurnsStop(2);
      expect(stop.status).toBe(429);
      expect(stop.reason).toBe(LlmResponseErrorReason.MaxTurns);
    });
  });
});
