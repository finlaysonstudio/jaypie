import { JsonObject } from "@jaypie/types";
import { InternalError, NotImplementedError } from "@jaypie/errors";

import {
  LlmAnswer,
  LlmChoiceQuestion,
  LlmQuestionOptions,
  LlmQuestionResponse,
  LlmQuestions,
  LlmQuestionState,
  LlmQuestionText,
  LlmQuestionType,
  LlmScoreQuestion,
} from "../types/LlmQuestion.interface.js";
import { LlmProvider } from "../types/LlmProvider.interface.js";
import { normalizeDistribution, peakConfidence } from "./confidence.js";

//
//
// Constants
//

const SAFE_KEY = /^[A-Za-z0-9_-]{1,64}$/;

const SYSTEM_PROMPT = [
  "Answer each question about the state below. This is classification, not conversation: produce no prose, only the required JSON.",
  "",
  "Rules:",
  "- Answer every question independently. A question's answer never constrains another's.",
  "- Report probabilities as numbers between 0 and 1 that sum to 1 across a question's options.",
  "- Distribute probability honestly. Reserve near-certainty for a state that admits one reading, and spread mass when the state is ambiguous or silent.",
  "- A noul question takes a single number: the probability the statement is true of the state.",
  "- Judge only what the state supports. Do not supply facts it does not contain.",
].join("\n");

//
//
// Helpers
//

function renderText(value: LlmQuestionText): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function renderState(state: LlmQuestionState): string {
  return typeof state === "string" ? state : JSON.stringify(state, null, 2);
}

/**
 * Map question ids to JSON Schema property names. Ids are caller-chosen and
 * may contain characters a provider's strict schema mode rejects, so anything
 * outside a conservative set becomes `question_<index>` and is mapped back on
 * the answer.
 */
export function buildKeyMap(questions: LlmQuestions): Record<string, string> {
  const used = new Set<string>();
  const map: Record<string, string> = {};
  Object.keys(questions).forEach((id, index) => {
    const key = SAFE_KEY.test(id) && !used.has(id) ? id : `question_${index}`;
    used.add(key);
    map[id] = key;
  });
  return map;
}

/** Option labels for a choice or score question, in index order. */
function levelLabels(question: LlmChoiceQuestion | LlmScoreQuestion): string[] {
  if (question.type === LlmQuestionType.Choice) {
    return Object.keys(question.criteria);
  }
  return question.criteria.map((level) => renderText(level));
}

//
//
// Main
//

/**
 * Render the questions as a system prompt. Ids appear so the model knows which
 * schema property each answer belongs to; options are numbered because the
 * schema asks for probabilities keyed by index, which keeps option names out
 * of JSON Schema property positions entirely.
 */
export function buildQuestionPrompt(questions: LlmQuestions): string {
  const keyMap = buildKeyMap(questions);
  const blocks = Object.entries(questions).map(([id, question], index) => {
    const lines = [
      `${index + 1}. Question "${keyMap[id]}" (${question.type})`,
      `   Instructions: ${renderText(question.instructions)}`,
    ];
    if (question.type === LlmQuestionType.Noul) {
      const criteria = question.criteria ?? {};
      if (criteria.true !== undefined) {
        lines.push(`   True when: ${renderText(criteria.true)}`);
      }
      if (criteria.false !== undefined) {
        lines.push(`   False when: ${renderText(criteria.false)}`);
      }
      lines.push(
        `   Answer "${keyMap[id]}" with one number: the probability this is true.`,
      );
    } else if (question.type === LlmQuestionType.Choice) {
      lines.push("   Options:");
      Object.entries(question.criteria).forEach(
        ([option, description], position) => {
          const suffix =
            description === null || description === undefined
              ? ""
              : `: ${renderText(description)}`;
          lines.push(`     "${position}" = ${option}${suffix}`);
        },
      );
      lines.push(
        `   Answer "${keyMap[id]}" with a probability for every option key.`,
      );
    } else {
      lines.push("   Levels, lowest to highest:");
      question.criteria.forEach((level, position) => {
        lines.push(`     "${position}" = ${renderText(level)}`);
      });
      lines.push(
        `   Answer "${keyMap[id]}" with a probability for every level key.`,
      );
    }
    return lines.join("\n");
  });
  return `${SYSTEM_PROMPT}\n\nQuestions:\n${blocks.join("\n\n")}`;
}

/**
 * JSON Schema for the whole answer set: one property per question, keyed by
 * index string for choice and score. Bounds live in the descriptions rather
 * than `minimum`/`maximum` because strict structured-output modes reject
 * numeric keywords.
 */
export function buildQuestionFormat(questions: LlmQuestions): JsonObject {
  const keyMap = buildKeyMap(questions);
  const properties: Record<string, JsonObject> = {};
  for (const [id, question] of Object.entries(questions)) {
    const key = keyMap[id];
    if (question.type === LlmQuestionType.Noul) {
      properties[key] = {
        description: "Probability between 0 and 1 that the statement is true",
        type: "number",
      };
      continue;
    }
    const labels = levelLabels(question);
    const levelProperties: Record<string, JsonObject> = {};
    labels.forEach((label, index) => {
      levelProperties[String(index)] = {
        description: `Probability for "${label}"`,
        type: "number",
      };
    });
    properties[key] = {
      additionalProperties: false,
      description: "Probabilities between 0 and 1 summing to 1",
      properties: levelProperties,
      required: labels.map((_label, index) => String(index)),
      type: "object",
    };
  }
  return {
    additionalProperties: false,
    properties,
    required: Object.values(keyMap),
    type: "object",
  };
}

/**
 * Turn the model's raw distributions into Jev-shaped answers. A missing or
 * unreadable value throws so the fallback chain moves to the next provider
 * rather than returning a partial answer set.
 */
export function parseQuestionAnswers({
  content,
  questions,
}: {
  content: unknown;
  questions: LlmQuestions;
}): Record<string, LlmAnswer> {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw new InternalError("Question emulation did not return a JSON object");
  }
  const payload = content as Record<string, unknown>;
  const keyMap = buildKeyMap(questions);
  const answers: Record<string, LlmAnswer> = {};

  for (const [id, question] of Object.entries(questions)) {
    const raw = payload[keyMap[id]];
    if (raw === undefined || raw === null) {
      throw new InternalError(
        `Question emulation omitted an answer for "${id}"`,
      );
    }

    if (question.type === LlmQuestionType.Noul) {
      const value = typeof raw === "string" ? Number(raw) : raw;
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new InternalError(
          `Question emulation returned a non-numeric noul for "${id}"`,
        );
      }
      answers[id] = {
        noul: Math.min(1, Math.max(0, value)),
        type: LlmQuestionType.Noul,
      };
      continue;
    }

    if (typeof raw !== "object" || Array.isArray(raw)) {
      throw new InternalError(
        `Question emulation returned a non-object distribution for "${id}"`,
      );
    }
    const labels = levelLabels(question);
    const reported = raw as Record<string, unknown>;
    const distribution: Record<string, number> = {};
    labels.forEach((_label, index) => {
      const key = String(index);
      const value =
        typeof reported[key] === "string"
          ? Number(reported[key])
          : reported[key];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new InternalError(
          `Question emulation omitted probability "${key}" for "${id}"`,
        );
      }
      distribution[key] = value;
    });
    const normalized = normalizeDistribution(distribution);
    const confidence = peakConfidence(normalized);

    if (question.type === LlmQuestionType.Choice) {
      const probabilities: Record<string, number> = {};
      let choice = labels[0];
      let peak = -1;
      labels.forEach((label, index) => {
        const probability = normalized[String(index)];
        probabilities[label] = probability;
        if (probability > peak) {
          choice = label;
          peak = probability;
        }
      });
      answers[id] = {
        choice,
        confidence,
        probabilities,
        type: LlmQuestionType.Choice,
      };
      continue;
    }

    const legend: Record<string, string> = {};
    let score = 0;
    labels.forEach((label, index) => {
      legend[String(index)] = label;
      score += index * normalized[String(index)];
    });
    answers[id] = {
      confidence,
      legend,
      probabilities: normalized,
      score,
      type: LlmQuestionType.Score,
    };
  }

  return answers;
}

/**
 * Answer a question set with a provider that has no native question support,
 * by rigging up a single structured `operate()` call. The model reports the
 * distributions; Jaypie derives choice, score, and confidence from them.
 */
export async function emulateQuestion({
  options,
  provider,
  providerName,
  state,
}: {
  options: LlmQuestionOptions;
  provider: LlmProvider;
  providerName: string;
  state: LlmQuestionState;
}): Promise<LlmQuestionResponse> {
  if (!provider.operate) {
    throw new NotImplementedError(
      `Provider ${providerName} supports neither question nor operate`,
    );
  }
  const { questions } = options;
  const response = await provider.operate(renderState(state), {
    fallback: false,
    format: buildQuestionFormat(questions),
    placeholders: { input: false, system: false },
    retry: options.retry,
    signal: options.signal,
    system: buildQuestionPrompt(questions),
    temperature: 0,
    turns: 1,
    user: options.user,
  });
  return {
    answers: parseQuestionAnswers({ content: response.content, questions }),
    emulated: true,
    fallbackAttempts: 1,
    fallbackUsed: false,
    model: response.model ?? "",
    provider: response.provider ?? providerName,
    responses: response.responses,
    usage: response.usage,
  };
}
