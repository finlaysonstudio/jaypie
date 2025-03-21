/* eslint-disable @typescript-eslint/no-explicit-any */
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
 * Union type for all possible response items
 */
export type OpenAIResponseItem =
  | OpenAIFunctionCall
  | OpenAIMessage
  | OpenAIFunctionCallOutput;

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
  [key: string]: unknown;
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
  [key: string]: unknown;
}

/**
 * Represents the complete response from the OpenAI API,
 * which is an array of turns
 */
export type OpenAIResponse = Array<OpenAIResponseTurn>;
