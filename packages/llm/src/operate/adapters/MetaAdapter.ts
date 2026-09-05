import { type LlmEffort, PROVIDER } from "../../constants.js";
import { OpenAiApiError } from "../../providers/openai/client.js";
import { type LlmEffortMapping, toMetaEffort } from "../../util/effort.js";
import { ClassifiedError, ErrorCategory, OperateRequest } from "../types.js";
import { OpenAiAdapter } from "./OpenAiAdapter.js";

//
//
// Constants
//

/** Meta returns 402 when the account cannot be billed. */
const HTTP_PAYMENT_REQUIRED = 402;

/** Every Muse Spark id reasons; `reasoning.effort` and summaries apply. */
const REASONING_MODEL_PATTERN = /^muse-spark/;

//
//
// Helpers
//

function isPaymentRequiredError(error: unknown): boolean {
  return (
    error instanceof OpenAiApiError && error.status === HTTP_PAYMENT_REQUIRED
  );
}

//
//
// Main
//

/**
 * MetaAdapter extends OpenAiAdapter since Meta's Model API serves the OpenAI
 * Responses protocol: typed `input` items, `reasoning` items with
 * `encrypted_content`, `function_call` / `function_call_output`,
 * `text.format`, `prompt_cache_key`, and `input_file` data URIs. Request
 * building, response parsing, tool handling, and streaming are inherited.
 *
 * Divergences handled here:
 * - `user` is deprecated on Meta in favor of `safety_identifier`, so the
 *   field is renamed on the outgoing request.
 * - Reasoning is gated by the `muse-spark` name rather than OpenAI's
 *   `gpt-5+` / o-series patterns, for both `reasoning.effort` and
 *   `reasoning.summary`.
 * - The effort ladder is minimal..max, with `max` limited to the Standard-tier
 *   `muse-spark-1.3`; `none` is rejected and never emitted.
 * - A 402 is a billing failure, not a transient fault, and is not retried.
 */
export class MetaAdapter extends OpenAiAdapter {
  // @ts-expect-error Narrowing override: Meta name differs from parent's literal "openai"
  readonly name = PROVIDER.META.NAME;
  readonly defaultModel = PROVIDER.META.DEFAULT;

  protected supportsReasoningEffort(model: string): boolean {
    return REASONING_MODEL_PATTERN.test(model);
  }

  protected supportsReasoningSummary(model: string): boolean {
    return REASONING_MODEL_PATTERN.test(model);
  }

  protected mapReasoningEffort(
    effort: LlmEffort,
    model: string,
  ): LlmEffortMapping {
    return toMetaEffort(effort, { model });
  }

  buildRequest(request: OperateRequest): unknown {
    const metaRequest = super.buildRequest(request) as Record<string, unknown>;

    // Meta names `safety_identifier` as the successor to the deprecated
    // `user` field; carry the same value under the current name.
    if (metaRequest.user !== undefined) {
      metaRequest.safety_identifier = metaRequest.user;
      delete metaRequest.user;
    }

    return metaRequest;
  }

  classifyError(error: unknown): ClassifiedError {
    if (isPaymentRequiredError(error)) {
      return {
        category: ErrorCategory.Quota,
        error,
        reason: "billing",
        shouldRetry: false,
      };
    }
    return super.classifyError(error);
  }
}

// Export singleton instance
export const metaAdapter = new MetaAdapter();
