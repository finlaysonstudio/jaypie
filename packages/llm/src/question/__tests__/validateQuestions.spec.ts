import { describe, expect, it } from "vitest";

import { LlmQuestions } from "../../types/LlmQuestion.interface.js";
import { MAX_CHOICE_OPTIONS, validateQuestions } from "../validateQuestions.js";

const VALID: LlmQuestions = {
  department: {
    criteria: { billing: "Charges", technical: null },
    instructions: "Which team?",
    type: "choice",
  },
  frustration: {
    criteria: ["Calm", "Angry"],
    instructions: "How frustrated?",
    type: "score",
  },
  urgent: { instructions: "Is this urgent?", type: "noul" },
};

describe("validateQuestions", () => {
  it("Works", () => {
    expect(validateQuestions).toBeFunction();
  });

  describe("Happy Paths", () => {
    it("Accepts one question of each type", () => {
      expect(() => validateQuestions(VALID)).not.toThrow();
    });

    it("Accepts structured instructions and criteria", () => {
      expect(() =>
        validateQuestions({
          nested: {
            criteria: { a: { detail: "text" }, b: ["one", "two"] },
            instructions: { ask: "Which one?" },
            type: "choice",
          },
        } as unknown as LlmQuestions),
      ).not.toThrow();
    });

    it("Accepts noul criteria naming both poles", () => {
      expect(() =>
        validateQuestions({
          urgent: {
            criteria: { false: "Routine", true: "Needs action today" },
            instructions: "Is this urgent?",
            type: "noul",
          },
        }),
      ).not.toThrow();
    });
  });

  describe("Error Conditions", () => {
    it("Rejects an empty question set", () => {
      expect(() => validateQuestions({})).toThrow(
        "At least one question is required",
      );
    });

    it("Rejects an unknown type", () => {
      expect(() =>
        validateQuestions({
          mystery: { instructions: "?", type: "vibe" },
        } as unknown as LlmQuestions),
      ).toThrow('Question "mystery": type must be one of');
    });

    it("Names the question id when instructions are empty", () => {
      expect(() =>
        validateQuestions({ blank: { instructions: "  ", type: "noul" } }),
      ).toThrow('Question "blank": instructions must be');
    });

    it("Rejects a choice with no options", () => {
      expect(() =>
        validateQuestions({
          pick: { criteria: {}, instructions: "Which?", type: "choice" },
        }),
      ).toThrow('Question "pick": choice requires at least one option');
    });

    it("Rejects a choice above the option ceiling", () => {
      const criteria: Record<string, null> = {};
      for (let index = 0; index <= MAX_CHOICE_OPTIONS; index++) {
        criteria[`option_${index}`] = null;
      }
      expect(() =>
        validateQuestions({
          pick: { criteria, instructions: "Which?", type: "choice" },
        }),
      ).toThrow(`at most ${MAX_CHOICE_OPTIONS} options`);
    });

    it("Rejects a choice whose criteria is an array", () => {
      expect(() =>
        validateQuestions({
          pick: {
            criteria: ["a", "b"],
            instructions: "Which?",
            type: "choice",
          },
        } as unknown as LlmQuestions),
      ).toThrow('Question "pick": choice requires criteria');
    });

    it("Rejects a score with one level", () => {
      expect(() =>
        validateQuestions({
          rate: { criteria: ["Only"], instructions: "How?", type: "score" },
        }),
      ).toThrow('Question "rate": score requires 2 to 10 levels, received 1');
    });

    it("Rejects a score with eleven levels", () => {
      expect(() =>
        validateQuestions({
          rate: {
            criteria: Array.from({ length: 11 }, (_v, i) => `Level ${i}`),
            instructions: "How?",
            type: "score",
          },
        }),
      ).toThrow("received 11");
    });

    it("Rejects duplicate score levels", () => {
      expect(() =>
        validateQuestions({
          rate: {
            criteria: ["Calm", "Calm"],
            instructions: "How?",
            type: "score",
          },
        }),
      ).toThrow('Question "rate": score levels must be unique');
    });

    it("Rejects an unknown noul criteria key", () => {
      expect(() =>
        validateQuestions({
          urgent: {
            criteria: { maybe: "Sometimes" },
            instructions: "Is this urgent?",
            type: "noul",
          },
        } as unknown as LlmQuestions),
      ).toThrow('received "maybe"');
    });

    it("Rejects a non-object question set", () => {
      expect(() => validateQuestions([] as unknown as LlmQuestions)).toThrow(
        "Questions must be an object keyed by question id",
      );
    });
  });
});
