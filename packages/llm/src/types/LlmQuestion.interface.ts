import { JsonArray, JsonObject, JsonReturn } from "@jaypie/types";

import { type LlmRetryOptions } from "../operate/retry/RetryPolicy.js";
import type {
  LlmFallbackConfig,
  LlmModelOption,
  LlmUsage,
} from "./LlmProvider.interface.js";

/**
 * The three question primitives. The shape is TypeSafe's (Jev's): every
 * provider answers the same question, natively or through emulation, so a
 * question that validates works anywhere in a fallback chain.
 */
export enum LlmQuestionType {
  Choice = "choice",
  Noul = "noul",
  Score = "score",
}

/**
 * Instruction and criteria text. Jev accepts a string, an object, or an array
 * anywhere prose is expected; structured values are rendered as JSON for
 * providers that only accept text.
 */
export type LlmQuestionText = string | JsonObject | JsonArray;

/** The material the questions are asked about. Text only: no files, no images. */
export type LlmQuestionState = string | JsonObject | JsonArray;

/**
 * A question with a fixed set of named options. `criteria` maps each option to
 * a description, or to `null` when the option name speaks for itself.
 */
export interface LlmChoiceQuestion {
  criteria: Record<string, LlmQuestionText | null>;
  instructions: LlmQuestionText;
  type: "choice";
}

/**
 * A yes-or-no question answered as a probability rather than a boolean.
 * "Noul" is TypeSafe's name for the primitive; the answer carries no
 * confidence because the number is itself the degree of belief.
 */
export interface LlmNoulQuestion {
  criteria?: { false?: LlmQuestionText; true?: LlmQuestionText };
  instructions: LlmQuestionText;
  type: "noul";
}

/**
 * An ordered scale. `criteria` lists 2 to 10 levels from lowest to highest;
 * the answer is the probability-weighted level index.
 */
export interface LlmScoreQuestion {
  criteria: LlmQuestionText[];
  instructions: LlmQuestionText;
  type: "score";
}

export type LlmQuestion =
  LlmChoiceQuestion | LlmNoulQuestion | LlmScoreQuestion;

/** Questions keyed by caller-chosen id. Ids are never sent to the model. */
export type LlmQuestions = Record<string, LlmQuestion>;

export interface LlmChoiceAnswer {
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
  type: "choice";
}

export interface LlmNoulAnswer {
  noul: number;
  type: "noul";
}

export interface LlmScoreAnswer {
  confidence: number;
  /** Level index (as a string) to that level's description */
  legend: Record<string, string>;
  /** Level index (as a string) to that level's probability */
  probabilities: Record<string, number>;
  score: number;
  type: "score";
}

export type LlmAnswer = LlmChoiceAnswer | LlmNoulAnswer | LlmScoreAnswer;

export interface LlmQuestionOptions {
  /** Static form only: key for the resolved provider */
  apiKey?: string;
  /** Chain of fallback providers. `false` disables instance-level fallback. */
  fallback?: LlmFallbackConfig[] | false;
  /** Static form only: provider name */
  llm?: string;
  /** A model id, or a preference-ordered array that becomes a fallback chain */
  model?: LlmModelOption;
  questions: LlmQuestions;
  retry?: LlmRetryOptions;
  signal?: AbortSignal;
  user?: string;
}

export interface LlmQuestionResponse {
  answers: Record<string, LlmAnswer>;
  /**
   * `true` when a traditional model answered through the emulator rather than
   * a System One model answering natively. Probabilities are then
   * model-reported and `confidence` is a Jaypie statistic over them, not a
   * calibrated provider output.
   */
  emulated: boolean;
  /** Number of providers attempted (1 = primary only, >1 = fallback(s) used) */
  fallbackAttempts: number;
  fallbackUsed: boolean;
  model: string;
  provider: string;
  /** Raw provider payloads: the Jev body, or the emulating operate() response */
  responses: JsonReturn[];
  usage: LlmUsage;
}
