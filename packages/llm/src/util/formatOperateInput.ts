import {
  LlmHistory,
  LlmInputMessage,
  LlmMessageRole,
  LlmMessageType,
} from "../types/LlmProvider.interface.js";

/**
 * Options for formatOperateInput function
 */
export interface FormatOperateInputOptions {
  /**
   * Default role to use when converting a string to LlmInputMessage
   */
  defaultRole?: LlmMessageRole;
}

/**
 * Converts various input types to a standardized LlmHistory format
 * @param input - String, LlmInputMessage, or LlmHistory to format
 * @param options - Optional configuration
 * @param options.defaultRole - Default role to use when converting a string to LlmInputMessage (defaults to User)
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
    const message: LlmInputMessage = {
      content: input,
      role: options?.defaultRole || LlmMessageRole.User,
      type: LlmMessageType.Message,
    };
    return [message];
  }

  // If input is LlmInputMessage, wrap it in an array
  return [input];
}
