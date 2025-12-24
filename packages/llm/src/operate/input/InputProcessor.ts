import { placeholders } from "@jaypie/kit";

import {
  LlmHistory,
  LlmInputMessage,
  LlmMessageRole,
  LlmMessageType,
  LlmOperateOptions,
} from "../../types/LlmProvider.interface.js";
import { formatOperateInput } from "../../util/index.js";

//
//
// Types
//

export interface ProcessedInput {
  /** The processed history with all messages formatted */
  history: LlmHistory;
  /** Processed instructions with placeholders applied */
  instructions?: string;
  /** Processed system prompt with placeholders applied */
  system?: string;
}

//
//
// Main
//

/**
 * InputProcessor handles input normalization, placeholder substitution,
 * and history merging for the operate loop.
 */
export class InputProcessor {
  /**
   * Process input with placeholders, history merging, and system message handling
   *
   * @param input - The raw input (string, message, or history)
   * @param options - The operate options containing data, history, system, etc.
   * @returns Processed input with all transformations applied
   */
  process(
    input: string | LlmHistory | LlmInputMessage,
    options: LlmOperateOptions = {},
  ): ProcessedInput {
    // Convert input to history format with placeholder substitution
    let history: LlmHistory = this.formatInputWithPlaceholders(input, options);

    // Process instructions with placeholders
    const instructions = this.processInstructions(options);

    // Process system prompt with placeholders
    const system = this.processSystem(options);

    // Merge with provided history
    if (options.history) {
      history = [...options.history, ...history];
    }

    // Handle system message prepending
    if (system) {
      history = this.prependSystemMessage(history, system);
    }

    return {
      history,
      instructions,
      system,
    };
  }

  /**
   * Format input and apply placeholders if data is provided
   */
  private formatInputWithPlaceholders(
    input: string | LlmHistory | LlmInputMessage,
    options: LlmOperateOptions,
  ): LlmHistory {
    // Apply placeholders to input if data is provided and placeholders.input is not false
    if (
      options.data &&
      (options.placeholders?.input === undefined || options.placeholders?.input)
    ) {
      return formatOperateInput(input, { data: options.data });
    }

    return formatOperateInput(input);
  }

  /**
   * Process instructions with placeholder substitution
   */
  private processInstructions(options: LlmOperateOptions): string | undefined {
    if (!options.instructions) {
      return undefined;
    }

    // Apply placeholders to instructions if data is provided and placeholders.instructions is not false
    if (
      options.data &&
      (options.placeholders?.instructions === undefined ||
        options.placeholders?.instructions)
    ) {
      return placeholders(options.instructions, options.data);
    }

    return options.instructions;
  }

  /**
   * Process system prompt with placeholder substitution
   */
  private processSystem(options: LlmOperateOptions): string | undefined {
    if (!options.system) {
      return undefined;
    }

    // Apply placeholders to system if data is provided and placeholders.system is not false
    if (options.data && options.placeholders?.system !== false) {
      return placeholders(options.system, options.data);
    }

    return options.system;
  }

  /**
   * Prepend system message to history, handling duplicates
   */
  private prependSystemMessage(
    history: LlmHistory,
    systemContent: string,
  ): LlmHistory {
    // Create system message
    const systemMessage: LlmInputMessage = {
      content: systemContent,
      role: LlmMessageRole.System,
      type: LlmMessageType.Message,
    };

    // Check if history starts with an identical system message
    const firstMessage = history[0] as LlmInputMessage | undefined;
    const isIdenticalSystemMessage =
      firstMessage?.type === LlmMessageType.Message &&
      firstMessage?.role === LlmMessageRole.System &&
      firstMessage?.content === systemContent;

    // If identical, return as-is
    if (isIdenticalSystemMessage) {
      return history;
    }

    // Remove any existing system message from the beginning
    if (
      firstMessage?.type === LlmMessageType.Message &&
      firstMessage?.role === LlmMessageRole.System
    ) {
      return [systemMessage, ...history.slice(1)];
    }

    // Prepend new system message
    return [systemMessage, ...history];
  }
}

// Export singleton instance for convenience
export const inputProcessor = new InputProcessor();
