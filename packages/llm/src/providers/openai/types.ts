import { JsonValue } from "@jaypie/types";

/**
 * Type definitions for OpenAI API responses
 */

/**
 * Represents a function call in the OpenAI response
 */
export interface OpenAIFunctionCall {
  type: "function_call";
  name: string;
  arguments: string;
  call_id: string;
}

/**
 * Represents a text message in the OpenAI response
 */
export interface OpenAIContentItem {
  type: "text";
  text: string;
}

/**
 * Represents a message in the OpenAI response
 */
export interface OpenAIMessage {
  role: "assistant";
  content: OpenAIContentItem[];
}

/**
 * Represents a function call output in the OpenAI response
 */
export interface OpenAIFunctionCallOutput {
  type: "function_call_output";
  call_id: string;
  output: string;
}

/**
 * Represents a reasoning item in the OpenAI response (GPT-5)
 */
export interface OpenAIReasoningItem {
  type: "reasoning";
  id: string;
  content?: string;
}

/**
 * Union type for all possible response items
 */
export type OpenAIResponseItem =
  | OpenAIFunctionCall
  | OpenAIMessage
  | OpenAIFunctionCallOutput
  | OpenAIReasoningItem;

/**
 * Represents token usage information in the OpenAI response
 */
export interface OpenAIUsage extends Record<string, JsonValue> {
  input_tokens: number;
  input_tokens_details?: {
    cached_tokens: number;
  };
  output_tokens: number;
  output_tokens_details?: {
    reasoning_tokens: number;
  };
  total_tokens: number;
}

/**
 * Raw response from the OpenAI API
 */
export interface OpenAIRawResponse {
  id?: string;
  object?: string;
  created_at?: number;
  model?: string;
  output?: Array<OpenAIResponseItem | any>;
  output_text?: string;
  error?: any | null;
  status?: string | any;
  _request_id?: string | null;
  usage?: OpenAIUsage;
  meta?: { [key: string]: JsonValue };
  [key: string]: JsonValue;
}

/**
 * Represents a single turn in a multi-turn conversation
 */
export interface OpenAIResponseTurn {
  id?: string;
  object?: string;
  created_at?: number;
  model?: string;
  output?: Array<OpenAIResponseItem | any>;
  output_text?: string;
  error?: any | null;
  status?: string;
  _request_id?: string | null;
  [key: string]: JsonValue;
}

/**
 * Represents the complete response from the OpenAI API,
 * which is an array of turns
 */
export type OpenAIResponse = Array<OpenAIResponseTurn>;
