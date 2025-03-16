import { sleep } from "@jaypie/core";
import { BadGatewayError } from "@jaypie/errors";
import { JsonArray } from "@jaypie/types";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  OpenAI,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
} from "openai";
import { LlmOperateOptions } from "../../types/LlmProvider.interface.js";
import { getLogger } from "./utils.js";
import { PROVIDER } from "../../constants.js";

// Constants

export const MAX_RETRIES_ABSOLUTE_LIMIT = 72;
export const MAX_RETRIES_DEFAULT_LIMIT = 6;

// Retry policy constants
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second
const MAX_RETRY_DELAY_MS = 32000; // 32 seconds
const RETRY_BACKOFF_FACTOR = 2; // Exponential backoff multiplier

const RETRYABLE_ERRORS = [
  APIConnectionError,
  APIConnectionTimeoutError,
  InternalServerError,
];

const NOT_RETRYABLE_ERRORS = [
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
];

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

  // Validate
  if (!context.maxRetries) {
    context.maxRetries = MAX_RETRIES_DEFAULT_LIMIT;
  }
  const model = options?.model || PROVIDER.OPENAI.MODEL.DEFAULT;

  // Setup
  let retryCount = 0;
  let retryDelay = INITIAL_RETRY_DELAY_MS;
  const maxRetries = Math.min(context.maxRetries, MAX_RETRIES_ABSOLUTE_LIMIT);
  const allResponses = [];

  // OpenAI Retry Loop

  while (true) {
    try {
      const currentResponse = await openai.responses.create({
        model,
        input,
        // tools,
        user: options?.user,
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

      // Check if the error is not retryable
      let isNotRetryable = false;
      for (const notRetryableError of NOT_RETRYABLE_ERRORS) {
        if (error instanceof notRetryableError) {
          isNotRetryable = true;
          break;
        }
      }

      if (isNotRetryable) {
        log.error("OpenAI API call failed with non-retryable error");
        log.var({ error });
        throw new BadGatewayError();
      }

      // Warn if this error is not in our known retryable errors
      let isUnknownError = true;
      for (const retryableError of RETRYABLE_ERRORS) {
        if (error instanceof retryableError) {
          isUnknownError = false;
          break;
        }
      }
      if (isUnknownError) {
        log.warn("OpenAI API returned unknown error");
        log.var({ error });
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
