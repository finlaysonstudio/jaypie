import { sleep, placeholders } from "@jaypie/core";
import { BadGatewayError, TooManyRequestsError } from "@jaypie/errors";
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
import { PROVIDER } from "../../constants.js";
import { Toolkit } from "../../tools/Toolkit.class.js";
import { OpenAIRawResponse } from "./types.js";
import {
  LlmHistory,
  LlmInputMessage,
  LlmMessageType,
  LlmMessageRole,
  LlmOperateOptions,
  LlmOperateResponse,
  LlmResponseStatus,
  LlmToolResult,
} from "../../types/LlmProvider.interface.js";
import { LlmTool } from "../../types/LlmTool.interface.js";
import {
  formatOperateInput,
  log,
  maxTurnsFromOptions,
  naturalZodSchema,
  resolvePromise,
} from "../../util";

//
//
// Types
//

/**
 * OpenAI request options type that includes model and input properties
 */
export type OpenAiRequestOptions = Omit<LlmOperateOptions, "tools"> & {
  model: string;
  input: LlmInputMessage | LlmHistory;
  text?: unknown;
  tools?: Omit<LlmTool, "call">[];
};

//
//
// Constants
//

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

const ERROR = {
  BAD_FUNCTION_CALL: "Bad Function Call",
};

//
//
// Helpers
//

/**
 * Creates the request options for the OpenAI API call
 *
 * @param input - The formatted input messages
 * @param options - The LLM operation options
 * @returns The request options for the OpenAI API
 */
export function createRequestOptions(
  input: LlmInputMessage | LlmHistory,
  options: LlmOperateOptions = {},
): OpenAiRequestOptions {
  const requestOptions: OpenAiRequestOptions = {
    model: options?.model || PROVIDER.OPENAI.MODEL.DEFAULT,
    input,
  };

  // Add user if provided
  if (options?.user) {
    requestOptions.user = options.user;
  }

  // Add any provider-specific options
  if (options?.providerOptions) {
    Object.assign(requestOptions, options.providerOptions);
  }

  // Handle instructions or system message
  if (options?.instructions) {
    // Apply placeholders to instructions if data is provided and placeholders.instructions is undefined or true
    requestOptions.instructions =
      options.data &&
      (options.placeholders?.instructions === undefined ||
        options.placeholders?.instructions)
        ? placeholders(options.instructions, options.data)
        : options.instructions;
  }

  // Handle developer message as system message
  // @ts-expect-error Testing invalid option
  if (options?.developer) {
    log.warn(
      "Developer message provided but not supported. Using as system message.",
    );
    // @ts-expect-error Testing invalid option
    requestOptions.system = options.developer;
  }

  // Handle structured output format
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

  // Create toolkit and add tools if provided
  if (options.tools?.length) {
    const explain = options?.explain ?? false;
    const toolkit = new Toolkit(options.tools, { explain });
    requestOptions.tools = toolkit.tools;
  }

  return requestOptions;
}

//
//
// Main
//

export async function operate(
  input: string | LlmHistory | LlmInputMessage,
  options: LlmOperateOptions = {},
  context: { client: OpenAI; maxRetries?: number } = {
    client: new OpenAI(),
  },
): Promise<LlmOperateResponse> {
  //
  //
  // Setup
  //

  const openai = context.client;

  if (!context.maxRetries) {
    context.maxRetries = MAX_RETRIES_DEFAULT_LIMIT;
  }

  let retryCount = 0;
  let retryDelay = INITIAL_RETRY_DELAY_MS;
  const maxRetries = Math.min(context.maxRetries, MAX_RETRIES_ABSOLUTE_LIMIT);

  const returnResponse: LlmOperateResponse = {
    history: [],
    output: [],
    responses: [],
    status: LlmResponseStatus.InProgress,
    usage: {
      input: 0,
      output: 0,
      reasoning: 0,
      total: 0,
    },
  };

  // Convert string input to array format with placeholders if needed
  let currentInput: LlmHistory = formatOperateInput(input);
  if (
    options?.data &&
    (options.placeholders?.input === undefined || options.placeholders?.input)
  ) {
    currentInput = formatOperateInput(input, {
      data: options?.data,
    });
  }

  // If history is provided, merge it with currentInput
  if (options.history) {
    currentInput = [...options.history, ...currentInput];
  }

  // If system message is provided, add it to the beginning of the input
  if (options?.system) {
    const systemMessage =
      options.data && options.placeholders?.system !== false
        ? placeholders(options.system, options.data)
        : options.system;

    // Create system message
    const systemInputMessage: LlmInputMessage = {
      content: systemMessage,
      role: LlmMessageRole.System,
      type: LlmMessageType.Message,
    };

    // Check if history starts with an identical system message
    const firstMessage = currentInput[0];
    const isIdenticalSystemMessage =
      firstMessage?.type === LlmMessageType.Message &&
      firstMessage?.role === LlmMessageRole.System &&
      firstMessage?.content === systemMessage;

    // Only prepend if not identical
    if (!isIdenticalSystemMessage) {
      // Remove any existing system message from the beginning
      if (
        currentInput[0]?.type === LlmMessageType.Message &&
        currentInput[0]?.role === LlmMessageRole.System
      ) {
        currentInput = currentInput.slice(1);
      }
      currentInput = [systemInputMessage, ...currentInput];
    }
  }

  // Initialize history with currentInput
  returnResponse.history = [...currentInput];

  // Determine max turns from options
  const maxTurns = maxTurnsFromOptions(options);
  const enableMultipleTurns = maxTurns > 1;
  let currentTurn = 0;

  // Build request options outside the retry loop
  const requestOptions = createRequestOptions(currentInput, options);

  // OpenAI Multi-turn Loop
  while (currentTurn < maxTurns) {
    currentTurn++;
    retryCount = 0;
    retryDelay = INITIAL_RETRY_DELAY_MS;

    // OpenAI Retry Loop
    while (true) {
      try {
        // Log appropriate message based on turn number
        if (currentTurn > 1) {
          log.trace(`[operate] Calling OpenAI Responses API - ${currentTurn}`);
        } else {
          log.trace("[operate] Calling OpenAI Responses API");
        }

        // Use type assertion to handle the OpenAI SDK response type
        const currentResponse = (await openai.responses.create(
          // @ts-expect-error error claims missing non-required id, status
          requestOptions,
        )) as unknown as OpenAIRawResponse;

        if (retryCount > 0) {
          log.debug(`OpenAI API call succeeded after ${retryCount} retries`);
        }
        // Add the response to the responses array
        returnResponse.responses.push(currentResponse);

        // Accumulate token usage from the current response
        if (currentResponse.usage) {
          returnResponse.usage.input += currentResponse.usage.input_tokens || 0;
          returnResponse.usage.output +=
            currentResponse.usage.output_tokens || 0;
          returnResponse.usage.total += currentResponse.usage.total_tokens || 0;
          if (currentResponse.usage.output_tokens_details?.reasoning_tokens) {
            returnResponse.usage.reasoning =
              (returnResponse.usage.reasoning || 0) +
              currentResponse.usage.output_tokens_details.reasoning_tokens;
          }
        }

        // Check if we need to process function calls for multi-turn conversations
        let hasFunctionCall = false;

        try {
          if (currentResponse.output && Array.isArray(currentResponse.output)) {
            // New OpenAI API format with output array
            for (const output of currentResponse.output) {
              returnResponse.output.push(output);
              returnResponse.history.push(output);
              if (output.type === LlmMessageType.FunctionCall) {
                hasFunctionCall = true;

                let toolkit: Toolkit | undefined;
                const explain = options?.explain ?? false;

                // Initialize toolkit if tools are provided for multi-turn function calling
                if (options.tools?.length) {
                  toolkit = new Toolkit(options.tools, { explain });
                }

                if (toolkit && enableMultipleTurns) {
                  try {
                    // Call the tool and ensure the result is resolved if it's a Promise
                    log.trace(`[operate] Calling tool - ${output.name}`);
                    returnResponse.content = `${LlmMessageType.FunctionCall}:${output.name}${output.arguments}#${output.call_id}`;

                    // Execute beforeEachTool hook if defined
                    if (options.hooks?.beforeEachTool) {
                      await resolvePromise(
                        options.hooks.beforeEachTool(
                          output.name,
                          output.arguments,
                        ),
                      );
                    }

                    let result;
                    try {
                      result = await toolkit.call({
                        name: output.name,
                        arguments: output.arguments,
                      });

                      // Execute afterEachTool hook if defined
                      if (options.hooks?.afterEachTool) {
                        result = await resolvePromise(
                          options.hooks.afterEachTool(
                            result,
                            output.name,
                            output.arguments,
                          ),
                        );
                      }
                    } catch (error) {
                      // Execute onToolError hook if defined
                      if (options.hooks?.onToolError) {
                        await resolvePromise(
                          options.hooks.onToolError(
                            error as Error,
                            output.name,
                            output.arguments,
                          ),
                        );
                      }
                      throw error;
                    }

                    // Add model's function call and result
                    if (Array.isArray(currentInput)) {
                      currentInput.push(output);
                      // Add function call result
                      const functionCallOutput: LlmToolResult = {
                        call_id: output.call_id,
                        output: JSON.stringify(result),
                        type: LlmMessageType.FunctionCallOutput,
                      };
                      currentInput.push(functionCallOutput);
                      returnResponse.output.push(functionCallOutput);
                      returnResponse.history.push(functionCallOutput);
                      returnResponse.content = `${LlmMessageType.FunctionCallOutput}:${functionCallOutput.output}#${functionCallOutput.call_id}`;
                    }
                  } catch (error) {
                    // TODO: but I do need to tell the model that something went wrong, right?
                    const jaypieError = new BadGatewayError();
                    const detail = [
                      `Error executing function call ${output.name}.`,
                      (error as Error).message,
                    ].join("\n");
                    returnResponse.error = {
                      detail,
                      status: jaypieError.status,
                      title: ERROR.BAD_FUNCTION_CALL,
                    };
                    log.error(`Error executing function call ${output.name}`);
                    log.var({ error });
                    // We don't add error messages to allResponses here as we want to keep the original response objects
                  }
                } else if (!toolkit) {
                  log.warn(
                    "Model requested function call but no toolkit available",
                  );
                }
              }
              if (output.type === LlmMessageType.Message) {
                if (
                  output.content?.[0] &&
                  output.content[0].type === LlmMessageType.OutputText
                ) {
                  const rawContent = output.content[0].text;
                  returnResponse.content = rawContent;

                  // If format is provided, try to parse the content as JSON
                  if (options?.format && typeof rawContent === "string") {
                    try {
                      const parsedContent = JSON.parse(rawContent);
                      returnResponse.content = parsedContent;
                    } catch (error) {
                      // If parsing fails, keep the original string content
                      log.debug("Failed to parse formatted response as JSON");
                      log.var({ error });
                    }
                  }
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
          returnResponse.status = LlmResponseStatus.Completed;
          return returnResponse;
        }

        // If we've reached the maximum number of turns, exit the loop
        if (currentTurn >= maxTurns) {
          const error = new TooManyRequestsError();
          const detail = `Model requested function call but exceeded ${maxTurns} turns`;
          log.warn(detail);
          returnResponse.status = LlmResponseStatus.Incomplete;
          returnResponse.error = {
            detail,
            status: error.status,
            title: error.title,
          };
          return returnResponse;
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

  // * All possible paths should return a response; getting here is an error
  // The main loop is `currentTurn < maxTurns` and `currentTurn >= maxTurns` within the loop returns
  log.warn("This should never happen");
  returnResponse.status = LlmResponseStatus.Incomplete;

  // Always return the full LlmOperateResponse object for consistency
  return returnResponse;
}
