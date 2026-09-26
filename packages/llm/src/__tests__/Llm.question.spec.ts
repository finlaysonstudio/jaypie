import { afterEach, describe, expect, it, vi } from "vitest";

import Llm from "../Llm.js";
import { PROVIDER } from "../constants.js";
import { LlmQuestions } from "../types/LlmQuestion.interface.js";

const anthropicOperateMock = vi.fn();
const openAiOperateMock = vi.fn();
const typeSafeQuestionMock = vi.fn();

vi.mock("../providers/openai/index.js", () => ({
  OpenAiProvider: vi.fn().mockImplementation(
    class {
      operate = openAiOperateMock;
      send = vi.fn();
    } as any,
  ),
}));

vi.mock("../providers/anthropic/AnthropicProvider.class.js", () => ({
  AnthropicProvider: vi.fn().mockImplementation(
    class {
      operate = anthropicOperateMock;
      send = vi.fn();
    } as any,
  ),
}));

vi.mock("../providers/typesafe/index.js", () => ({
  TypeSafeProvider: vi.fn().mockImplementation(
    class {
      question = typeSafeQuestionMock;
      send = vi.fn();
    } as any,
  ),
}));

vi.mock("@jaypie/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@jaypie/logger")>();
  return {
    ...actual,
    default: {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      trace: vi.fn(),
      warn: vi.fn(),
    },
  };
});

const QUESTIONS: LlmQuestions = {
  department: {
    criteria: { billing: "Charges", technical: "Bugs" },
    instructions: "Which team?",
    type: "choice",
  },
  urgent: { instructions: "Is this urgent?", type: "noul" },
};

const EMULATED_CONTENT = {
  department: { "0": 0.9, "1": 0.1 },
  urgent: 0.8,
};

const NATIVE_RESPONSE = {
  answers: {
    department: {
      choice: "billing",
      confidence: 0.9,
      probabilities: { billing: 0.95, technical: 0.05 },
      type: "choice",
    },
    urgent: { noul: 0.97, type: "noul" },
  },
  emulated: false,
  fallbackAttempts: 1,
  fallbackUsed: false,
  model: "jev-1.13.0",
  provider: PROVIDER.TYPESAFE.NAME,
  responses: [],
  usage: [],
};

afterEach(() => {
  vi.clearAllMocks();
  typeSafeQuestionMock.mockResolvedValue(NATIVE_RESPONSE);
  anthropicOperateMock.mockResolvedValue({
    content: EMULATED_CONTENT,
    model: "claude-haiku-4-5",
    provider: PROVIDER.ANTHROPIC.NAME,
    responses: [],
    usage: [],
  });
  openAiOperateMock.mockResolvedValue({
    content: EMULATED_CONTENT,
    model: "gpt-5.6-luna",
    provider: PROVIDER.OPENAI.NAME,
    responses: [],
    usage: [],
  });
});

describe("Llm.question", () => {
  it("Works", () => {
    expect(Llm.question).toBeFunction();
    expect(new Llm().question).toBeFunction();
  });

  describe("Happy Paths", () => {
    it("Answers natively when the provider implements question", async () => {
      const response = await Llm.question("Charged twice", {
        model: "jev-1.13.0",
        questions: QUESTIONS,
      });
      expect(typeSafeQuestionMock).toHaveBeenCalledOnce();
      expect(response.emulated).toBe(false);
      expect(response.provider).toBe(PROVIDER.TYPESAFE.NAME);
      expect(response.fallbackAttempts).toBe(1);
      expect(response.fallbackUsed).toBe(false);
    });

    it("Emulates on a provider that only operates", async () => {
      const response = await Llm.question("Charged twice", {
        model: "claude-haiku-4-5",
        questions: QUESTIONS,
      });
      expect(anthropicOperateMock).toHaveBeenCalledOnce();
      expect(response.emulated).toBe(true);
      expect(response.answers.department).toMatchObject({ choice: "billing" });
    });

    it("Works from an instance", async () => {
      const llm = new Llm(PROVIDER.ANTHROPIC.NAME);
      const response = await llm.question("Charged twice", {
        questions: QUESTIONS,
      });
      expect(response.emulated).toBe(true);
    });
  });

  describe("Features", () => {
    it("Falls from a native provider to an emulated one", async () => {
      typeSafeQuestionMock.mockRejectedValue(new Error("Jev is down"));
      const response = await Llm.question("Charged twice", {
        model: ["jev-1.13.0", "claude-haiku-4-5"],
        questions: QUESTIONS,
      });
      expect(response.emulated).toBe(true);
      expect(response.fallbackUsed).toBe(true);
      expect(response.fallbackAttempts).toBe(2);
      expect(response.provider).toBe(PROVIDER.ANTHROPIC.NAME);
    });

    it("Does not forward the primary model to a fallback provider", async () => {
      typeSafeQuestionMock.mockRejectedValue(new Error("Jev is down"));
      await Llm.question("Charged twice", {
        model: ["jev-1.13.0", "claude-haiku-4-5"],
        questions: QUESTIONS,
      });
      const [, options] = anthropicOperateMock.mock.calls[0];
      expect(options.model).toBeUndefined();
    });

    it("Walks the whole chain in order", async () => {
      typeSafeQuestionMock.mockRejectedValue(new Error("Jev is down"));
      anthropicOperateMock.mockRejectedValue(new Error("Anthropic is down"));
      const response = await Llm.question("Charged twice", {
        model: ["jev-1.13.0", "claude-haiku-4-5", "gpt-5.6-luna"],
        questions: QUESTIONS,
      });
      expect(response.fallbackAttempts).toBe(3);
      expect(response.provider).toBe(PROVIDER.OPENAI.NAME);
    });

    it("Fails fast on every chain attempt", async () => {
      typeSafeQuestionMock.mockRejectedValue(new Error("Jev is down"));
      await Llm.question("Charged twice", {
        model: ["jev-1.13.0", "claude-haiku-4-5"],
        questions: QUESTIONS,
      });
      const failFast = { rateLimit: false, transient: false };
      const [, nativeOptions] = typeSafeQuestionMock.mock.calls[0];
      expect(nativeOptions.retry).toEqual(failFast);
      const [, lastOptions] = anthropicOperateMock.mock.calls[0];
      expect(lastOptions.retry).toEqual(failFast);
    });

    it("Applies an explicit retry option to the linger pass only", async () => {
      typeSafeQuestionMock.mockRejectedValue(new Error("Jev is down"));
      anthropicOperateMock.mockRejectedValue(new Error("Anthropic is down"));
      const retry = { rateLimit: { maxRetries: 1 } };
      await expect(
        Llm.question("Charged twice", {
          model: ["jev-1.13.0", "claude-haiku-4-5"],
          questions: QUESTIONS,
          retry,
        }),
      ).rejects.toThrow("Jev is down");
      expect(typeSafeQuestionMock.mock.calls[0][1].retry).toEqual({
        rateLimit: false,
        transient: false,
      });
      expect(typeSafeQuestionMock.mock.calls[1][1].retry).toEqual(retry);
    });
  });

  describe("Error Conditions", () => {
    it("Validates before any provider is called", async () => {
      await expect(
        Llm.question("Charged twice", {
          model: "jev-1.13.0",
          questions: {
            rate: { criteria: ["Only"], instructions: "?", type: "score" },
          },
        }),
      ).rejects.toThrow('Question "rate": score requires 2 to 10 levels');
      expect(typeSafeQuestionMock).not.toHaveBeenCalled();
    });

    it("Throws the last error when every provider fails", async () => {
      typeSafeQuestionMock.mockRejectedValue(new Error("Jev is down"));
      anthropicOperateMock.mockRejectedValue(new Error("Anthropic is down"));
      await expect(
        Llm.question("Charged twice", {
          model: ["jev-1.13.0", "claude-haiku-4-5"],
          questions: QUESTIONS,
        }),
      ).rejects.toThrow("Jev is down");
      expect(typeSafeQuestionMock).toHaveBeenCalledTimes(2);
    });

    it("Does not fall back when fallback is false", async () => {
      typeSafeQuestionMock.mockRejectedValue(new Error("Jev is down"));
      await expect(
        Llm.question("Charged twice", {
          fallback: false,
          model: ["jev-1.13.0", "claude-haiku-4-5"],
          questions: QUESTIONS,
        }),
      ).rejects.toThrow("Jev is down");
      expect(anthropicOperateMock).not.toHaveBeenCalled();
    });
  });
});
