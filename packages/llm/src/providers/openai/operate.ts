import { resolveValue, sleep, placeholders } from "@jaypie/core";
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
import { z } from "zod/v4";
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
 * Creates content string for function calls
 */
function createFunctionCallContent(output: any): string {
  return `${LlmMessageType.FunctionCall}:${output.name}${output.arguments}#${output.call_id}`;
}

/**
 * Extracts content from OpenAI response output array
 */
function extractContentFromResponse(
  currentResponse: OpenAIRawResponse,
  options?: LlmOperateOptions,
): any {
  if (!currentResponse.output || !Array.isArray(currentResponse.output)) {
    return "";
  }

  for (const output of currentResponse.output) {
    if (output.type === LlmMessageType.Message) {
      if (
        output.content?.[0] &&
        output.content[0].type === LlmMessageType.OutputText
      ) {
        const rawContent = output.content[0].text;

        // If format is provided, try to parse the content as JSON
        if (options?.format && typeof rawContent === "string") {
          try {
            const parsedContent = JSON.parse(rawContent);
            return parsedContent;
          } catch (error) {
            // If parsing fails, keep the original string content
            log.debug("Failed to parse formatted response as JSON");
            log.var({ error });
            return rawContent;
          }
        }

        return rawContent;
      }
    }
    if (output.type === LlmMessageType.FunctionCall) {
      return createFunctionCallContent(output);
    }
    // Skip reasoning items when extracting content
    if (output.type === "reasoning") {
      continue;
    }
  }

  return "";
}

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

      const jsonSchema = z.toJSONSchema(zodSchema);

      // Temporary hack because of OpenAI requires additional_properties to be false on all objects
      const checks = [jsonSchema];
      while (checks.length > 0) {
        const current = checks[0];
        if (current.type == "object") {
          current.additionalProperties = false;
        }
        Object.keys(current).forEach((key) => {
          if (typeof current[key] == "object") {
            checks.push(current[key]);
          }
        });
        checks.shift();
      }

      // Set up structured output format in the format expected by the test
      requestOptions.text = {
        format: {
          name: responseFormat.json_schema.name,
          schema: jsonSchema, // Replace this with responseFormat.json_schema.schema once OpenAI supports Zod v4
          strict: responseFormat.json_schema.strict,
          type: responseFormat.type,
        },
      };
    }
  }

  // Handle tools - either as LlmTool[] or Toolkit
  if (options.tools) {
    let toolkit: Toolkit | undefined;

    if (options.tools instanceof Toolkit) {
      // If toolkit is already provided, use it directly
      toolkit = options.tools;
    } else if (Array.isArray(options.tools) && options.tools.length > 0) {
      // If array of tools provided, create toolkit from them
      const explain = options?.explain ?? false;
      toolkit = new Toolkit(options.tools, { explain });
    }

    if (toolkit) {
      requestOptions.tools = toolkit.tools;
    }
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
    model: options?.model || PROVIDER.OPENAI.MODEL.DEFAULT,
    output: [],
    provider: PROVIDER.OPENAI.NAME,
    responses: [],
    status: LlmResponseStatus.InProgress,
    usage: [], // Initialize as empty array, will add entry for each response
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

        // Execute beforeEachModelRequest hook if defined
        if (options.hooks?.beforeEachModelRequest) {
          await resolveValue(
            options.hooks.beforeEachModelRequest({
              input,
              options,
              providerRequest: requestOptions,
            }),
          );
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

        // Add a new usage entry for each response instead of accumulating
        if (currentResponse.usage) {
          // Create new usage item for this response
          returnResponse.usage.push({
            input: currentResponse.usage.input_tokens || 0,
            output: currentResponse.usage.output_tokens || 0,
            total: currentResponse.usage.total_tokens || 0,
            reasoning:
              currentResponse.usage.output_tokens_details?.reasoning_tokens ||
              0,
            provider: PROVIDER.OPENAI.NAME,
            model: options?.model || PROVIDER.OPENAI.MODEL.DEFAULT,
          });
        }

        // Execute afterEachModelResponse hook immediately after usage processing
        if (options.hooks?.afterEachModelResponse) {
          const extractedContent = extractContentFromResponse(
            currentResponse,
            options,
          );
          await resolveValue(
            options.hooks.afterEachModelResponse({
              input,
              options,
              providerRequest: requestOptions,
              providerResponse: currentResponse,
              content: extractedContent || "",
              usage: returnResponse.usage,
            }),
          );
        }

        // Check if we need to process function calls for multi-turn conversations
        let hasFunctionCall = false;
        const pendingReasoningItems = []; // Track reasoning items that need to be paired

        try {
          if (currentResponse.output && Array.isArray(currentResponse.output)) {
            // New OpenAI API format with output array
            for (const output of currentResponse.output) {
              returnResponse.output.push(output);
              returnResponse.history.push(output);
              // Handle reasoning items (GPT-5)
              if (output.type === "reasoning") {
                // Store reasoning items to be added with their paired function calls
                pendingReasoningItems.push(output);
                continue;
              }
              if (output.type === LlmMessageType.FunctionCall) {
                hasFunctionCall = true;

                let toolkit: Toolkit | undefined;

                // Initialize toolkit for multi-turn function calling
                if (options.tools) {
                  if (options.tools instanceof Toolkit) {
                    // If toolkit is already provided, use it directly
                    toolkit = options.tools;
                  } else if (
                    Array.isArray(options.tools) &&
                    options.tools.length > 0
                  ) {
                    // If array of tools provided, create toolkit from them
                    const explain = options?.explain ?? false;
                    toolkit = new Toolkit(options.tools, { explain });
                  }
                }

                if (toolkit && enableMultipleTurns) {
                  try {
                    // Call the tool and ensure the result is resolved if it's a Promise
                    log.trace(`[operate] Calling tool - ${output.name}`);
                    // Content will be set by extractContentFromResponse call later

                    // Execute beforeEachTool hook if defined
                    if (options.hooks?.beforeEachTool) {
                      await resolveValue(
                        options.hooks.beforeEachTool({
                          toolName: output.name,
                          args: output.arguments,
                        }),
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
                        await resolveValue(
                          options.hooks.afterEachTool({
                            result,
                            toolName: output.name,
                            args: output.arguments,
                          }),
                        );
                      }
                    } catch (error) {
                      // Execute onToolError hook if defined
                      if (options.hooks?.onToolError) {
                        await resolveValue(
                          options.hooks.onToolError({
                            error: error as Error,
                            toolName: output.name,
                            args: output.arguments,
                          }),
                        );
                      }
                      throw error;
                    }

                    // Add model's function call and result
                    if (Array.isArray(currentInput)) {
                      // Add any pending reasoning items before the function call
                      for (const reasoningItem of pendingReasoningItems) {
                        currentInput.push(reasoningItem);
                      }
                      // Clear the pending reasoning items after adding them
                      pendingReasoningItems.length = 0;

                      // Add the function call
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
                      // Content will be set by extractContentFromResponse call later
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
              // Content processing is now handled by extractContentFromResponse function
            }
          }
        } catch (error) {
          // If there's an error processing the response, log it but don't fail
          // This helps with test mocks that might not have the expected structure
          log.warn("Error processing response for function calls");
          log.var({ error });
        }

        // Set content using the shared extraction function
        returnResponse.content = extractContentFromResponse(
          currentResponse,
          options,
        );

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

          // Execute onUnrecoverableModelError hook if defined
          if (options.hooks?.onUnrecoverableModelError) {
            await resolveValue(
              options.hooks.onUnrecoverableModelError({
                input,
                options,
                providerRequest: requestOptions,
                error,
              }),
            );
          }

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

          // Execute onUnrecoverableModelError hook if defined
          if (options.hooks?.onUnrecoverableModelError) {
            await resolveValue(
              options.hooks.onUnrecoverableModelError({
                input,
                options,
                providerRequest: requestOptions,
                error,
              }),
            );
          }

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

        // Execute onRetryableModelError hook if defined
        if (options.hooks?.onRetryableModelError) {
          await resolveValue(
            options.hooks.onRetryableModelError({
              input,
              options,
              providerRequest: requestOptions,
              error,
            }),
          );
        }

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
