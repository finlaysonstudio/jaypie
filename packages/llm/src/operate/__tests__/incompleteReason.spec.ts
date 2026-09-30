import { describe, expect, it } from "vitest";

import { LlmStopReason } from "../../types/LlmProvider.interface.js";
import {
  INCOMPLETE_STOP_REASONS,
  incompleteReasonFrom,
  standardStopReason,
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

describe("standardStopReason", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(standardStopReason).toBeFunction();
    });
    it("reports a finished answer with no params", () => {
      expect(standardStopReason()).toBe(LlmStopReason.EndTurn);
    });
  });

  describe("Happy Paths", () => {
    it("maps every provider's output ceiling to max_tokens", () => {
      for (const incompleteReason of [
        "MAX_TOKENS",
        "length",
        "max_output_tokens",
        "max_tokens",
      ]) {
        expect(standardStopReason({ incompleteReason })).toBe(
          LlmStopReason.MaxTokens,
        );
      }
    });
    it("maps filters to content_filter", () => {
      for (const incompleteReason of [
        "BLOCKLIST",
        "PROHIBITED_CONTENT",
        "RECITATION",
        "SAFETY",
        "SPII",
        "content_filter",
        "content_filtered",
        "guardrail_intervened",
      ]) {
        expect(standardStopReason({ incompleteReason })).toBe(
          LlmStopReason.ContentFilter,
        );
      }
    });
    it("maps refusal", () => {
      expect(standardStopReason({ incompleteReason: "refusal" })).toBe(
        LlmStopReason.Refusal,
      );
    });
    it("reports tool calls as tool_use", () => {
      expect(standardStopReason({ hasToolCalls: true })).toBe(
        LlmStopReason.ToolUse,
      );
    });
  });

  describe("Features", () => {
    it("falls back to other for an unmapped incomplete reason", () => {
      expect(standardStopReason({ incompleteReason: "incomplete" })).toBe(
        LlmStopReason.Other,
      );
    });
  });
});
