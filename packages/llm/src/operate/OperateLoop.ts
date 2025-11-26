import { BadGatewayError, TooManyRequestsError } from "@jaypie/errors";
import { JsonObject } from "@jaypie/types";

import { Toolkit } from "../tools/Toolkit.class.js";
import {
  LlmHistory,
  LlmInputMessage,
  LlmOperateOptions,
  LlmOperateResponse,
} from "../types/LlmProvider.interface.js";
import { log, maxTurnsFromOptions } from "../util/index.js";
import { ProviderAdapter } from "./adapters/ProviderAdapter.interface.js";
import { HookRunner, hookRunner, LlmHooks } from "./hooks/index.js";
import { InputProcessor, inputProcessor } from "./input/index.js";
import {
  createResponseBuilder,
  ResponseBuilderConfig,
} from "./response/index.js";
import {
  defaultRetryPolicy,
  ErrorClassifier,
  RetryExecutor,
  RetryPolicy,
} from "./retry/index.js";
import { OperateContext, OperateLoopState, OperateRequest } from "./types.js";

//
//
// Types
//

export interface OperateLoopConfig {
  adapter: ProviderAdapter;
  client: unknown;
  hookRunner?: HookRunner;
  inputProcessor?: InputProcessor;
  maxRetries?: number;
  retryPolicy?: RetryPolicy;
}

//
//
// Constants
//

const ERROR = {
  BAD_FUNCTION_CALL: "Bad Function Call",
};

//
//
// Helpers
//

/**
 * Create an ErrorClassifier from a ProviderAdapter
 */
function createErrorClassifier(adapter: ProviderAdapter): ErrorClassifier {
  return {
    isRetryable: (error: unknown) => adapter.isRetryableError(error),
    isKnownError: (error: unknown) => {
      const classified = adapter.classifyError(error);
      return classified.category !== "unknown";
    },
  };
}

//
//
// Main
//

/**
 * OperateLoop implements the core multi-turn conversation loop.
 * It orchestrates provider adapters, retry logic, hook execution, and tool calling.
 *
 * This class uses Template Method + Strategy patterns:
 * - Template Method: The execute() method defines the algorithm skeleton
 * - Strategy: Provider adapters handle provider-specific operations
 */
export class OperateLoop {
  private readonly adapter: ProviderAdapter;
  private readonly client: unknown;
  private readonly hookRunnerInstance: HookRunner;
  private readonly inputProcessorInstance: InputProcessor;
  private readonly maxRetries: number;
  private readonly retryPolicy: RetryPolicy;

  constructor(config: OperateLoopConfig) {
    this.adapter = config.adapter;
    this.client = config.client;
    this.hookRunnerInstance = config.hookRunner ?? hookRunner;
    this.inputProcessorInstance = config.inputProcessor ?? inputProcessor;
    this.maxRetries = config.maxRetries ?? 6;
    this.retryPolicy = config.retryPolicy ?? defaultRetryPolicy;
  }

  /**
   * Execute the operate loop for multi-turn conversations with tool calling.
   */
  async execute(
    input: string | LlmHistory | LlmInputMessage,
    options: LlmOperateOptions = {},
  ): Promise<LlmOperateResponse> {
    // Initialize state
    const state = this.initializeState(input, options);
    const context = this.createContext(options);

    // Build initial request
    let request = this.buildInitialRequest(state, options);

    // Multi-turn loop
    while (state.currentTurn < state.maxTurns) {
      state.currentTurn++;

      // Execute one turn with retry logic
      const shouldContinue = await this.executeOneTurn(
        request,
        state,
        context,
        options,
      );

      if (!shouldContinue) {
        break;
      }

      // Rebuild request with updated history for next turn
      request = {
        format: state.formattedFormat,
        instructions: options.instructions,
        messages: state.currentInput,
        model: options.model ?? this.adapter.defaultModel,
        providerOptions: options.providerOptions,
        system: options.system,
        tools: state.formattedTools,
        user: options.user,
      };
    }

    return state.responseBuilder.build();
  }

  //
  // Private Methods
  //

  private initializeState(
    input: string | LlmHistory | LlmInputMessage,
    options: LlmOperateOptions,
  ): OperateLoopState {
    // Process input with placeholders
    const processedInput = this.inputProcessorInstance.process(input, options);

    // Determine max turns
    const maxTurns = maxTurnsFromOptions(options);

    // Initialize response builder
    const responseBuilderConfig: ResponseBuilderConfig = {
      model: options.model ?? this.adapter.defaultModel,
      provider: this.adapter.name,
    };
    const responseBuilder = createResponseBuilder(responseBuilderConfig);

    // Set initial history
    responseBuilder.setHistory([...processedInput.history]);

    // Get toolkit
    let toolkit: Toolkit | undefined;
    if (options.tools) {
      if (options.tools instanceof Toolkit) {
        toolkit = options.tools;
      } else if (Array.isArray(options.tools) && options.tools.length > 0) {
        const explain = options.explain ?? false;
        toolkit = new Toolkit(options.tools, { explain });
      }
    }

    // Format output schema through adapter if provided
    let formattedFormat: JsonObject | undefined;
    if (options.format) {
      formattedFormat = this.adapter.formatOutputSchema(
        options.format,
      ) as JsonObject;
    }

    // Format tools through adapter
    const formattedTools = toolkit
      ? this.adapter.formatTools(toolkit, formattedFormat)
      : undefined;

    return {
      currentInput: processedInput.history,
      currentTurn: 0,
      formattedFormat,
      formattedTools,
      maxTurns,
      responseBuilder,
      toolkit,
    };
  }

  private createContext(options: LlmOperateOptions): OperateContext {
    return {
      hooks: options.hooks ?? {},
      options,
    };
  }

  private buildInitialRequest(
    state: OperateLoopState,
    options: LlmOperateOptions,
  ): OperateRequest {
    return {
      format: state.formattedFormat,
      instructions: options.instructions,
      messages: state.currentInput,
      model: options.model ?? this.adapter.defaultModel,
      providerOptions: options.providerOptions,
      system: options.system,
      tools: state.formattedTools,
      user: options.user,
    };
  }

  private async executeOneTurn(
    request: OperateRequest,
    state: OperateLoopState,
    context: OperateContext,
    options: LlmOperateOptions,
  ): Promise<boolean> {
    // Create error classifier from adapter
    const errorClassifier = createErrorClassifier(this.adapter);

    // Create retry executor for this turn
    const retryExecutor = new RetryExecutor({
      errorClassifier,
      hookRunner: this.hookRunnerInstance,
      policy: this.retryPolicy,
    });

    // Build provider-specific request
    const providerRequest = this.adapter.buildRequest(request);

    // Execute beforeEachModelRequest hook
    await this.hookRunnerInstance.runBeforeModelRequest(context.hooks, {
      input: state.currentInput,
      options,
      providerRequest,
    });

    // Execute with retry (RetryExecutor handles error hooks and throws appropriate errors)
    const response = await retryExecutor.execute(
      () => this.adapter.executeRequest(this.client, providerRequest),
      {
        context: {
          input: state.currentInput,
          options,
          providerRequest,
        },
        hooks: context.hooks as LlmHooks,
      },
    );

    // Parse response
    const parsed = this.adapter.parseResponse(response, options);

    // Track usage
    if (parsed.usage) {
      state.responseBuilder.addUsage(parsed.usage);
    }

    // Add raw response

    state.responseBuilder.addResponse(parsed.raw as any);

    // Execute afterEachModelResponse hook
    const currentUsage = state.responseBuilder.build().usage;
    await this.hookRunnerInstance.runAfterModelResponse(context.hooks, {
      content: parsed.content ?? "",
      input: state.currentInput,
      options,
      providerRequest,
      providerResponse: response,
      usage: currentUsage,
    });

    // Check for structured output (Anthropic magic tool pattern)
    if (this.adapter.hasStructuredOutput(response)) {
      const structuredOutput = this.adapter.extractStructuredOutput(response);
      if (structuredOutput) {
        state.responseBuilder.setContent(structuredOutput);
        state.responseBuilder.complete();
        return false; // Stop loop
      }
    }

    // Handle tool calls
    if (parsed.hasToolCalls) {
      const toolCalls = this.adapter.extractToolCalls(response);

      if (toolCalls.length > 0 && state.toolkit && state.maxTurns > 1) {
        // Track updated provider request for tool results
        let currentProviderRequest = providerRequest;

        // Process each tool call
        for (const toolCall of toolCalls) {
          try {
            // Execute beforeEachTool hook
            await this.hookRunnerInstance.runBeforeTool(context.hooks, {
              args: toolCall.arguments,
              toolName: toolCall.name,
            });

            // Call the tool
            log.trace(`[operate] Calling tool - ${toolCall.name}`);
            const result = await state.toolkit.call({
              arguments: toolCall.arguments,
              name: toolCall.name,
            });

            // Execute afterEachTool hook
            await this.hookRunnerInstance.runAfterTool(context.hooks, {
              args: toolCall.arguments,
              result,
              toolName: toolCall.name,
            });

            // Format result and append to request
            const formattedResult = {
              callId: toolCall.callId,
              output: JSON.stringify(result),
              success: true,
            };

            // Update provider request with tool result
            currentProviderRequest = this.adapter.appendToolResult(
              currentProviderRequest,
              toolCall,
              formattedResult,
            );

            // Sync state from updated request
            this.syncInputFromRequest(state, currentProviderRequest);

            // Add tool result to history
            const toolResultFormatted = this.adapter.formatToolResult(
              toolCall,
              formattedResult,
            );
            state.responseBuilder.appendToHistory(
              toolResultFormatted as LlmInputMessage,
            );
          } catch (error) {
            // Execute onToolError hook
            await this.hookRunnerInstance.runOnToolError(context.hooks, {
              args: toolCall.arguments,
              error: error as Error,
              toolName: toolCall.name,
            });

            // Set error on response
            const jaypieError = new BadGatewayError();
            const detail = [
              `Error executing function call ${toolCall.name}.`,
              (error as Error).message,
            ].join("\n");
            state.responseBuilder.setError({
              detail,
              status: jaypieError.status,
              title: ERROR.BAD_FUNCTION_CALL,
            });

            log.error(`Error executing function call ${toolCall.name}`);
            log.var({ error });
          }
        }

        // Check if we've reached max turns
        if (state.currentTurn >= state.maxTurns) {
          const error = new TooManyRequestsError();
          const detail = `Model requested function call but exceeded ${state.maxTurns} turns`;
          log.warn(detail);
          state.responseBuilder.setError({
            detail,
            status: error.status,
            title: error.title,
          });
          state.responseBuilder.incomplete();
          return false; // Stop loop
        }

        return true; // Continue to next turn
      }
    }

    // No tool calls or no toolkit - we're done
    state.responseBuilder.setContent(parsed.content);
    state.responseBuilder.complete();

    // Add final history items
    const historyItems = this.adapter.responseToHistoryItems(parsed.raw);
    for (const item of historyItems) {
      state.responseBuilder.appendToHistory(item);
    }

    return false; // Stop loop
  }

  /**
   * Sync the current input state from the updated provider request.
   * This is necessary because appendToolResult modifies the provider-specific request,
   * and we need to keep our state in sync.
   */
  private syncInputFromRequest(
    state: OperateLoopState,
    updatedRequest: unknown,
  ): void {
    // Extract input/messages from the updated request
    // This is provider-specific but follows common patterns
    const request = updatedRequest as Record<string, unknown>;

    if (Array.isArray(request.input)) {
      // OpenAI format
      state.currentInput = request.input as LlmHistory;
    } else if (Array.isArray(request.messages)) {
      // Anthropic format
      state.currentInput = request.messages as LlmHistory;
    }
  }
}

//
//
// Factory
//

/**
 * Create an OperateLoop instance with the specified configuration.
 */
export function createOperateLoop(config: OperateLoopConfig): OperateLoop {
  return new OperateLoop(config);
}
