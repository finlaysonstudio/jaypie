import {
  BadGatewayError,
  BadRequestError,
  TooManyRequestsError,
} from "@jaypie/errors";
import { sleep } from "@jaypie/kit";
import { JsonObject } from "@jaypie/types";

import { MAX_CONSECUTIVE_TOOL_ERRORS } from "./OperateLoop.js";
import { toLlmError } from "../errors/toLlmError.js";
import { createStaleRejectionGuard } from "./retry/createStaleRejectionGuard.js";
import { Toolkit } from "../tools/Toolkit.class.js";
import {
  LlmError,
  LlmExchangePending,
  LlmHistory,
  LlmInputMessage,
  LlmMessageRole,
  LlmMessageType,
  LlmOperateInput,
  LlmOperateOptions,
  LlmOperateResponse,
  LlmOutputMessage,
  LlmResponseStatus,
  LlmResumeOption,
  LlmToolCall,
  LlmToolResult,
  LlmUsageItem,
} from "../types/LlmProvider.interface.js";
import {
  LlmStreamChunk,
  LlmStreamChunkType,
} from "../types/LlmStreamChunk.interface.js";
import {
  annotateLlmObs,
  openLlmObsSpan,
  usageToLlmObsMetrics,
  withLlmObsSpan,
} from "../observability/llmobs.js";
import { combineAbortSignals } from "../util/abortSignal.js";
import { toAbortError } from "../errors/toAbortError.js";
import { getLogger, maxTurnsFromOptions, tallyOperate } from "../util/index.js";
import { persistExchange } from "../observability/exchangeStore.js";
import {
  buildExchangeEnvelope,
  emitExchange,
  isExchangeRequested,
} from "./exchange/index.js";
import { ProviderAdapter } from "./adapters/ProviderAdapter.interface.js";
import { HookRunner, hookRunner } from "./hooks/index.js";
import { InputProcessor, inputProcessor } from "./input/index.js";
import { resolveResume } from "./resume/index.js";
import { defaultRetryPolicy, RetryPolicy } from "./retry/index.js";
import {
  OperateContext,
  OperateRequest,
  PendingToolCall,
  ProviderToolDefinition,
  StandardToolCall,
} from "./types.js";

//
//
// Types
//

export interface StreamLoopConfig {
  adapter: ProviderAdapter;
  client: unknown;
  hookRunner?: HookRunner;
  inputProcessor?: InputProcessor;
  retryPolicy?: RetryPolicy;
}

interface StreamLoopState {
  consecutiveToolErrors: number;
  currentInput: LlmHistory;
  currentTurn: number;
  /**
   * Turns this stream added, in order, for the exchange envelope. Kept apart
   * from `currentInput` because the streamed assistant text is recorded here
   * but never resent to the provider.
   */
  deltaHistory: LlmHistory;
  /** Populated when the stream terminates on an error */
  error?: LlmError;
  /** Text of the most recent streamed turn — the final answer */
  finalText: string;
  formattedFormat?: JsonObject;
  formattedTools?: ProviderToolDefinition[];
  /** Usage entries seeded from a resumed envelope (excluded from the tally) */
  initialUsageCount?: number;
  maxTurns: number;
  /** External tool calls the stream parked on this segment */
  pending?: PendingToolCall[];
  /** Turn count seeded from a resumed envelope (excluded from the tally) */
  resumedFromTurn?: number;
  /** Model-request retries across all turns (exchange envelope) */
  retries: number;
  status: LlmResponseStatus;
  toolCallNames: string[];
  toolkit?: Toolkit;
  usageItems: LlmUsageItem[];
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
// Main
//

/**
 * StreamLoop implements streaming multi-turn conversation loop.
 * It orchestrates provider adapters and tool calling while yielding
 * stream chunks as they become available.
 */
export class StreamLoop {
  private readonly adapter: ProviderAdapter;
  private readonly client: unknown;
  private readonly hookRunnerInstance: HookRunner;
  private readonly inputProcessorInstance: InputProcessor;
  private readonly retryPolicy: RetryPolicy;

  constructor(config: StreamLoopConfig) {
    this.adapter = config.adapter;
    this.client = config.client;
    this.hookRunnerInstance = config.hookRunner ?? hookRunner;
    this.inputProcessorInstance = config.inputProcessor ?? inputProcessor;
    this.retryPolicy = config.retryPolicy ?? defaultRetryPolicy;
  }

  /**
   * Execute the streaming loop for multi-turn conversations with tool calling.
   * Yields stream chunks as they become available.
   */
  async *execute(
    input?: string | LlmHistory | LlmInputMessage | LlmOperateInput,
    options: LlmOperateOptions = {},
  ): AsyncIterable<LlmStreamChunk> {
    const log = getLogger();
    // Verify adapter supports streaming
    if (!this.adapter.executeStreamRequest) {
      throw new BadGatewayError(
        `Provider ${this.adapter.name} does not support streaming`,
      );
    }

    const resume = options.resume;
    if (resume) {
      const inputEmpty =
        input === undefined ||
        input === null ||
        input === "" ||
        (Array.isArray(input) && input.length === 0);
      if (!inputEmpty) {
        throw new BadRequestError(
          "Cannot resume with input; the conversation travels inside the envelope",
        );
      }
    } else if (input === undefined || input === null) {
      throw new BadRequestError(
        "Input is required unless resuming a parked exchange",
      );
    }

    // A parked wait is not counted: the resumed segment keeps the original
    // startedAt and accumulates only active loop time onto duration.
    const startedAt =
      resume?.exchange.timing.startedAt ?? new Date().toISOString();
    const previousDuration = resume?.exchange.timing.duration ?? 0;
    const startMs = Date.now();

    // Initialize state
    const state = resume
      ? this.resumeState(resume, options)
      : await this.initializeState(input!, options);
    const context = this.createContext(options);
    const exchangeRequested = isExchangeRequested(options);
    const envelopeInput = resume ? resume.exchange.request.input : input!;

    // Settlement runs from `finally` so an abandoned generator — which closes
    // through the same path — still records the turn it consumed.
    try {
      // A resumed exchange settles without a model call when the supplied
      // results already exhaust a budget the in-loop paths enforce.
      if (
        resume &&
        state.consecutiveToolErrors >= MAX_CONSECUTIVE_TOOL_ERRORS
      ) {
        const detail = `Stopped after ${MAX_CONSECUTIVE_TOOL_ERRORS} consecutive tool errors`;
        log.warn(detail);
        state.error = {
          detail,
          status: 502,
          title: ERROR.BAD_FUNCTION_CALL,
        };
        yield { type: LlmStreamChunkType.Error, error: state.error };
      } else if (resume && state.currentTurn >= state.maxTurns) {
        const error = new TooManyRequestsError();
        const detail = `Model requested function call but exceeded ${state.maxTurns} turns`;
        log.warn(detail);
        state.error = {
          detail,
          status: error.status,
          title: error.title,
        };
        yield { type: LlmStreamChunkType.Error, error: state.error };
      } else {
        // Build initial request
        let request = this.buildInitialRequest(state, options);

        // Multi-turn loop
        while (state.currentTurn < state.maxTurns) {
          state.currentTurn++;

          // Execute one streaming turn
          const { shouldContinue, toolCalls } =
            yield* this.executeOneStreamingTurn(
              request,
              state,
              context,
              options,
            );

          if (!shouldContinue) {
            break;
          }

          // If we have tool calls, process them
          if (toolCalls && toolCalls.length > 0 && state.toolkit) {
            yield* this.processToolCalls(toolCalls, state, context);

            // Park: one or more external tool calls are outstanding. Status
            // stays in_progress and the max-turns check is deliberately
            // skipped — the caller may raise `turns` on resume.
            if (state.pending && state.pending.length > 0) {
              break;
            }

            // Check if we've reached max turns
            if (state.currentTurn >= state.maxTurns) {
              const error = new TooManyRequestsError();
              const detail = `Model requested function call but exceeded ${state.maxTurns} turns`;
              log.warn(detail);
              state.error = {
                detail,
                status: error.status,
                title: error.title,
              };
              yield {
                type: LlmStreamChunkType.Error,
                error: state.error,
              };
              break;
            }

            // Rebuild request with updated history for next turn
            request = {
              effort: options.effort,
              format: state.formattedFormat,
              instructions: options.instructions,
              messages: state.currentInput,
              model: options.model ?? this.adapter.defaultModel,
              providerOptions: options.providerOptions,
              stream: true,
              system: options.system,
              temperature: options.temperature,
              tools: state.formattedTools,
              user: options.user,
            };
          } else {
            break;
          }
        }
      }

      // A park stays in_progress; anything else settles
      state.status =
        state.pending && state.pending.length > 0
          ? LlmResponseStatus.InProgress
          : state.error
            ? LlmResponseStatus.Incomplete
            : LlmResponseStatus.Completed;

      // Emit final done chunk with accumulated usage. Tally only this
      // invocation's segment; a resume seeds usage and turns from the parked
      // envelope and must not double-count them.
      tallyOperate({
        toolCallNames: state.toolCallNames,
        turns: state.currentTurn - (state.resumedFromTurn ?? 0),
        usage: state.usageItems.slice(state.initialUsageCount ?? 0),
      });
      yield {
        type: LlmStreamChunkType.Done,
        usage: state.usageItems,
      };
    } catch (error) {
      state.status = LlmResponseStatus.Incomplete;
      if (!state.error) {
        const thrown = error as {
          detail?: string;
          message?: string;
          status?: number | string;
          title?: string;
          name?: string;
        };
        state.error = {
          detail: thrown.detail ?? thrown.message,
          status: thrown.status ?? 500,
          title: thrown.title ?? thrown.name ?? "Error",
        };
      }
      throw error;
    } finally {
      // A generator abandoned mid-stream never reaches the completed branch.
      // A park is deliberately in_progress and is not coerced.
      if (
        state.status === LlmResponseStatus.InProgress &&
        !(state.pending && state.pending.length > 0)
      ) {
        state.status = LlmResponseStatus.Incomplete;
      }
      await this.settleExchange({
        duration: previousDuration + Date.now() - startMs,
        exchangeRequested,
        input: envelopeInput,
        options,
        state,
        startedAt,
      });
    }
  }

  //
  // Private Methods
  //

  private async initializeState(
    input: string | LlmHistory | LlmInputMessage | LlmOperateInput,
    options: LlmOperateOptions,
  ): Promise<StreamLoopState> {
    // Process input with placeholders
    const processedInput = await this.inputProcessorInstance.process(
      input,
      options,
    );

    // Determine max turns
    const maxTurns = maxTurnsFromOptions(options);

    const { formattedFormat, formattedTools, toolkit } =
      this.buildTooling(options);

    return {
      consecutiveToolErrors: 0,
      currentInput: processedInput.history,
      currentTurn: 0,
      deltaHistory: [],
      finalText: "",
      formattedFormat,
      formattedTools,
      maxTurns,
      retries: 0,
      status: LlmResponseStatus.InProgress,
      toolCallNames: [],
      toolkit,
      usageItems: [],
    };
  }

  /**
   * Resolve the toolkit and format/tool projections from options. Shared by
   * fresh initialization and resume — tools are code, so the caller supplies
   * them on every segment.
   */
  private buildTooling(options: LlmOperateOptions): {
    formattedFormat?: JsonObject;
    formattedTools?: ProviderToolDefinition[];
    toolkit?: Toolkit;
  } {
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

    return { formattedFormat, formattedTools, toolkit };
  }

  /**
   * Rebuild loop state from a parked exchange envelope plus the outstanding
   * tool results. The pending history is provider-neutral — the same shape
   * this loop already resends every turn — so buildRequest reconstitutes the
   * provider request from it directly.
   */
  private resumeState(
    resume: LlmResumeOption,
    options: LlmOperateOptions,
  ): StreamLoopState {
    const { consecutiveToolErrors, history, pending, resultItems } =
      resolveResume({
        adapterName: this.adapter.name,
        model: options.model,
        resume,
      });
    const { exchange } = resume;

    const { formattedFormat, formattedTools, toolkit } =
      this.buildTooling(options);

    return {
      consecutiveToolErrors,
      currentInput: history,
      currentTurn: pending.turn ?? 0,
      // The parked segment's delta plus the supplied results, so this
      // settlement's historyDelta spans the whole exchange
      deltaHistory: [...(exchange.response.historyDelta ?? []), ...resultItems],
      finalText: "",
      formattedFormat,
      formattedTools,
      initialUsageCount: exchange.response.usage?.length ?? 0,
      maxTurns: maxTurnsFromOptions(options),
      resumedFromTurn: pending.turn ?? 0,
      retries: exchange.resolution?.retries ?? 0,
      status: LlmResponseStatus.InProgress,
      toolCallNames: [],
      toolkit,
      usageItems: [...(exchange.response.usage ?? [])],
    };
  }

  /**
   * Assemble and deliver the exchange envelope for one stream() settlement:
   * normal termination, error, or a consumer that stopped reading. `stream()`
   * has no fallback chain, so the loop stamps `resolution` itself rather than
   * leaving it to the facade.
   */
  private async settleExchange({
    duration,
    exchangeRequested,
    input,
    options,
    startedAt,
    state,
  }: {
    duration: number;
    exchangeRequested: boolean;
    input: string | LlmHistory | LlmInputMessage | LlmOperateInput;
    options: LlmOperateOptions;
    startedAt: string;
    state: StreamLoopState;
  }): Promise<void> {
    // Park: the envelope is the resume payload, so it is built and delivered
    // unconditionally when external tool calls are outstanding. The pending
    // history is the full re-entrant input; the delta stays the report of
    // what this exchange added.
    const pendingBlock: LlmExchangePending | undefined =
      state.pending && state.pending.length > 0
        ? {
            calls: state.pending.map(
              ({ arguments: args, callId, message, name, raw }) => ({
                arguments: args,
                ...(message !== undefined ? { message } : {}),
                name,
                ...(raw !== undefined ? { raw } : {}),
                xid: callId,
              }),
            ),
            consecutiveToolErrors: state.consecutiveToolErrors,
            history: [...state.currentInput],
            initialHistoryLength: 0,
            turn: state.currentTurn,
          }
        : undefined;
    if (!exchangeRequested && !pendingBlock) {
      return;
    }
    const response: LlmOperateResponse = {
      content: state.finalText || undefined,
      error: state.error,
      // The delta is the whole history the envelope reports, so nothing is
      // sliced off the front
      history: state.deltaHistory,
      model: options.model ?? this.adapter.defaultModel,
      output: [],
      provider: this.adapter.name,
      reasoning: [],
      responses: [],
      status: state.status,
      usage: state.usageItems,
    };
    const envelope = buildExchangeEnvelope({
      duration,
      initialHistoryLength: 0,
      input,
      options,
      pending: pendingBlock,
      response,
      startedAt,
      state,
    });
    envelope.resolution = {
      ...envelope.resolution,
      fallbackAttempts: 1,
      fallbackUsed: false,
    };
    await emitExchange({ envelope, onExchange: options.onExchange });
    await persistExchange(envelope);
  }

  /**
   * Serializable error body for a caller-initiated abort. `stream()` reports a
   * cancellation as an error chunk rather than a rejection, so the consumer
   * still receives the terminating `done` chunk.
   */
  private abortErrorBody(
    options: LlmOperateOptions,
    cause?: unknown,
  ): LlmError {
    const error = toAbortError({
      cause,
      model: options.model ?? this.adapter.defaultModel,
      provider: this.adapter.name,
      signal: options.signal,
    });
    return {
      detail: error.message,
      status: error.status,
      title: error.title,
    };
  }

  /**
   * Record a turn's streamed text for the exchange envelope. The text is kept
   * out of `currentInput` so the history resent to the provider is unchanged.
   */
  private recordStreamedText(state: StreamLoopState, text: string): void {
    if (!text) {
      return;
    }
    state.finalText = text;
    state.deltaHistory.push({
      content: text,
      role: LlmMessageRole.Assistant,
      type: LlmMessageType.Message,
    } as LlmOutputMessage);
  }

  private createContext(options: LlmOperateOptions): OperateContext {
    return {
      hooks: options.hooks ?? {},
      options,
    };
  }

  private buildInitialRequest(
    state: StreamLoopState,
    options: LlmOperateOptions,
  ): OperateRequest {
    return {
      cache: options.cache,
      effort: options.effort,
      format: state.formattedFormat,
      instructions: options.instructions,
      messages: state.currentInput,
      model: options.model ?? this.adapter.defaultModel,
      providerOptions: options.providerOptions,
      stream: true,
      system: options.system,
      temperature: options.temperature,
      tools: state.formattedTools,
      user: options.user,
    };
  }

  private async *executeOneStreamingTurn(
    request: OperateRequest,
    state: StreamLoopState,
    context: OperateContext,
    options: LlmOperateOptions,
  ): AsyncGenerator<
    LlmStreamChunk,
    { shouldContinue: boolean; toolCalls?: StandardToolCall[] }
  > {
    const log = getLogger();
    // Build provider-specific request
    const providerRequest = this.adapter.buildRequest(request);

    // Execute beforeEachModelRequest hook
    await this.hookRunnerInstance.runBeforeModelRequest(context.hooks, {
      input: state.currentInput,
      options,
      providerRequest,
    });

    // Open a manual llm span held open across the streamed turn. Flat (not
    // nested) because it spans yield boundaries; no-op when llmobs disabled.
    const llmSpan = openLlmObsSpan({
      kind: "llm",
      modelName: options.model ?? this.adapter.defaultModel,
      modelProvider: this.adapter.name,
      name: "jaypie.llm.model",
    });
    const inputSnapshot = [...state.currentInput];
    let streamedText = "";

    // Collect tool calls from the stream
    const collectedToolCalls: StandardToolCall[] = [];

    // Retry loop for connection-level failures
    let attempt = 0;
    let chunksYielded = false;

    // Guard against stale rejections firing after the stream loop has already
    // caught the originating error: undici socket teardown and twin
    // upstream-SDK rejections (issue #336).
    const guard = createStaleRejectionGuard();

    // Held outside the retry loop so teardown — an abandoned generator closing
    // through `finally` — can abort whatever request is in flight
    let activeController: AbortController | undefined;

    try {
      while (true) {
        // Aborted before the request went out — including before the first
        // attempt — reads the same to the consumer as aborting mid-stream
        if (options.signal?.aborted) {
          log.debug("Stream aborted by caller");
          this.recordStreamedText(state, streamedText);
          state.error = this.abortErrorBody(options);
          yield {
            type: LlmStreamChunkType.Error,
            error: state.error,
          };
          llmSpan?.annotate({
            inputData: inputSnapshot,
            metrics: usageToLlmObsMetrics(state.usageItems),
            outputData: streamedText,
          });
          llmSpan?.finish();
          return { shouldContinue: false };
        }

        const controller = new AbortController();
        activeController = controller;

        try {
          // Execute streaming request
          const streamGenerator = this.adapter.executeStreamRequest!(
            this.client,
            providerRequest,
            combineAbortSignals({ controller, signal: options.signal }),
          );

          for await (const chunk of streamGenerator) {
            // Pass through text chunks
            if (chunk.type === LlmStreamChunkType.Text) {
              chunksYielded = true;
              streamedText += chunk.content ?? "";
              yield chunk;
            }

            // Collect tool calls
            if (chunk.type === LlmStreamChunkType.ToolCall) {
              chunksYielded = true;
              collectedToolCalls.push({
                callId: chunk.toolCall.id,
                name: chunk.toolCall.name,
                arguments: chunk.toolCall.arguments,
                raw: chunk.toolCall,
              });
              yield chunk;
            }

            // Track usage from done chunk (but don't yield it yet - we'll emit our own)
            if (chunk.type === LlmStreamChunkType.Done && chunk.usage) {
              state.usageItems.push(...chunk.usage);
            }

            // Pass through error chunks
            if (chunk.type === LlmStreamChunkType.Error) {
              chunksYielded = true;
              yield chunk;
            }
          }

          // Stream completed successfully
          if (attempt > 0) {
            log.debug(`Stream request succeeded after ${attempt} retries`);
          }
          break;
        } catch (error: unknown) {
          controller.abort("retry");

          guard.recordCaught(error);
          guard.install();

          // The caller cancelled: report the abort rather than the provider
          // error it manifested as, and never retry it
          if (options.signal?.aborted) {
            log.debug("Stream aborted by caller");
            this.recordStreamedText(state, streamedText);
            state.error = this.abortErrorBody(options, error);
            yield {
              type: LlmStreamChunkType.Error,
              error: state.error,
            };
            llmSpan?.annotate({
              inputData: inputSnapshot,
              metrics: usageToLlmObsMetrics(state.usageItems),
              outputData: streamedText,
            });
            llmSpan?.finish();
            return { shouldContinue: false };
          }

          // If chunks were already yielded, we can't transparently retry
          if (chunksYielded) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            log.error("Stream failed after partial data was delivered");
            log.var({ error });
            this.recordStreamedText(state, streamedText);
            state.error = {
              detail: errorMessage,
              status: 502,
              title: "Stream Error",
            };
            yield {
              type: LlmStreamChunkType.Error,
              error: state.error,
            };
            llmSpan?.annotate({
              inputData: inputSnapshot,
              metrics: usageToLlmObsMetrics(state.usageItems),
              outputData: streamedText,
            });
            llmSpan?.finish();
            return { shouldContinue: false };
          }

          // Check if we've exhausted retries or error is not retryable
          if (
            !this.retryPolicy.shouldRetry(attempt) ||
            !this.adapter.isRetryableError(error)
          ) {
            log.error(
              `Stream request failed after ${this.retryPolicy.maxRetries} retries`,
            );
            log.var({ error });
            llmSpan?.finish();
            throw toLlmError(this.adapter.classifyError(error), {
              model: options.model ?? this.adapter.defaultModel,
              provider: this.adapter.name,
            });
          }

          const delay = this.retryPolicy.getDelayForAttempt(attempt);
          log.warn(`Stream request failed. Retrying in ${delay}ms...`);
          log.var({ error });

          await sleep(delay);
          attempt++;
          state.retries++;
        }
      }
    } finally {
      guard.remove();
      // Abandoning the generator closes it through here: stop the upstream
      // request instead of leaving it to run to completion
      activeController?.abort("teardown");
    }

    // Annotate and finish the streamed llm span (no-op when disabled)
    llmSpan?.annotate({
      inputData: inputSnapshot,
      metrics: usageToLlmObsMetrics(state.usageItems),
      outputData: streamedText,
    });
    llmSpan?.finish();

    this.recordStreamedText(state, streamedText);

    // Execute afterEachModelResponse hook
    await this.hookRunnerInstance.runAfterModelResponse(context.hooks, {
      content: "",
      input: state.currentInput,
      options,
      providerRequest,
      providerResponse: null,
      usage: state.usageItems,
    });

    // If we have tool calls and a toolkit, continue the loop
    if (collectedToolCalls.length > 0 && state.toolkit && state.maxTurns > 1) {
      // Add tool calls to history
      for (const toolCall of collectedToolCalls) {
        // Extract provider-specific metadata from the stream chunk
        const metadata = (toolCall.raw as Record<string, unknown>)?.metadata as
          Record<string, unknown> | undefined;

        const historyItem: Record<string, unknown> = {
          type: LlmMessageType.FunctionCall,
          name: toolCall.name,
          arguments: toolCall.arguments,
          call_id: toolCall.callId,
          // Use provider item ID if available (e.g., OpenAI fc_... prefix),
          // otherwise fall back to callId
          id: (metadata?.itemId as string) || toolCall.callId,
        };

        // Preserve provider-specific fields (e.g., Gemini thoughtSignature)
        if (metadata?.thoughtSignature) {
          historyItem.thoughtSignature = metadata.thoughtSignature;
        }

        state.currentInput.push(historyItem as unknown as LlmToolCall);
        state.deltaHistory.push(historyItem as unknown as LlmToolCall);
      }

      return { shouldContinue: true, toolCalls: collectedToolCalls };
    }

    return { shouldContinue: false };
  }

  private async *processToolCalls(
    toolCalls: StandardToolCall[],
    state: StreamLoopState,
    context: OperateContext,
  ): AsyncGenerator<LlmStreamChunk, void> {
    const log = getLogger();
    for (const toolCall of toolCalls) {
      // Resolved once per call; never throws (undefined when tool has no message)
      const toolMessage = await state.toolkit!.resolveMessage({
        arguments: toolCall.arguments,
        name: toolCall.name,
      });

      // External tool calls are not executed here: they collect for a park
      // and the stream suspends after this turn's internal calls finish.
      if (state.toolkit!.isExternal(toolCall.name)) {
        yield {
          type: LlmStreamChunkType.ToolPending,
          toolPending: {
            arguments: toolCall.arguments,
            ...(toolMessage !== undefined ? { message: toolMessage } : {}),
            name: toolCall.name,
            xid: toolCall.callId,
          },
        };
        (state.pending ??= []).push({ ...toolCall, message: toolMessage });
        continue;
      }

      state.toolCallNames.push(toolCall.name);
      try {
        // Execute beforeEachTool hook
        await this.hookRunnerInstance.runBeforeTool(context.hooks, {
          args: toolCall.arguments,
          message: toolMessage,
          toolName: toolCall.name,
        });

        // Call the tool inside a child tool span (no-op when disabled)
        log.trace(`[stream] Calling tool - ${toolCall.name}`);
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

        // Execute afterEachTool hook
        await this.hookRunnerInstance.runAfterTool(context.hooks, {
          args: toolCall.arguments,
          message: toolMessage,
          result,
          toolName: toolCall.name,
        });

        // Reset consecutive error counter on success
        state.consecutiveToolErrors = 0;

        // Yield tool result chunk
        yield {
          type: LlmStreamChunkType.ToolResult,
          toolResult: {
            id: toolCall.callId,
            name: toolCall.name,
            result,
          },
        };

        // Add tool result to history
        const resultItem = {
          type: LlmMessageType.FunctionCallOutput,
          output: JSON.stringify(result),
          call_id: toolCall.callId,
          name: toolCall.name,
        } as LlmToolResult & { name: string };
        state.currentInput.push(resultItem);
        state.deltaHistory.push(resultItem);
      } catch (error) {
        // Execute onToolError hook
        await this.hookRunnerInstance.runOnToolError(context.hooks, {
          args: toolCall.arguments,
          error: error as Error,
          message: toolMessage,
          toolName: toolCall.name,
        });

        // Yield error chunk
        const jaypieError = new BadGatewayError();
        const detail = [
          `Error executing function call ${toolCall.name}.`,
          (error as Error).message,
        ].join("\n");

        yield {
          type: LlmStreamChunkType.Error,
          error: {
            detail,
            status: jaypieError.status,
            title: ERROR.BAD_FUNCTION_CALL,
          },
        };

        // Add error tool_result to history so the tool_use block is not orphaned.
        // Without this, the next turn's request would have a tool_use without a
        // matching tool_result, causing Anthropic API to reject with 400.
        const errorOutput = JSON.stringify({
          error: (error as Error).message || "Tool execution failed",
        });
        const errorItem = {
          type: LlmMessageType.FunctionCallOutput,
          output: errorOutput,
          call_id: toolCall.callId,
          name: toolCall.name,
        } as LlmToolResult & { name: string };
        state.currentInput.push(errorItem);
        state.deltaHistory.push(errorItem);

        log.warn(`Error executing function call ${toolCall.name}`);
        log.var({ error });

        // Track consecutive errors and stop if threshold reached
        state.consecutiveToolErrors++;
        if (state.consecutiveToolErrors >= MAX_CONSECUTIVE_TOOL_ERRORS) {
          const stopDetail = `Stopped after ${MAX_CONSECUTIVE_TOOL_ERRORS} consecutive tool errors`;
          log.warn(stopDetail);
          yield {
            type: LlmStreamChunkType.Error,
            error: {
              detail: stopDetail,
              status: 502,
              title: ERROR.BAD_FUNCTION_CALL,
            },
          };
          return; // Stop processing tools
        }
      }
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
          history.push({
            role:
              content.role === "model"
                ? LlmMessageRole.Assistant
                : LlmMessageRole.User,
            content: part.text,
            type: LlmMessageType.Message,
          } as LlmOutputMessage);
        } else if (part.functionCall) {
          const fc = part.functionCall as {
            name?: string;
            args?: Record<string, unknown>;
            id?: string;
          };
          history.push({
            type: LlmMessageType.FunctionCall,
            name: fc.name || "",
            arguments: JSON.stringify(fc.args || {}),
            call_id: fc.id || "",
            id: fc.id || "",
          } as unknown as LlmToolCall);
        } else if (part.functionResponse) {
          const fr = part.functionResponse as {
            name?: string;
            response?: Record<string, unknown>;
          };
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
}

//
//
// Factory
//

/**
 * Create a StreamLoop instance with the specified configuration.
 */
export function createStreamLoop(config: StreamLoopConfig): StreamLoop {
  return new StreamLoop(config);
}
