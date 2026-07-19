import { BadGatewayError, TooManyRequestsError } from "@jaypie/errors";
import { JsonObject } from "@jaypie/types";

import { Toolkit } from "../tools/Toolkit.class.js";
import {
  LlmExchangeEnvelope,
  LlmHistory,
  LlmHistoryItem,
  LlmInputMessage,
  LlmMessageRole,
  LlmMessageType,
  LlmOperateInput,
  LlmOperateOptions,
  LlmOperateResponse,
  LlmOutputMessage,
  LlmProgressEventType,
  LlmResponseStatus,
  LlmToolCall,
  LlmToolResult,
} from "../types/LlmProvider.interface.js";
import {
  annotateLlmObs,
  usageToLlmObsMetrics,
  withLlmObsSpan,
} from "../observability/llmobs.js";
import {
  fillFormatArrays,
  getLogger,
  maxTurnsFromOptions,
  repairFormatKeys,
  tallyOperate,
} from "../util/index.js";
import { ProviderAdapter } from "./adapters/ProviderAdapter.interface.js";
import {
  buildExchangeEnvelope,
  isExchangeRequested,
} from "./exchange/index.js";
import { HookRunner, hookRunner, LlmHooks } from "./hooks/index.js";
import { InputProcessor, inputProcessor } from "./input/index.js";
import { emitProgress } from "./progress/index.js";
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
import {
  OperateContext,
  OperateLoopState,
  OperateRequest,
  ProviderToolDefinition,
  StandardToolResult,
} from "./types.js";

//
//
// Types
//

export interface OperateLoopConfig {
  adapter: ProviderAdapter;
  client: unknown;
  hookRunner?: HookRunner;
  inputProcessor?: InputProcessor;
  retryPolicy?: RetryPolicy;
}

//
//
// Constants
//

const ERROR = {
  BAD_FUNCTION_CALL: "Bad Function Call",
};

export const MAX_CONSECUTIVE_TOOL_ERRORS = 6;

//
//
// Helpers
//

/**
 * Create an ErrorClassifier from a ProviderAdapter
 */
function createErrorClassifier(adapter: ProviderAdapter): ErrorClassifier {
  return {
    classify: (error: unknown) => adapter.classifyError(error),
    isRetryable: (error: unknown) => adapter.isRetryableError(error),
    isKnownError: (error: unknown) => {
      const classified = adapter.classifyError(error);
      return classified.category !== "unknown";
    },
  };
}

/**
 * Attempt to read a prose response as the structured payload itself: parse the
 * text (stripping a Markdown code fence if present) and return the object, or
 * undefined when the text is not a JSON object.
 */
function tryParseJsonObject(text: string): JsonObject | undefined {
  let candidate = text.trim();
  const fence = candidate.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) {
    candidate = fence[1].trim();
  }
  if (!candidate.startsWith("{")) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(candidate);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as JsonObject;
    }
  } catch {
    // Not JSON; caller falls through to the corrective-turn path.
  }
  return undefined;
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
  private readonly retryPolicy: RetryPolicy;

  constructor(config: OperateLoopConfig) {
    this.adapter = config.adapter;
    this.client = config.client;
    this.hookRunnerInstance = config.hookRunner ?? hookRunner;
    this.inputProcessorInstance = config.inputProcessor ?? inputProcessor;
    this.retryPolicy = config.retryPolicy ?? defaultRetryPolicy;
  }

  /**
   * Execute the operate loop for multi-turn conversations with tool calling.
   */
  async execute(
    input: string | LlmHistory | LlmInputMessage | LlmOperateInput,
    options: LlmOperateOptions = {},
  ): Promise<LlmOperateResponse> {
    const log = getLogger();
    // Log what was passed to operate
    log.trace("[operate] Starting operate loop");
    log.trace.var({ "operate.input": input });
    log.trace.var({ "operate.options": options });

    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    // Initialize state
    const state = await this.initializeState(input, options);
    const context = this.createContext(options);
    const modelName = options.model ?? this.adapter.defaultModel;
    const exchangeRequested = isExchangeRequested(options);
    const initialHistoryLength = state.responseBuilder.getHistory().length;

    await emitProgress({
      event: {
        maxTurns: state.maxTurns,
        model: modelName,
        provider: this.adapter.name,
        type: LlmProgressEventType.Start,
      },
      onProgress: options.onProgress,
    });

    // Enclosing LLM Observability span (no-op when DD_LLMOBS_ENABLED is unset).
    // Child llm/tool spans nest under it via the SDK's active-span context.
    try {
      return await withLlmObsSpan(
        {
          kind: state.toolkit ? "agent" : "llm",
          modelName,
          modelProvider: this.adapter.name,
          name: "jaypie.llm.operate",
        },
        async () => {
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
              effort: options.effort,
              format: state.formattedFormat,
              instructions: options.instructions,
              messages: state.currentInput,
              model: modelName,
              providerOptions: options.providerOptions,
              structuredOutputRetry: state.structuredOutputRetry,
              system: options.system,
              temperature: options.temperature,
              tools: state.formattedTools,
              user: options.user,
            };
          }

          const response = state.responseBuilder.build();
          if (exchangeRequested) {
            response.exchange = buildExchangeEnvelope({
              duration: Date.now() - startMs,
              initialHistoryLength,
              input,
              options,
              response,
              startedAt,
              state,
            });
          }
          annotateLlmObs({
            inputData: input,
            metrics: usageToLlmObsMetrics(response.usage),
            outputData: response.content,
          });
          tallyOperate({
            toolCallNames: state.toolCallNames,
            turns: state.currentTurn,
            usage: response.usage,
          });
          await emitProgress({
            event: {
              content: response.content,
              turn: state.currentTurn,
              type: LlmProgressEventType.Done,
              usage: response.usage,
            },
            onProgress: options.onProgress,
          });
          return response;
        },
      );
    } catch (error) {
      // A hard failure (retry budget exhausted, unrecoverable) still settles
      // the exchange: attach the envelope to the thrown error so the facade
      // can emit it before rethrowing to the caller.
      if (exchangeRequested) {
        const response = state.responseBuilder.build();
        if (!response.error) {
          const thrown = error as {
            detail?: string;
            message?: string;
            status?: number | string;
            title?: string;
            name?: string;
          };
          response.error = {
            detail: thrown.detail ?? thrown.message,
            status: thrown.status ?? 500,
            title: thrown.title ?? thrown.name ?? "Error",
          };
        }
        if (response.status === LlmResponseStatus.InProgress) {
          response.status = LlmResponseStatus.Incomplete;
        }
        (error as { exchange?: LlmExchangeEnvelope }).exchange =
          buildExchangeEnvelope({
            duration: Date.now() - startMs,
            initialHistoryLength,
            input,
            options,
            response,
            startedAt,
            state,
          });
      }
      throw error;
    }
  }

  //
  // Private Methods
  //

  private async initializeState(
    input: string | LlmHistory | LlmInputMessage | LlmOperateInput,
    options: LlmOperateOptions,
  ): Promise<OperateLoopState> {
    // Process input with placeholders
    const processedInput = await this.inputProcessorInstance.process(
      input,
      options,
    );

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
    // If format is provided but no toolkit, create an empty toolkit
    // so that structured_output tool can be added for providers that need it
    // (Anthropic, OpenRouter use tool-based structured output)
    let formattedTools: ProviderToolDefinition[] | undefined;
    if (toolkit) {
      formattedTools = this.adapter.formatTools(toolkit, formattedFormat);
    } else if (formattedFormat) {
      // Create empty toolkit just for structured output
      const emptyToolkit = new Toolkit([]);
      formattedTools = this.adapter.formatTools(emptyToolkit, formattedFormat);
      // Only include if there are tools (structured_output was added)
      if (formattedTools.length === 0) {
        formattedTools = undefined;
      }
    }

    return {
      consecutiveToolErrors: 0,
      currentInput: processedInput.history,
      currentTurn: 0,
      formattedFormat,
      formattedTools,
      maxTurns,
      responseBuilder,
      retries: 0,
      toolCallNames: [],
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
      effort: options.effort,
      format: state.formattedFormat,
      instructions: options.instructions,
      messages: state.currentInput,
      model: options.model ?? this.adapter.defaultModel,
      providerOptions: options.providerOptions,
      system: options.system,
      temperature: options.temperature,
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
    const log = getLogger();
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

    // Log a draconian subset of the request; the full payload is available
    // via the beforeEachModelRequest hook
    log.trace("[operate] Calling model");
    log.trace.var({
      "operate.request": {
        latest: this.summarizeHistoryItem(
          request.messages[request.messages.length - 1],
        ),
        messages: request.messages.length,
        model: request.model,
        turn: state.currentTurn,
      },
    });

    await emitProgress({
      event: {
        model: request.model,
        turn: state.currentTurn,
        type: LlmProgressEventType.ModelRequest,
      },
      onProgress: options.onProgress,
    });

    // Execute beforeEachModelRequest hook
    await this.hookRunnerInstance.runBeforeModelRequest(context.hooks, {
      input: state.currentInput,
      options,
      providerRequest,
    });

    // Count retries for the exchange envelope and emit retry progress
    // alongside the caller's onRetryableModelError hook
    const hooks = context.hooks as LlmHooks;
    const hooksWithProgress: LlmHooks = {
      ...hooks,
      onRetryableModelError: async (retryContext) => {
        state.retries++;
        await emitProgress({
          event: {
            error:
              retryContext.error instanceof Error
                ? retryContext.error.message
                : String(retryContext.error),
            turn: state.currentTurn,
            type: LlmProgressEventType.Retry,
          },
          onProgress: options.onProgress,
        });
        return hooks?.onRetryableModelError?.(retryContext);
      },
    };

    // Execute with retry inside a child llm span (no-op when llmobs disabled).
    // RetryExecutor handles error hooks and throws appropriate errors.
    const { parsed, response, toolCalls } = await withLlmObsSpan(
      {
        kind: "llm",
        modelName: options.model ?? this.adapter.defaultModel,
        modelProvider: this.adapter.name,
        name: "jaypie.llm.model",
      },
      async () => {
        const response = await retryExecutor.execute(
          (signal) =>
            this.adapter.executeRequest(this.client, providerRequest, signal),
          {
            context: {
              input: state.currentInput,
              model: options.model ?? this.adapter.defaultModel,
              options,
              provider: this.adapter.name,
              providerRequest,
            },
            hooks: hooksWithProgress,
          },
        );

        // Parse response
        const parsed = this.adapter.parseResponse(response, options);
        const toolCalls = parsed.hasToolCalls
          ? this.adapter.extractToolCalls(response)
          : [];

        // Log only the text or tool calls; the full payload is available
        // via the afterEachModelResponse hook
        log.trace("[operate] Model response received");
        log.trace.var({
          "operate.response":
            toolCalls.length > 0
              ? toolCalls.map(({ arguments: args, name }) => ({
                  arguments: args,
                  name,
                }))
              : parsed.content,
        });

        annotateLlmObs({
          inputData: state.currentInput,
          metrics: usageToLlmObsMetrics(
            parsed.usage ? [parsed.usage] : undefined,
          ),
          outputData: parsed.content ?? "",
        });

        return { parsed, response, toolCalls };
      },
    );

    await emitProgress({
      event: {
        content: parsed.content,
        toolCalls: toolCalls.map(({ arguments: args, name }) => ({
          arguments: args,
          name,
        })),
        turn: state.currentTurn,
        type: LlmProgressEventType.ModelResponse,
        usage: parsed.usage ? [parsed.usage] : undefined,
      },
      onProgress: options.onProgress,
    });

    // Track usage
    if (parsed.usage) {
      state.responseBuilder.addUsage(parsed.usage);
    }

    // Track stop reason for the exchange envelope
    if (parsed.stopReason) {
      state.lastStopReason = parsed.stopReason;
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
        state.responseBuilder.setContent(
          this.applyFormatArrayDefaults(structuredOutput, options),
        );
        state.responseBuilder.complete();
        return false; // Stop loop
      }
    }

    // Handle tool calls
    if (parsed.hasToolCalls) {
      if (toolCalls.length > 0 && state.toolkit && state.maxTurns > 1) {
        // Track updated provider request for tool results
        let currentProviderRequest = providerRequest;

        // Add all response output items to the request BEFORE processing tool calls
        // This is critical for OpenAI which requires reasoning items to be present
        // when function_call items reference them
        const responseItems = this.adapter.responseToHistoryItems(response);
        this.appendResponseItemsToRequest(
          currentProviderRequest,
          responseItems,
        );

        // Process each tool call
        for (const toolCall of toolCalls) {
          state.toolCallNames.push(toolCall.name);
          // Resolved once per call; never throws (undefined when tool has no message)
          const toolMessage = await state.toolkit!.resolveMessage({
            arguments: toolCall.arguments,
            name: toolCall.name,
          });
          try {
            await emitProgress({
              event: {
                tool: {
                  arguments: toolCall.arguments,
                  message: toolMessage,
                  name: toolCall.name,
                },
                turn: state.currentTurn,
                type: LlmProgressEventType.ToolCall,
              },
              onProgress: options.onProgress,
            });

            // Execute beforeEachTool hook
            await this.hookRunnerInstance.runBeforeTool(context.hooks, {
              args: toolCall.arguments,
              message: toolMessage,
              toolName: toolCall.name,
            });

            // Call the tool inside a child tool span (no-op when disabled)
            log.trace(`[operate] Calling tool - ${toolCall.name}`);
            const result = await withLlmObsSpan(
              { kind: "tool", name: toolCall.name },
              async () => {
                const result = await state.toolkit!.call({
                  arguments: toolCall.arguments,
                  message: toolMessage,
                  name: toolCall.name,
                });
                annotateLlmObs({
                  inputData: toolCall.arguments,
                  metadata: { tool: toolCall.name },
                  outputData: result,
                });
                return result;
              },
            );

            await emitProgress({
              event: {
                tool: { name: toolCall.name },
                turn: state.currentTurn,
                type: LlmProgressEventType.ToolResult,
              },
              onProgress: options.onProgress,
            });

            // Execute afterEachTool hook
            await this.hookRunnerInstance.runAfterTool(context.hooks, {
              args: toolCall.arguments,
              message: toolMessage,
              result,
              toolName: toolCall.name,
            });

            // Format result and append to request
            const formattedResult = {
              callId: toolCall.callId,
              output: JSON.stringify(result),
              success: true,
            };

            // Reset consecutive error counter on success
            state.consecutiveToolErrors = 0;

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
            await emitProgress({
              event: {
                error: (error as Error).message,
                tool: { name: toolCall.name },
                turn: state.currentTurn,
                type: LlmProgressEventType.ToolError,
              },
              onProgress: options.onProgress,
            });

            // Execute onToolError hook
            await this.hookRunnerInstance.runOnToolError(context.hooks, {
              args: toolCall.arguments,
              error: error as Error,
              message: toolMessage,
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

            // Add error tool_result to history so the tool_use block is not orphaned.
            // Without this, the next turn's request would have a tool_use without a
            // matching tool_result, causing Anthropic API to reject with 400.
            const errorResult: StandardToolResult = {
              callId: toolCall.callId,
              output: JSON.stringify({
                error: (error as Error).message || "Tool execution failed",
              }),
              success: false,
              error: (error as Error).message,
            };
            const toolResultFormatted = this.adapter.formatToolResult(
              toolCall,
              errorResult,
            );
            state.responseBuilder.appendToHistory(
              toolResultFormatted as LlmInputMessage,
            );

            log.warn(`Error executing function call ${toolCall.name}`);
            log.var({ error });

            // Track consecutive errors and stop if threshold reached
            state.consecutiveToolErrors++;
            if (state.consecutiveToolErrors >= MAX_CONSECUTIVE_TOOL_ERRORS) {
              const detail = `Stopped after ${MAX_CONSECUTIVE_TOOL_ERRORS} consecutive tool errors`;
              log.warn(detail);
              state.responseBuilder.setError({
                detail,
                status: 502,
                title: ERROR.BAD_FUNCTION_CALL,
              });
              state.responseBuilder.incomplete();
              return false; // Stop loop
            }
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

    // Format contract enforcement: the loop is about to complete but the
    // model answered with prose instead of structured output.
    if (state.formattedFormat && typeof parsed.content === "string") {
      // First salvage attempt: the text may be the JSON itself (with or
      // without a code fence).
      const salvaged = tryParseJsonObject(parsed.content);
      if (salvaged) {
        state.responseBuilder.setContent(
          this.applyFormatArrayDefaults(salvaged, options),
        );
        state.responseBuilder.complete();
        for (const item of this.adapter.responseToHistoryItems(parsed.raw)) {
          state.responseBuilder.appendToHistory(item);
        }
        return false; // Stop loop
      }

      // Corrective turn: for adapters whose structured output rides a tool
      // emulation, take another turn offering only the structured_output tool
      // and demand it be called. Bounded by maxTurns.
      if (
        this.adapter.supportsStructuredOutputRetry &&
        state.currentTurn < state.maxTurns
      ) {
        log.warn(
          `[operate] Model returned text despite format on turn ${state.currentTurn}; retrying with structured_output tool only`,
        );
        for (const item of this.adapter.responseToHistoryItems(parsed.raw)) {
          state.currentInput.push(item);
          state.responseBuilder.appendToHistory(item);
        }
        const corrective: LlmInputMessage = {
          content:
            "You must provide your final answer by calling the structured_output tool " +
            "with arguments matching the required schema. Do not respond with text.",
          role: LlmMessageRole.User,
          type: LlmMessageType.Message,
        };
        state.currentInput.push(corrective);
        state.responseBuilder.appendToHistory(corrective);
        state.structuredOutputRetry = true;
        return true; // Continue to corrective turn
      }
    }

    // No tool calls or no toolkit - we're done
    state.responseBuilder.setContent(
      this.applyFormatArrayDefaults(parsed.content, options),
    );
    state.responseBuilder.complete();

    // Add final history items
    const historyItems = this.adapter.responseToHistoryItems(parsed.raw);
    for (const item of historyItems) {
      state.responseBuilder.appendToHistory(item);
    }

    return false; // Stop loop
  }

  /**
   * Draconian summary of a history item for trace logging: string message
   * content is kept; everything else is reduced to its type.
   */
  private summarizeHistoryItem(item?: LlmHistoryItem): unknown {
    if (!item) {
      return undefined;
    }
    const record = item as unknown as Record<string, unknown>;
    if (typeof record.content === "string") {
      return { content: record.content, role: record.role };
    }
    return { type: record.type ?? "message" };
  }

  /**
   * Reconcile structured output against the declared `format` contract. A
   * declared `format` is a schema contract: returned keys should match the
   * declared names exactly and every declared array field should be present.
   * First repairs keys a provider/model corrupted by wrapping them in literal
   * double quotes (observed on OpenAI for multi-word keys), then backfills any
   * declared array field a provider/model omitted, surfacing it as `[]`.
   */
  private applyFormatArrayDefaults(
    content: string | JsonObject | undefined,
    options: LlmOperateOptions,
  ): string | JsonObject | undefined {
    if (!options.format) {
      return content;
    }
    if (typeof content !== "object" || content === null) {
      return content;
    }
    const repaired = repairFormatKeys({ content, format: options.format });
    return fillFormatArrays({ content: repaired, format: options.format });
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
    } else if (Array.isArray(request.contents)) {
      // Gemini format - convert contents to history items
      state.currentInput = this.convertGeminiContentsToHistory(
        request.contents as Array<{
          role: string;
          parts?: Array<Record<string, unknown>>;
        }>,
      );
    }
  }

  /**
   * Convert Gemini contents format to internal history format.
   */
  private convertGeminiContentsToHistory(
    contents: Array<{ role: string; parts?: Array<Record<string, unknown>> }>,
  ): LlmHistory {
    const history: LlmHistory = [];

    for (const content of contents) {
      if (!content.parts) continue;

      for (const part of content.parts) {
        if (part.text && typeof part.text === "string") {
          // Regular text message
          history.push({
            role:
              content.role === "model"
                ? LlmMessageRole.Assistant
                : LlmMessageRole.User,
            content: part.text,
            type: LlmMessageType.Message,
          } as LlmOutputMessage);
        } else if (part.functionCall) {
          // Function call
          const fc = part.functionCall as {
            name?: string;
            args?: Record<string, unknown>;
            id?: string;
          };
          // Preserve thoughtSignature for Gemini 3 models (required for tool calls)
          const thoughtSignature = (part as { thoughtSignature?: string })
            .thoughtSignature;
          history.push({
            type: LlmMessageType.FunctionCall,
            name: fc.name || "",
            arguments: JSON.stringify(fc.args || {}),
            call_id: fc.id || "",
            id: fc.id || "",
            ...(thoughtSignature && { thoughtSignature }),
          } as unknown as LlmToolCall);
        } else if (part.functionResponse) {
          // Function response
          const fr = part.functionResponse as {
            name?: string;
            response?: Record<string, unknown>;
          };
          // Store name in the object even though it's not part of LlmToolResult type
          // This allows round-trip conversion back to Gemini format
          history.push({
            type: LlmMessageType.FunctionCallOutput,
            output: JSON.stringify(fr.response || {}),
            call_id: "",
            name: fr.name || "",
          } as LlmToolResult & { name: string });
        }
      }
    }

    return history;
  }

  /**
   * Append response items to the provider request.
   * This adds all output items from a response (including reasoning, function_calls, etc.)
   * to the request's input/messages array.
   *
   * This is critical for OpenAI which requires reasoning items to be present
   * when function_call items reference them.
   */
  private appendResponseItemsToRequest(
    request: unknown,
    responseItems: LlmHistory,
  ): void {
    const requestObj = request as Record<string, unknown>;

    if (Array.isArray(requestObj.input)) {
      // OpenAI format
      requestObj.input.push(...responseItems);
    } else if (Array.isArray(requestObj.messages)) {
      // Anthropic format
      requestObj.messages.push(...responseItems);
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
