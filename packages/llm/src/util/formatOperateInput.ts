import { placeholders } from "@jaypie/core";
import {
  LlmHistory,
  LlmInputMessage,
  LlmMessageRole,
  LlmMessageType,
} from "../types/LlmProvider.interface.js";
import { NaturalMap } from "@jaypie/types";

/**
 * Options for formatOperateInput function
 */
export interface FormatOperateInputOptions {
  /**
   * Data to use for placeholder substitution
   */
  data?: NaturalMap;

  /**
   * Role to use when converting a string to LlmInputMessage
   */
  role?: LlmMessageRole;
}

/**
 * Converts various input types to a standardized LlmHistory format
 * @param input - String, LlmInputMessage, or LlmHistory to format
 * @param options - Optional configuration
 * @param options.data - Data to use for placeholder substitution
 * @param options.role - Role to use when converting a string to LlmInputMessage (defaults to User)
 * @returns Standardized LlmHistory array
 */
export function formatOperateInput(
  input: string | LlmInputMessage | LlmHistory,
  options?: FormatOperateInputOptions,
): LlmHistory {
  // If input is already LlmHistory, return it
  if (Array.isArray(input)) {
    return input;
  }

  // If input is a string, convert it to LlmInputMessage
  if (typeof input === "string") {
    const content = options?.data ? placeholders(input, options.data) : input;
    const message: LlmInputMessage = {
      content,
      role: options?.role || LlmMessageRole.User,
      type: LlmMessageType.Message,
    };
    return [message];
  }

  // If input is LlmInputMessage, apply placeholders if data is provided
  if (options?.data && typeof input.content === "string") {
    return [
      {
        ...input,
        content: placeholders(input.content, options.data),
      },
    ];
  }

  // Otherwise, just wrap the input in an array
  return [input];
}
