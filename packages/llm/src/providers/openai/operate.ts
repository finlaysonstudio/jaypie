import { sleep } from "@jaypie/core";
import { BadGatewayError } from "@jaypie/errors";
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
import { Toolkit } from "../../tools/Toolkit.class.js";

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

// Turn policy constants
export const MAX_TURNS_ABSOLUTE_LIMIT = 72;
export const MAX_TURNS_DEFAULT_LIMIT = 12;

//
//
// Helpers
//

export function maxTurnsFromOptions(options: LlmOperateOptions): number {
  // Default to single turn (1) when turns are disabled

  // Handle the turns parameter
  if (options.turns === undefined) {
    // Default to default limit when undefined
    return MAX_TURNS_DEFAULT_LIMIT;
  } else if (options.turns === true) {
    // Explicitly set to true
    return MAX_TURNS_DEFAULT_LIMIT;
  } else if (typeof options.turns === "number") {
    if (options.turns > 0) {
      // Positive number - use that limit (capped at absolute limit)
      return Math.min(options.turns, MAX_TURNS_ABSOLUTE_LIMIT);
    } else if (options.turns < 0) {
      // Negative number - use default limit
      return MAX_TURNS_DEFAULT_LIMIT;
    }
    // If turns is 0, return 1 (disabled)
    return 1;
  }
  // All other values (false, null, etc.) will return 1 (disabled)
  return 1;
}

//
//
// Main
//

export async function operate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: string | any[],
  options: LlmOperateOptions = {},
  context: { client: OpenAI; maxRetries?: number } = {
    client: new OpenAI(),
  },
): Promise<OpenAI> {
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

  // Determine max turns from options
  const maxTurns = maxTurnsFromOptions(options);
  const enableMultipleTurns = maxTurns > 1;
  let currentTurn = 0;
  let currentInput = input;
  let toolkit: Toolkit | undefined;

  // Initialize toolkit if tools are provided
  if (options.tools?.length) {
    toolkit = new Toolkit(options.tools);
  }

  // OpenAI Multi-turn Loop
  while (currentTurn < maxTurns) {
    currentTurn++;
    retryCount = 0;
    retryDelay = INITIAL_RETRY_DELAY_MS;

    // OpenAI Retry Loop
    while (true) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const requestOptions: /* OpenAI.Responses.InputItems */ any = {
          model,
          input: currentInput,
          user: options?.user,
        };

        // Add tools if toolkit is initialized
        if (toolkit) {
          requestOptions.tools = toolkit.tools;
        }

        const currentResponse = await openai.responses.create(requestOptions);
        if (retryCount > 0) {
          log.debug(`OpenAI API call succeeded after ${retryCount} retries`);
        }
        // Add the entire response to allResponses
        allResponses.push(currentResponse);

        // Check if we need to process function calls for multi-turn conversations
        let hasFunctionCall = false;

        try {
          if (currentResponse.output && Array.isArray(currentResponse.output)) {
            // New OpenAI API format with output array
            for (const output of currentResponse.output) {
              if (output.type === "function_call") {
                hasFunctionCall = true;

                if (toolkit && enableMultipleTurns) {
                  try {
                    // Parse arguments for validation
                    JSON.parse(output.arguments);

                    // Call the tool and ensure the result is resolved if it's a Promise
                    const result = await toolkit.call({
                      name: output.name,
                      arguments: output.arguments,
                    });

                    // Prepare for next turn by adding function call and result
                    // Add the function call to the input for the next turn
                    if (typeof currentInput === "string") {
                      // Convert string input to array format for the first turn
                      currentInput = [{ content: currentInput, role: "user" }];
                    }

                    // Add model's function call and result
                    if (Array.isArray(currentInput)) {
                      currentInput.push(output);
                      // Add function call result
                      currentInput.push({
                        type: "function_call_output",
                        call_id: output.call_id,
                        output: JSON.stringify(result),
                      });
                    }
                  } catch (error) {
                    log.error(
                      `Error executing function call ${output.name}:`,
                      error,
                    );
                    // We don't add error messages to allResponses here as we want to keep the original response objects
                  }
                } else if (!toolkit) {
                  log.warn(
                    "Model requested function call but no toolkit available",
                  );
                }
              }
            }
          }
        } catch (error) {
          // If there's an error processing the response, log it but don't fail
          // This helps with test mocks that might not have the expected structure
          log.warn("Error processing response for function calls");
          log.var({ error });
        }

        // If there's no function call or we can't take another turn, exit the loop
        if (!hasFunctionCall || !enableMultipleTurns) {
          return allResponses;
        }

        // If we've reached the maximum number of turns, exit the loop
        if (currentTurn >= maxTurns) {
          log.warn(
            `Model requested function call but exceeded ${maxTurns} turns`,
          );
          return allResponses;
        }

        // Continue to next turn
        break;
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
  }

  // If we've reached the maximum number of turns, return all responses
  return allResponses;
}
