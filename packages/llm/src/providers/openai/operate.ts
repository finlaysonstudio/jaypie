import { sleep } from "@jaypie/core";
import { BadGatewayError } from "@jaypie/errors";
import { JsonArray } from "@jaypie/types";
import { APIError, OpenAI } from "openai";
import { LlmOperateOptions } from "../../types/LlmProvider.interface.js";
import { getLogger } from "./utils.js";

// Constants

const MAX_RETRIES_ABSOLUTE_LIMIT = 72;
const MAX_RETRIES_CONFIGURED_HARD_LIMIT = 12;
const MAX_RETRIES_DEFAULT_LIMIT = 6;

// Retry policy constants
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second
const MAX_RETRY_DELAY_MS = 32000; // 32 seconds
const RETRY_BACKOFF_FACTOR = 2; // Exponential backoff multiplier

//
//
// Helpers
//

//
//
// Main
//

export async function operate(
  input: string,
  options: LlmOperateOptions = {},
  context: { client: OpenAI; maxRetries?: number } = {
    client: new OpenAI(),
  },
): Promise<JsonArray> {
  const log = getLogger();
  const openai = context.client;
  console.log("input :>> ", input);

  // Validate
  if (!context.maxRetries) {
    context.maxRetries = MAX_RETRIES_DEFAULT_LIMIT;
  }

  // Setup
  let retryCount = 0;
  let retryDelay = INITIAL_RETRY_DELAY_MS;
  const maxRetries = Math.min(
    context.maxRetries,
    MAX_RETRIES_CONFIGURED_HARD_LIMIT,
    MAX_RETRIES_ABSOLUTE_LIMIT,
  );
  const allResponses = [];

  // OpenAI Retry Loop

  while (true) {
    try {
      // TODO: Test: Retry after failure
      const currentResponse = await openai.responses.create({
        model: "gpt-4o",
        input,
        // tools,
        // user,
      });
      if (retryCount > 0) {
        log.debug(`OpenAI API call succeeded after ${retryCount} retries`);
      }
      allResponses.push(currentResponse);
      break; // Success, exit the retry loop
    } catch (error: unknown) {
      // Check if we've reached the maximum number of retries
      if (retryCount >= maxRetries) {
        log.error(`OpenAI API call failed after ${maxRetries} retries`);
        log.var({ error });
        throw new BadGatewayError();
      }

      // Type guard for APIError
      const isApiError = error instanceof APIError;

      // Check if the error is retryable (500 server errors)
      let isRetryable = false;

      if (isApiError) {
        const apiError = error as APIError;
        const status = apiError.status || 500;
        isRetryable =
          status === 500 ||
          (status >= 502 && status <= 504) ||
          Boolean(apiError.message?.includes("timeout"));
      } else {
        log.warn("Non-API error occurred; allowing retry");
        log.var({ error });
      }

      if (!isRetryable) {
        log.error("OpenAI API call failed with non-retryable error");
        log.var({ error });
        throw new BadGatewayError();
      }

      // Log the error and retry
      log.warn(`OpenAI API call failed. Retrying in ${retryDelay}ms...`);

      // Wait before retrying
      await sleep(retryDelay);

      // Increase retry count and delay for next attempt (exponential backoff)
      retryCount++;
      retryDelay = Math.min(
        retryDelay * RETRY_BACKOFF_FACTOR,
        MAX_RETRY_DELAY_MS,
      );
    }
  }

  return allResponses;
}
