import { placeholders } from "@jaypie/core";
import {
  LlmHistory,
  LlmInputMessage,
  LlmMessageRole,
  LlmMessageType,
} from "../types/LlmProvider.interface.js";
import { NaturalMap } from "@jaypie/types";
import { formatOperateMessage } from "./formatOperateMessage.js";

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
    return [formatOperateMessage(input, options)];
  }

  // If input is LlmInputMessage, apply placeholders if data is provided
  if (options?.data && typeof input.content === "string") {
    return [
      formatOperateMessage(input.content, {
        data: options.data,
        role: input.role || options?.role,
      }),
    ];
  }

  // Otherwise, just wrap the input in an array
  return [input];
}
