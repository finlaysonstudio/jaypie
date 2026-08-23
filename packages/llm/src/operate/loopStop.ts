import { TooManyRequestsError } from "@jaypie/errors";

import {
  LlmError,
  LlmResponseErrorReason,
} from "../types/LlmProvider.interface.js";

//
//
// Loop stops
//
// The operate and stream loops settle a response with an error of their own
// when a policy budget runs out. Both stops occur in four places apiece
// (in-loop and resume, operate and stream), and both are indistinguishable
// from a provider failure by status alone: an exhausted turn budget carries
// 429, exactly like a provider rate limit. Building the payload here keeps the
// wording identical everywhere and attaches the `reason` discriminator a
// caller needs to tell the two apart.
//

export const ERROR = {
  BAD_FUNCTION_CALL: "Bad Function Call",
};

/**
 * The model asked for another function call after the turn budget ran out.
 * Nothing failed: the run did not converge inside `maxTurns`.
 */
export function maxTurnsStop(maxTurns: number): LlmError {
  const error = new TooManyRequestsError();
  return {
    detail: `Model requested function call but exceeded ${maxTurns} turns`,
    reason: LlmResponseErrorReason.MaxTurns,
    status: error.status,
    title: error.title,
  };
}

/**
 * Tool execution failed `limit` times in a row, so the loop stopped rather
 * than spend the rest of the budget on the same error.
 */
export function toolErrorsStop(limit: number): LlmError {
  return {
    detail: `Stopped after ${limit} consecutive tool errors`,
    reason: LlmResponseErrorReason.ToolErrors,
    status: 502,
    title: ERROR.BAD_FUNCTION_CALL,
  };
}
