import { sleep } from "@jaypie/core";
import { BadGatewayError } from "@jaypie/errors";
import { JsonArray } from "@jaypie/types";
import { OpenAI } from "openai";
import { LlmOperateOptions } from "../../types/LlmProvider.interface.js";
import { getLogger } from "./utils.js";

// Constants

const MAX_RETRIES_ABSOLUTE_LIMIT = 100;
const MAX_RETRIES_CONFIGURED_HARD_LIMIT = 10;
const MAX_RETRIES_DEFAULT_LIMIT = 5;

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
  context: { client: OpenAI; maxRetries: number } = {
    client: new OpenAI(),
    maxRetries: MAX_RETRIES_DEFAULT_LIMIT,
  },
): Promise<JsonArray> {
  const log = getLogger();
  const openai = context.client;
  console.log("input :>> ", input);

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
    } catch (error) {
      // Check if we've reached the maximum number of retries
      if (retryCount >= maxRetries) {
        log.error(`OpenAI API call failed after ${maxRetries} retries`);
        log.var({ error });
        throw new BadGatewayError();
      }

      // Check if the error is retryable (500 server errors)
      const isRetryable =
        error.status === 500 ||
        (error.status >= 502 && error.status <= 504) ||
        error.message?.includes("timeout");

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
