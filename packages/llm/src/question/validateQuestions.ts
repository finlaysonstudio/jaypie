import { BadRequestError } from "@jaypie/errors";

import {
  LlmQuestion,
  LlmQuestions,
  LlmQuestionText,
  LlmQuestionType,
} from "../types/LlmQuestion.interface.js";

//
//
// Constants
//

/** TypeSafe caps a choice at 255 options. */
export const MAX_CHOICE_OPTIONS = 255;
/** TypeSafe requires a score scale of 2 to 10 ordered levels. */
export const MAX_SCORE_LEVELS = 10;
export const MIN_SCORE_LEVELS = 2;

const QUESTION_TYPES: string[] = [
  LlmQuestionType.Choice,
  LlmQuestionType.Noul,
  LlmQuestionType.Score,
];

//
//
// Helpers
//

function isEmptyText(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (value && typeof value === "object") {
    return Object.keys(value).length === 0;
  }
  return true;
}

function validateText({
  id,
  label,
  value,
}: {
  id: string;
  label: string;
  value: LlmQuestionText | null | undefined;
}): void {
  if (isEmptyText(value)) {
    throw new BadRequestError(
      `Question "${id}": ${label} must be a non-empty string, object, or array`,
    );
  }
}

function validateChoice(id: string, question: LlmQuestion): void {
  const { criteria } = question as { criteria?: Record<string, unknown> };
  if (!criteria || Array.isArray(criteria) || typeof criteria !== "object") {
    throw new BadRequestError(
      `Question "${id}": choice requires criteria mapping each option to a description or null`,
    );
  }
  const options = Object.keys(criteria);
  if (options.length === 0) {
    throw new BadRequestError(
      `Question "${id}": choice requires at least one option`,
    );
  }
  if (options.length > MAX_CHOICE_OPTIONS) {
    throw new BadRequestError(
      `Question "${id}": choice allows at most ${MAX_CHOICE_OPTIONS} options, received ${options.length}`,
    );
  }
  for (const option of options) {
    if (option.trim().length === 0) {
      throw new BadRequestError(
        `Question "${id}": choice option names must be non-empty`,
      );
    }
    const description = criteria[option];
    if (description !== null && description !== undefined) {
      validateText({
        id,
        label: `criteria for option "${option}"`,
        value: description as LlmQuestionText,
      });
    }
  }
}

function validateNoul(id: string, question: LlmQuestion): void {
  const { criteria } = question as {
    criteria?: { false?: unknown; true?: unknown };
  };
  if (criteria === undefined) {
    return;
  }
  if (!criteria || Array.isArray(criteria) || typeof criteria !== "object") {
    throw new BadRequestError(
      `Question "${id}": noul criteria must be an object with "true" and/or "false"`,
    );
  }
  for (const key of Object.keys(criteria)) {
    if (key !== "false" && key !== "true") {
      throw new BadRequestError(
        `Question "${id}": noul criteria allows only "true" and "false", received "${key}"`,
      );
    }
    validateText({
      id,
      label: `criteria.${key}`,
      value: criteria[key as "false" | "true"] as LlmQuestionText,
    });
  }
}

function validateScore(id: string, question: LlmQuestion): void {
  const { criteria } = question as { criteria?: unknown };
  if (!Array.isArray(criteria)) {
    throw new BadRequestError(
      `Question "${id}": score requires criteria as an ordered array of levels`,
    );
  }
  if (
    criteria.length < MIN_SCORE_LEVELS ||
    criteria.length > MAX_SCORE_LEVELS
  ) {
    throw new BadRequestError(
      `Question "${id}": score requires ${MIN_SCORE_LEVELS} to ${MAX_SCORE_LEVELS} levels, received ${criteria.length}`,
    );
  }
  const seen = new Set<string>();
  criteria.forEach((level, index) => {
    validateText({ id, label: `criteria[${index}]`, value: level });
    const key = typeof level === "string" ? level : JSON.stringify(level);
    if (seen.has(key)) {
      throw new BadRequestError(
        `Question "${id}": score levels must be unique, "${key}" repeats`,
      );
    }
    seen.add(key);
  });
}

//
//
// Main
//

/**
 * Enforce TypeSafe's question rules before any provider is called. A question
 * that passes here is answerable natively and by the emulator alike, which is
 * what makes a mixed fallback chain safe.
 */
export function validateQuestions(questions: LlmQuestions): void {
  if (!questions || typeof questions !== "object" || Array.isArray(questions)) {
    throw new BadRequestError(
      "Questions must be an object keyed by question id",
    );
  }
  const ids = Object.keys(questions);
  if (ids.length === 0) {
    throw new BadRequestError("At least one question is required");
  }
  for (const id of ids) {
    if (id.trim().length === 0) {
      throw new BadRequestError("Question ids must be non-empty");
    }
    const question = questions[id];
    if (!question || typeof question !== "object" || Array.isArray(question)) {
      throw new BadRequestError(`Question "${id}": must be an object`);
    }
    if (!QUESTION_TYPES.includes(question.type)) {
      throw new BadRequestError(
        `Question "${id}": type must be one of ${QUESTION_TYPES.join(", ")}`,
      );
    }
    validateText({ id, label: "instructions", value: question.instructions });
    switch (question.type) {
      case LlmQuestionType.Choice:
        validateChoice(id, question);
        break;
      case LlmQuestionType.Noul:
        validateNoul(id, question);
        break;
      case LlmQuestionType.Score:
        validateScore(id, question);
        break;
    }
  }
}
