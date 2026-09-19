import { describe, expect, it, vi } from "vitest";

import { LlmProvider } from "../../types/LlmProvider.interface.js";
import {
  LlmChoiceAnswer,
  LlmNoulAnswer,
  LlmQuestions,
  LlmScoreAnswer,
} from "../../types/LlmQuestion.interface.js";
import {
  buildKeyMap,
  buildQuestionFormat,
  buildQuestionPrompt,
  emulateQuestion,
  parseQuestionAnswers,
} from "../QuestionEmulator.js";

const QUESTIONS: LlmQuestions = {
  department: {
    criteria: { billing: "Charges", sales: null, technical: "Bugs" },
    instructions: "Which team?",
    type: "choice",
  },
  frustration: {
    criteria: ["Calm", "Frustrated", "Very angry"],
    instructions: "How frustrated?",
    type: "score",
  },
  urgent: { instructions: "Is this urgent?", type: "noul" },
};

const CONTENT = {
  department: { "0": 0.8, "1": 0.1, "2": 0.1 },
  frustration: { "0": 0.1, "1": 0.3, "2": 0.6 },
  urgent: 0.9,
};

function mockProvider(content: unknown): LlmProvider {
  return {
    operate: vi.fn().mockResolvedValue({
      content,
      model: "_MOCK_MODEL",
      provider: "_MOCK_PROVIDER",
      responses: [],
      usage: [{ input: 10, output: 2, reasoning: 0, total: 12 }],
    }),
    send: vi.fn(),
  } as unknown as LlmProvider;
}

describe("buildKeyMap", () => {
  it("Keeps ids that are safe schema property names", () => {
    expect(buildKeyMap(QUESTIONS)).toEqual({
      department: "department",
      frustration: "frustration",
      urgent: "urgent",
    });
  });

  it("Replaces an id a strict schema could reject", () => {
    const map = buildKeyMap({
      "needs triage?": { instructions: "Triage?", type: "noul" },
    });
    expect(map["needs triage?"]).toBe("question_0");
  });
});

describe("buildQuestionPrompt", () => {
  describe("Happy Paths", () => {
    it("Names every question and numbers every option", () => {
      const prompt = buildQuestionPrompt(QUESTIONS);
      expect(prompt).toContain('Question "department" (choice)');
      expect(prompt).toContain('"0" = billing: Charges');
      expect(prompt).toContain('"1" = sales');
      expect(prompt).toContain('Question "frustration" (score)');
      expect(prompt).toContain('"2" = Very angry');
      expect(prompt).toContain('Question "urgent" (noul)');
    });
  });

  describe("Features", () => {
    it("Renders noul criteria as true and false conditions", () => {
      const prompt = buildQuestionPrompt({
        urgent: {
          criteria: { false: "Routine", true: "Needs action" },
          instructions: "Is this urgent?",
          type: "noul",
        },
      });
      expect(prompt).toContain("True when: Needs action");
      expect(prompt).toContain("False when: Routine");
    });

    it("Renders structured instructions as JSON", () => {
      const prompt = buildQuestionPrompt({
        urgent: {
          instructions: { ask: "Is this urgent?" },
          type: "noul",
        },
      } as unknown as LlmQuestions);
      expect(prompt).toContain('{"ask":"Is this urgent?"}');
    });
  });
});

describe("buildQuestionFormat", () => {
  describe("Happy Paths", () => {
    it("Requires one property per question", () => {
      const format = buildQuestionFormat(QUESTIONS);
      expect(format.required).toEqual(["department", "frustration", "urgent"]);
      expect(format.additionalProperties).toBe(false);
    });

    it("Asks for a bare number on a noul question", () => {
      const format = buildQuestionFormat(QUESTIONS) as any;
      expect(format.properties.urgent.type).toBe("number");
    });

    it("Asks for an index-keyed distribution on choice and score", () => {
      const format = buildQuestionFormat(QUESTIONS) as any;
      expect(format.properties.department.required).toEqual(["0", "1", "2"]);
      expect(format.properties.department.additionalProperties).toBe(false);
      expect(format.properties.frustration.required).toEqual(["0", "1", "2"]);
    });

    it("Omits numeric bounds, which strict schema modes reject", () => {
      const format = buildQuestionFormat(QUESTIONS) as any;
      expect(format.properties.urgent.minimum).toBeUndefined();
      expect(format.properties.urgent.maximum).toBeUndefined();
    });
  });
});

describe("parseQuestionAnswers", () => {
  describe("Happy Paths", () => {
    it("Answers choice with the argmax option name", () => {
      const answers = parseQuestionAnswers({
        content: CONTENT,
        questions: QUESTIONS,
      });
      const choice = answers.department as LlmChoiceAnswer;
      expect(choice.type).toBe("choice");
      expect(choice.choice).toBe("billing");
      expect(choice.probabilities).toEqual({
        billing: 0.8,
        sales: 0.1,
        technical: 0.1,
      });
    });

    it("Answers score with the probability-weighted level index", () => {
      const answers = parseQuestionAnswers({
        content: CONTENT,
        questions: QUESTIONS,
      });
      const score = answers.frustration as LlmScoreAnswer;
      expect(score.score).toBeCloseTo(1.5, 10);
      expect(score.legend).toEqual({
        "0": "Calm",
        "1": "Frustrated",
        "2": "Very angry",
      });
    });

    it("Answers noul with the reported probability", () => {
      const answers = parseQuestionAnswers({
        content: CONTENT,
        questions: QUESTIONS,
      });
      expect((answers.urgent as LlmNoulAnswer).noul).toBe(0.9);
    });
  });

  describe("Features", () => {
    it("Normalizes a distribution that does not sum to one", () => {
      const answers = parseQuestionAnswers({
        content: { ...CONTENT, department: { "0": 8, "1": 1, "2": 1 } },
        questions: QUESTIONS,
      });
      const choice = answers.department as LlmChoiceAnswer;
      expect(choice.probabilities.billing).toBeCloseTo(0.8, 10);
    });

    it("Clamps a noul outside the unit interval", () => {
      const answers = parseQuestionAnswers({
        content: { ...CONTENT, urgent: 1.4 },
        questions: QUESTIONS,
      });
      expect((answers.urgent as LlmNoulAnswer).noul).toBe(1);
    });

    it("Accepts numbers reported as strings", () => {
      const answers = parseQuestionAnswers({
        content: { ...CONTENT, urgent: "0.25" },
        questions: QUESTIONS,
      });
      expect((answers.urgent as LlmNoulAnswer).noul).toBe(0.25);
    });
  });

  describe("Error Conditions", () => {
    it("Throws when the content is not an object", () => {
      expect(() =>
        parseQuestionAnswers({ content: "nope", questions: QUESTIONS }),
      ).toThrow("did not return a JSON object");
    });

    it("Throws when an answer is missing", () => {
      const { urgent: _urgent, ...rest } = CONTENT;
      expect(() =>
        parseQuestionAnswers({ content: rest, questions: QUESTIONS }),
      ).toThrow('omitted an answer for "urgent"');
    });

    it("Throws when a distribution omits an option", () => {
      expect(() =>
        parseQuestionAnswers({
          content: { ...CONTENT, department: { "0": 1, "1": 0 } },
          questions: QUESTIONS,
        }),
      ).toThrow('omitted probability "2" for "department"');
    });

    it("Throws when a noul is not numeric", () => {
      expect(() =>
        parseQuestionAnswers({
          content: { ...CONTENT, urgent: "very" },
          questions: QUESTIONS,
        }),
      ).toThrow('non-numeric noul for "urgent"');
    });
  });
});

describe("emulateQuestion", () => {
  describe("Happy Paths", () => {
    it("Answers through a single structured operate call", async () => {
      const provider = mockProvider(CONTENT);
      const response = await emulateQuestion({
        options: { questions: QUESTIONS },
        provider,
        providerName: "_MOCK_PROVIDER",
        state: "Charged twice",
      });
      expect(provider.operate).toHaveBeenCalledOnce();
      expect(response.emulated).toBe(true);
      expect(response.model).toBe("_MOCK_MODEL");
      expect(Object.keys(response.answers)).toEqual([
        "department",
        "frustration",
        "urgent",
      ]);
    });

    it("Serializes a structured state as JSON", async () => {
      const provider = mockProvider(CONTENT);
      await emulateQuestion({
        options: { questions: QUESTIONS },
        provider,
        providerName: "_MOCK_PROVIDER",
        state: { subject: "Charged twice" },
      });
      const [input] = (provider.operate as any).mock.calls[0];
      expect(input).toContain('"subject": "Charged twice"');
    });

    it("Requests one turn at temperature zero with fallback off", async () => {
      const provider = mockProvider(CONTENT);
      await emulateQuestion({
        options: { questions: QUESTIONS },
        provider,
        providerName: "_MOCK_PROVIDER",
        state: "Charged twice",
      });
      const [, options] = (provider.operate as any).mock.calls[0];
      expect(options.fallback).toBe(false);
      expect(options.temperature).toBe(0);
      expect(options.turns).toBe(1);
    });
  });

  describe("Error Conditions", () => {
    it("Throws when the provider cannot operate", async () => {
      await expect(
        emulateQuestion({
          options: { questions: QUESTIONS },
          provider: { send: vi.fn() } as unknown as LlmProvider,
          providerName: "_MOCK_PROVIDER",
          state: "Charged twice",
        }),
      ).rejects.toThrow("supports neither question nor operate");
    });

    it("Throws when the model answers with prose", async () => {
      await expect(
        emulateQuestion({
          options: { questions: QUESTIONS },
          provider: mockProvider("I think it is billing"),
          providerName: "_MOCK_PROVIDER",
          state: "Charged twice",
        }),
      ).rejects.toThrow("did not return a JSON object");
    });
  });
});
