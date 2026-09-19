import { JsonObject, JsonReturn } from "@jaypie/types";
import { NotImplementedError } from "@jaypie/errors";

import { PROVIDER } from "../../constants.js";
import {
  LlmAbortError,
  LlmRateLimitError,
  LlmTransientError,
} from "../../errors/LlmError.js";
import { resolveRetryPolicy } from "../../operate/retry/index.js";
import { isTransientNetworkError } from "../../operate/retry/isTransientNetworkError.js";
import { LlmProvider } from "../../types/LlmProvider.interface.js";
import {
  LlmQuestionOptions,
  LlmQuestionResponse,
  LlmQuestionState,
} from "../../types/LlmQuestion.interface.js";
import { abortableSleep } from "../../util/abortableSleep.js";
import { TypeSafeClient } from "./client.js";
import { getLogger, initializeClient } from "./utils.js";

/**
 * TypeSafe's System One models (Jev) answer typed questions about a state and
 * do nothing else: no text generation, no tools, no conversation, no
 * streaming. `question` is therefore the provider's whole surface; `send` and
 * `operate` are not implemented, and `Llm` routes around their absence.
 */
export class TypeSafeProvider implements LlmProvider {
  private _client?: TypeSafeClient;
  private apiKey?: string;
  private log = getLogger();
  private model: string;

  constructor(
    model: string = PROVIDER.TYPESAFE.DEFAULT,
    { apiKey }: { apiKey?: string } = {},
  ) {
    this.apiKey = apiKey;
    this.model = model;
  }

  private async getClient(): Promise<TypeSafeClient> {
    if (this._client) {
      return this._client;
    }
    this._client = await initializeClient({ apiKey: this.apiKey });
    return this._client;
  }

  async send(): Promise<string | JsonObject> {
    throw new NotImplementedError(
      `Provider ${PROVIDER.TYPESAFE.NAME} answers questions only; use Llm.question`,
    );
  }

  async question(
    state: LlmQuestionState,
    options: LlmQuestionOptions,
  ): Promise<LlmQuestionResponse> {
    const client = await this.getClient();
    const model =
      (typeof options.model === "string" ? options.model : undefined) ??
      this.model;
    const policy = resolveRetryPolicy({ retry: options.retry });
    const body = { model, questions: options.questions, state };

    let rateLimitAttempt = 0;
    let transientAttempt = 0;

    for (;;) {
      if (options.signal?.aborted) {
        throw new LlmAbortError(undefined, {
          model,
          provider: PROVIDER.TYPESAFE.NAME,
        });
      }
      try {
        const response = await client.systemOne(body, {
          signal: options.signal,
        });
        return {
          answers: response.answers,
          emulated: false,
          fallbackAttempts: 1,
          fallbackUsed: false,
          model: response.model ?? model,
          provider: PROVIDER.TYPESAFE.NAME,
          responses: [response as unknown as JsonReturn],
          usage: [
            {
              input: response.usage?.input_tokens ?? 0,
              model: response.model ?? model,
              output: response.usage?.output_tokens ?? 0,
              provider: PROVIDER.TYPESAFE.NAME,
              reasoning: 0,
              total:
                (response.usage?.input_tokens ?? 0) +
                (response.usage?.output_tokens ?? 0),
            },
          ],
        };
      } catch (error) {
        if (
          error instanceof LlmRateLimitError &&
          policy.shouldRetryRateLimit(rateLimitAttempt)
        ) {
          const ms = policy.getRateLimitDelay({
            attempt: rateLimitAttempt,
            suggestedDelayMs: error.retryAfterMs,
          });
          this.log.warn("TypeSafe rate limited; waiting before retry", { ms });
          rateLimitAttempt += 1;
          await abortableSleep({ ms, signal: options.signal });
          continue;
        }
        const transient =
          error instanceof LlmTransientError || isTransientNetworkError(error);
        if (transient && policy.shouldRetry(transientAttempt)) {
          const ms = policy.getDelayForAttempt(transientAttempt);
          this.log.warn("TypeSafe request failed; retrying", { ms });
          transientAttempt += 1;
          await abortableSleep({ ms, signal: options.signal });
          continue;
        }
        throw error;
      }
    }
  }
}
