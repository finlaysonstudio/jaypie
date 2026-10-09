import { FORMAT_WITH_TOOLS_UNSUPPORTED } from "../constants.js";
import { LlmUnrecoverableError } from "../errors/LlmError.js";
import { LlmOperateOptions } from "../types/LlmProvider.interface.js";
import { getLogger } from "./logger.js";

//
//
// Helpers
//

function hasTools(tools: LlmOperateOptions["tools"]): boolean {
  if (!tools) return false;
  return (Array.isArray(tools) ? tools : tools.tools).length > 0;
}

//
//
// Main
//

/**
 * Whether a model can combine `format` with `tools` in one call. False only
 * for ids listed in `FORMAT_WITH_TOOLS_UNSUPPORTED`.
 */
export function supportsFormatWithTools(model: string): boolean {
  return !FORMAT_WITH_TOOLS_UNSUPPORTED.includes(model);
}

/**
 * Catch a call that asks a model for `format` and `tools` together when the
 * model is known not to converge on the pair. A lone model warns and runs
 * anyway: the caller chose it, and some calls do settle. With `failFast` (a
 * fallback chain with another model waiting) it throws instead, so the chain
 * moves on before the attempt spends its turns restating an answer.
 */
export function guardFormatWithTools({
  failFast = false,
  format,
  model,
  provider,
  tools,
}: Pick<LlmOperateOptions, "failFast" | "format" | "tools"> & {
  model: string;
  provider?: string;
}): void {
  if (!format || !hasTools(tools) || supportsFormatWithTools(model)) return;
  const message = `Model ${model} does not reliably combine format with tools`;
  if (failFast) {
    throw new LlmUnrecoverableError(message, { model, provider });
  }
  getLogger().warn(
    `${message}; expect a slow or incomplete response. Use a different model, or call with only one of format and tools`,
  );
}
