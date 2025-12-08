import { placeholders } from "@jaypie/kit";
import {
  LlmInputMessage,
  LlmMessageRole,
  LlmMessageType,
} from "../types/LlmProvider.interface.js";
import { NaturalMap } from "@jaypie/types";

/**
 * Options for formatOperateMessage function
 */
export interface FormatOperateMessageOptions {
  /**
   * Data to use for placeholder substitution
   */
  data?: NaturalMap;

  /**
   * Role to use for the message
   */
  role?: LlmMessageRole;
}

/**
 * Converts a string to a standardized LlmInputMessage
 * @param input - String to format
 * @param options - Optional configuration
 * @param options.data - Data to use for placeholder substitution
 * @param options.role - Role to use for the message (defaults to User)
 * @returns LlmInputMessage
 */
export function formatOperateMessage(
  input: string,
  options?: FormatOperateMessageOptions,
): LlmInputMessage {
  const content = options?.data ? placeholders(input, options.data) : input;

  return {
    content,
    role: options?.role || LlmMessageRole.User,
    type: LlmMessageType.Message,
  };
}
