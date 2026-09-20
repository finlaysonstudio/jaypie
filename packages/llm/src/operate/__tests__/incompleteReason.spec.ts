import { describe, expect, it } from "vitest";

import {
  INCOMPLETE_STOP_REASONS,
  incompleteReasonFrom,
} from "../incompleteReason.js";

describe("incompleteReason", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(incompleteReasonFrom).toBeFunction();
    });
    it("returns undefined for a missing stop reason", () => {
      expect(
        incompleteReasonFrom(undefined, INCOMPLETE_STOP_REASONS.ANTHROPIC),
      ).toBeUndefined();
      expect(
        incompleteReasonFrom(null, INCOMPLETE_STOP_REASONS.ANTHROPIC),
      ).toBeUndefined();
    });
  });

  describe("Happy Paths", () => {
    it("returns the stop reason when it means the model did not finish", () => {
      expect(
        incompleteReasonFrom("max_tokens", INCOMPLETE_STOP_REASONS.ANTHROPIC),
      ).toBe("max_tokens");
      expect(
        incompleteReasonFrom("SAFETY", INCOMPLETE_STOP_REASONS.GOOGLE),
      ).toBe("SAFETY");
      expect(
        incompleteReasonFrom(
          "length",
          INCOMPLETE_STOP_REASONS.CHAT_COMPLETIONS,
        ),
      ).toBe("length");
      expect(
        incompleteReasonFrom(
          "guardrail_intervened",
          INCOMPLETE_STOP_REASONS.BEDROCK,
        ),
      ).toBe("guardrail_intervened");
    });
    it("returns undefined when the model finished", () => {
      expect(
        incompleteReasonFrom("end_turn", INCOMPLETE_STOP_REASONS.ANTHROPIC),
      ).toBeUndefined();
      expect(
        incompleteReasonFrom("STOP", INCOMPLETE_STOP_REASONS.GOOGLE),
      ).toBeUndefined();
      expect(
        incompleteReasonFrom(
          "tool_calls",
          INCOMPLETE_STOP_REASONS.CHAT_COMPLETIONS,
        ),
      ).toBeUndefined();
    });
  });

  describe("Features", () => {
    it("keeps the lists apart so one API's finish is not another's stop", () => {
      // Anthropic's tool_use is a finish; Google's MAX_TOKENS is a stop only in its own casing
      expect(
        incompleteReasonFrom("tool_use", INCOMPLETE_STOP_REASONS.ANTHROPIC),
      ).toBeUndefined();
      expect(
        incompleteReasonFrom("MAX_TOKENS", INCOMPLETE_STOP_REASONS.ANTHROPIC),
      ).toBeUndefined();
    });
  });
});
