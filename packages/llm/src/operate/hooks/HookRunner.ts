import { resolveValue } from "@jaypie/kit";
import { JsonObject } from "@jaypie/types";

import {
  LlmHistory,
  LlmInputMessage,
  LlmOperateOptions,
  LlmUsage,
} from "../../types/LlmProvider.interface.js";

//
//
// Types
//

export interface BeforeModelRequestContext {
  input: string | LlmHistory | LlmInputMessage;
  options?: LlmOperateOptions;
  providerRequest: unknown;
}

export interface AfterModelResponseContext {
  content: string | JsonObject;
  input: string | LlmHistory | LlmInputMessage;
  options?: LlmOperateOptions;
  providerRequest: unknown;
  providerResponse: unknown;
  usage: LlmUsage;
}

export interface BeforeToolContext {
  args: string;
  toolName: string;
}

export interface AfterToolContext {
  args: string;
  result: unknown;
  toolName: string;
}

export interface ToolErrorContext {
  args: string;
  error: Error;
  toolName: string;
}

export interface RetryableErrorContext {
  error: unknown;
  input: string | LlmHistory | LlmInputMessage;
  options?: LlmOperateOptions;
  providerRequest: unknown;
}

export interface UnrecoverableErrorContext {
  error: unknown;
  input: string | LlmHistory | LlmInputMessage;
  options?: LlmOperateOptions;
  providerRequest: unknown;
}

export type LlmHooks = LlmOperateOptions["hooks"];

//
//
// Main
//

/**
 * HookRunner provides a centralized, consistent way to execute lifecycle hooks
 * during the LLM operate loop. It handles async resolution and provides error
 * isolation for hook execution.
 */
export class HookRunner {
  /**
   * Execute the beforeEachModelRequest hook if defined
   */
  async runBeforeModelRequest(
    hooks: LlmHooks,
    context: BeforeModelRequestContext,
  ): Promise<void> {
    if (hooks?.beforeEachModelRequest) {
      await resolveValue(hooks.beforeEachModelRequest(context));
    }
  }

  /**
   * Execute the afterEachModelResponse hook if defined
   */
  async runAfterModelResponse(
    hooks: LlmHooks,
    context: AfterModelResponseContext,
  ): Promise<void> {
    if (hooks?.afterEachModelResponse) {
      await resolveValue(hooks.afterEachModelResponse(context));
    }
  }

  /**
   * Execute the beforeEachTool hook if defined
   */
  async runBeforeTool(
    hooks: LlmHooks,
    context: BeforeToolContext,
  ): Promise<void> {
    if (hooks?.beforeEachTool) {
      await resolveValue(hooks.beforeEachTool(context));
    }
  }

  /**
   * Execute the afterEachTool hook if defined
   */
  async runAfterTool(
    hooks: LlmHooks,
    context: AfterToolContext,
  ): Promise<void> {
    if (hooks?.afterEachTool) {
      await resolveValue(hooks.afterEachTool(context));
    }
  }

  /**
   * Execute the onToolError hook if defined
   */
  async runOnToolError(
    hooks: LlmHooks,
    context: ToolErrorContext,
  ): Promise<void> {
    if (hooks?.onToolError) {
      await resolveValue(hooks.onToolError(context));
    }
  }

  /**
   * Execute the onRetryableModelError hook if defined
   */
  async runOnRetryableError(
    hooks: LlmHooks,
    context: RetryableErrorContext,
  ): Promise<void> {
    if (hooks?.onRetryableModelError) {
      await resolveValue(hooks.onRetryableModelError(context));
    }
  }

  /**
   * Execute the onUnrecoverableModelError hook if defined
   */
  async runOnUnrecoverableError(
    hooks: LlmHooks,
    context: UnrecoverableErrorContext,
  ): Promise<void> {
    if (hooks?.onUnrecoverableModelError) {
      await resolveValue(hooks.onUnrecoverableModelError(context));
    }
  }
}

// Export singleton instance for convenience
export const hookRunner = new HookRunner();
