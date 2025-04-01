import { sleep, placeholders } from "@jaypie/core";
import { BadGatewayError } from "@jaypie/errors";
import { JsonObject, NaturalSchema } from "@jaypie/types";
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
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { LlmOperateOptions } from "../../types/LlmProvider.interface.js";
import { log, naturalZodSchema } from "../../util";
import { PROVIDER } from "../../constants.js";
import { Toolkit } from "../../tools/Toolkit.class.js";
import {
  OpenAIRawResponse,
  OpenAIResponse,
  OpenAIResponseTurn,
} from "./types.js";

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

export function formatMessage(
  input: string | JsonObject,
  { data, role = "user" }: { data?: JsonObject; role?: string } = {},
): JsonObject {
  if (typeof input === "object") {
    return {
      ...input,
      content: data
        ? placeholders(input.content as string, data)
        : input.content,
      role: input.role || role,
    };
  }

  return {
    content: data ? placeholders(input, data) : input,
    role,
  };
}

export function formatInput(
  input: string | JsonObject | JsonObject[],
  { data, role = "user" }: { data?: JsonObject; role?: string } = {},
): JsonObject[] {
  if (Array.isArray(input)) {
    return input;
  }

  if (typeof input === "object" && input !== null) {
    return [formatMessage(input, { data, role })];
  }

  return [formatMessage(input, { data, role })];
}

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
  input: string | JsonObject | JsonObject[],
  options: LlmOperateOptions = {},
  context: { client: OpenAI; maxRetries?: number } = {
    client: new OpenAI(),
  },
): Promise<OpenAIResponse> {
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
  const allResponses: OpenAIResponseTurn[] = [];

  // Convert string input to array format with placeholders if needed
  let currentInput = formatInput(input, { data: options?.data });

  // Add history to the input if provided
  if (options?.history && Array.isArray(options.history)) {
    currentInput = [...options.history, ...currentInput];
  }

  // Determine max turns from options
  const maxTurns = maxTurnsFromOptions(options);
  const enableMultipleTurns = maxTurns > 1;
  let currentTurn = 0;
  let toolkit: Toolkit | undefined;
  const explain = options?.explain ?? false;

  // Initialize toolkit if tools are provided
  if (options.tools?.length) {
    toolkit = new Toolkit(options.tools, { explain });
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
        };

        if (options?.user) {
          requestOptions.user = options.user;
        }

        // Add any provider-specific options
        if (options?.providerOptions) {
          Object.assign(requestOptions, options.providerOptions);
        }

        if (options?.instructions) {
          // Apply placeholders to instructions if data is provided and placeholders.instructions is undefined or true
          requestOptions.instructions =
            options.data &&
            (options.placeholders?.instructions === undefined ||
              options.placeholders?.instructions)
              ? placeholders(options.instructions, options.data)
              : options.instructions;
        } else if ((options as unknown as { system: string })?.system) {
          // Check for illegal system option, use it as instructions, and log a warning
          log.warn("[operate] Use 'instructions' instead of 'system'.");
          // Apply placeholders to system if data is provided and placeholders.instructions is undefined or true
          requestOptions.instructions =
            options.data &&
            (options.placeholders?.instructions === undefined ||
              options.placeholders?.instructions)
              ? placeholders(
                  (options as unknown as { system: string }).system,
                  options.data,
                )
              : (options as unknown as { system: string }).system;
        }

        if (options?.format) {
          // Check if format is a JsonObject with type "json_schema"
          if (
            typeof options.format === "object" &&
            options.format !== null &&
            !Array.isArray(options.format) &&
            (options.format as JsonObject).type === "json_schema"
          ) {
            // Direct pass-through for JsonObject with type "json_schema"
            requestOptions.text = {
              format: options.format,
            };
          } else {
            // Convert NaturalSchema to Zod schema if needed
            const zodSchema =
              options.format instanceof z.ZodType
                ? options.format
                : naturalZodSchema(options.format as NaturalSchema);
            const responseFormat = zodResponseFormat(zodSchema, "response");

            // Set up structured output format in the format expected by the test
            requestOptions.text = {
              format: {
                name: responseFormat.json_schema.name,
                schema: responseFormat.json_schema.schema,
                strict: responseFormat.json_schema.strict,
                type: responseFormat.type,
              },
            };
          }
        }

        // Add tools if toolkit is initialized
        if (toolkit) {
          requestOptions.tools = toolkit.tools;
        }

        if (currentTurn > 1) {
          log.trace(`[operate] Calling OpenAI Responses API - ${currentTurn}`);
        } else {
          log.trace("[operate] Calling OpenAI Responses API");
        }

        // Use type assertion to handle the OpenAI SDK response type
        const currentResponse = (await openai.responses.create(
          requestOptions,
        )) as unknown as OpenAIRawResponse;
        if (retryCount > 0) {
          log.debug(`OpenAI API call succeeded after ${retryCount} retries`);
        }
        // Add the entire response to allResponses
        allResponses.push(currentResponse as unknown as OpenAIResponseTurn);

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
                    log.trace(`[operate] Calling tool - ${output.name}`);
                    const result = await toolkit.call({
                      name: output.name,
                      arguments: output.arguments,
                    });

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
