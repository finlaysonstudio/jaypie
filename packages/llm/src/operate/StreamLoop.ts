import { BadGatewayError, TooManyRequestsError } from "@jaypie/errors";
import { JsonObject } from "@jaypie/types";

import { Toolkit } from "../tools/Toolkit.class.js";
import {
  LlmHistory,
  LlmInputMessage,
  LlmMessageRole,
  LlmMessageType,
  LlmOperateInput,
  LlmOperateOptions,
  LlmOutputMessage,
  LlmToolCall,
  LlmToolResult,
  LlmUsageItem,
} from "../types/LlmProvider.interface.js";
import {
  LlmStreamChunk,
  LlmStreamChunkType,
} from "../types/LlmStreamChunk.interface.js";
import { log, maxTurnsFromOptions } from "../util/index.js";
import { ProviderAdapter } from "./adapters/ProviderAdapter.interface.js";
import { HookRunner, hookRunner } from "./hooks/index.js";
import { InputProcessor, inputProcessor } from "./input/index.js";
import {
  OperateContext,
  OperateRequest,
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
}

interface StreamLoopState {
  currentInput: LlmHistory;
  currentTurn: number;
  formattedFormat?: JsonObject;
  formattedTools?: ProviderToolDefinition[];
  maxTurns: number;
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

  constructor(config: StreamLoopConfig) {
    this.adapter = config.adapter;
    this.client = config.client;
    this.hookRunnerInstance = config.hookRunner ?? hookRunner;
    this.inputProcessorInstance = config.inputProcessor ?? inputProcessor;
  }

  /**
   * Execute the streaming loop for multi-turn conversations with tool calling.
   * Yields stream chunks as they become available.
   */
  async *execute(
    input: string | LlmHistory | LlmInputMessage | LlmOperateInput,
    options: LlmOperateOptions = {},
  ): AsyncIterable<LlmStreamChunk> {
    // Verify adapter supports streaming
    if (!this.adapter.executeStreamRequest) {
      throw new BadGatewayError(
        `Provider ${this.adapter.name} does not support streaming`,
      );
    }

    // Initialize state
    const state = await this.initializeState(input, options);
    const context = this.createContext(options);

    // Build initial request
    let request = this.buildInitialRequest(state, options);

    // Multi-turn loop
    while (state.currentTurn < state.maxTurns) {
      state.currentTurn++;

      // Execute one streaming turn
      const { shouldContinue, toolCalls } = yield* this.executeOneStreamingTurn(
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
        yield* this.processToolCalls(toolCalls, state, context, options);

        // Check if we've reached max turns
        if (state.currentTurn >= state.maxTurns) {
          const error = new TooManyRequestsError();
          const detail = `Model requested function call but exceeded ${state.maxTurns} turns`;
          log.warn(detail);
          yield {
            type: LlmStreamChunkType.Error,
            error: {
              detail,
              status: error.status,
              title: error.title,
            },
          };
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
      } else {
        break;
      }
    }

    // Emit final done chunk with accumulated usage
    yield {
      type: LlmStreamChunkType.Done,
      usage: state.usageItems,
    };
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
      toolkit,
      usageItems: [],
    };
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

  private async *executeOneStreamingTurn(
    request: OperateRequest,
    state: StreamLoopState,
    context: OperateContext,
    options: LlmOperateOptions,
  ): AsyncGenerator<
    LlmStreamChunk,
    { shouldContinue: boolean; toolCalls?: StandardToolCall[] }
  > {
    // Build provider-specific request
    const providerRequest = this.adapter.buildRequest(request);

    // Execute beforeEachModelRequest hook
    await this.hookRunnerInstance.runBeforeModelRequest(context.hooks, {
      input: state.currentInput,
      options,
      providerRequest,
    });

    // Collect tool calls from the stream
    const collectedToolCalls: StandardToolCall[] = [];

    // Execute streaming request
    const streamGenerator = this.adapter.executeStreamRequest!(
      this.client,
      providerRequest,
    );

    for await (const chunk of streamGenerator) {
      // Pass through text chunks
      if (chunk.type === LlmStreamChunkType.Text) {
        yield chunk;
      }

      // Collect tool calls
      if (chunk.type === LlmStreamChunkType.ToolCall) {
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
        yield chunk;
      }
    }

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
        state.currentInput.push({
          type: LlmMessageType.FunctionCall,
          name: toolCall.name,
          arguments: toolCall.arguments,
          call_id: toolCall.callId,
          id: toolCall.callId,
        } as unknown as LlmToolCall);
      }

      return { shouldContinue: true, toolCalls: collectedToolCalls };
    }

    return { shouldContinue: false };
  }

  private async *processToolCalls(
    toolCalls: StandardToolCall[],
    state: StreamLoopState,
    context: OperateContext,
    _options: LlmOperateOptions,
  ): AsyncGenerator<LlmStreamChunk, void> {
    for (const toolCall of toolCalls) {
      try {
        // Execute beforeEachTool hook
        await this.hookRunnerInstance.runBeforeTool(context.hooks, {
          args: toolCall.arguments,
          toolName: toolCall.name,
        });

        // Call the tool
        log.trace(`[stream] Calling tool - ${toolCall.name}`);
        const result = await state.toolkit!.call({
          arguments: toolCall.arguments,
          name: toolCall.name,
        });

        // Execute afterEachTool hook
        await this.hookRunnerInstance.runAfterTool(context.hooks, {
          args: toolCall.arguments,
          result,
          toolName: toolCall.name,
        });

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
        state.currentInput.push({
          type: LlmMessageType.FunctionCallOutput,
          output: JSON.stringify(result),
          call_id: toolCall.callId,
          name: toolCall.name,
        } as LlmToolResult & { name: string });
      } catch (error) {
        // Execute onToolError hook
        await this.hookRunnerInstance.runOnToolError(context.hooks, {
          args: toolCall.arguments,
          error: error as Error,
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

        log.error(`Error executing function call ${toolCall.name}`);
        log.var({ error });
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
