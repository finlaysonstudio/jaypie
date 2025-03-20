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
const MAX_TURNS_ABSOLUTE_LIMIT = 72;
const MAX_TURNS_DEFAULT_LIMIT = 12;

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

  // Determine max turns for multiple turn conversations
  const enableMultipleTurns =
    options.turns === true ||
    typeof options.turns === "number" ||
    typeof options.maxTurns === "number";
  const maxTurns =
    typeof options.maxTurns === "number"
      ? options.maxTurns
      : typeof options.turns === "number"
        ? options.turns
        : options.turns === true
          ? 10
          : 1; // Default to 10 turns if turns=true, 1 otherwise
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
        allResponses.push(currentResponse);

        // Check if we need another turn - look for tool_calls in the response
        if (
          enableMultipleTurns &&
          currentResponse.content &&
          currentResponse.content.length > 0 &&
          currentResponse.content.some(
            (item) => item.tool_calls && item.tool_calls.length > 0,
          )
        ) {
          // Process tool calls and prepare input for next turn
          const toolCalls = currentResponse.content
            .filter((item) => item.tool_calls)
            .flatMap((item) => item.tool_calls || []);

          if (toolCalls.length > 0 && toolkit) {
            // Process each tool call and collect results
            const toolResults = await Promise.all(
              toolCalls.map(async (toolCall) => {
                try {
                  const result = await toolkit.call({
                    name: toolCall.function.name,
                    arguments: toolCall.function.arguments,
                  });
                  return {
                    tool_call_id: toolCall.id,
                    name: toolCall.function.name,
                    result:
                      typeof result === "object"
                        ? JSON.stringify(result)
                        : String(result),
                  };
                } catch (error) {
                  log.error(`Error calling tool ${toolCall.function.name}`);
                  log.var({ error });
                  return {
                    tool_call_id: toolCall.id,
                    name: toolCall.function.name,
                    result: `Error: ${error instanceof Error ? error.message : String(error)}`,
                  };
                }
              }),
            );

            // Set input for next turn to include tool results
            currentInput = JSON.stringify({
              tool_results: toolResults,
              conversation_id: currentResponse.id,
            });

            // Continue to next turn
            break;
          }
        }

        // If we reach here, we're done with turns or no tool calls were made
        return allResponses;
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
