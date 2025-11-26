import { JsonObject } from "@jaypie/types";
import { LlmMessageRole } from "../../types/LlmProvider.interface.js";

//
//
// Role Mapping
//

export const ROLE_MAP: Record<LlmMessageRole, "user" | "model"> = {
  [LlmMessageRole.User]: "user",
  [LlmMessageRole.System]: "user", // Gemini doesn't have system role in contents
  [LlmMessageRole.Assistant]: "model",
  [LlmMessageRole.Developer]: "user",
};

//
//
// Gemini API Types
//

/**
 * A part of content - can be text, function call, or function response
 */
export interface GeminiPart {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: GeminiFunctionCall;
  functionResponse?: GeminiFunctionResponse;
  inlineData?: {
    mimeType: string;
    data: string;
  };
  fileData?: {
    mimeType?: string;
    fileUri: string;
  };
}

/**
 * A function call made by the model
 */
export interface GeminiFunctionCall {
  name?: string;
  args?: Record<string, unknown>;
  id?: string;
}

/**
 * A response to a function call
 */
export interface GeminiFunctionResponse {
  name: string;
  response: Record<string, unknown>;
}

/**
 * Content represents a message in the conversation
 */
export interface GeminiContent {
  role: "user" | "model";
  parts?: GeminiPart[];
}

/**
 * Function declaration for tools
 */
export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: JsonObject;
}

/**
 * Tool definition containing function declarations
 */
export interface GeminiTool {
  functionDeclarations?: GeminiFunctionDeclaration[];
  googleSearch?: Record<string, unknown>;
  codeExecution?: Record<string, unknown>;
}

/**
 * Configuration for a generate content request
 * This is a simplified internal type - we use the SDK's actual types at runtime
 */
export interface GeminiGenerateContentConfig {
  systemInstruction?: string;
  tools?: GeminiTool[];
  toolConfig?: {
    functionCallingConfig?: {
      mode?: "AUTO" | "ANY" | "NONE";
      allowedFunctionNames?: string[];
    };
  };
  responseMimeType?: string;
  responseJsonSchema?: JsonObject;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  stopSequences?: string[];
  candidateCount?: number;
}

/**
 * Request structure for generateContent API
 */
export interface GeminiRequest {
  model: string;
  contents: GeminiContent[];
  config?: GeminiGenerateContentConfig;
}

/**
 * Usage metadata from the response
 */
export interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  thoughtsTokenCount?: number;
  cachedContentTokenCount?: number;
}

/**
 * A response candidate from the model
 */
export interface GeminiCandidate {
  content?: GeminiContent;
  finishReason?: string;
  index?: number;
  safetyRatings?: Array<{
    category: string;
    probability: string;
    blocked?: boolean;
  }>;
  citationMetadata?: {
    citations?: Array<{
      startIndex?: number;
      endIndex?: number;
      uri?: string;
      title?: string;
      license?: string;
      publicationDate?: {
        year?: number;
        month?: number;
        day?: number;
      };
    }>;
  };
  tokenCount?: number;
  avgLogprobs?: number;
}

/**
 * Prompt feedback from the API
 */
export interface GeminiPromptFeedback {
  blockReason?: string;
  safetyRatings?: Array<{
    category: string;
    probability: string;
    blocked?: boolean;
  }>;
}

/**
 * Raw response from Gemini API
 */
export interface GeminiRawResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: GeminiPromptFeedback;
  usageMetadata?: GeminiUsageMetadata;
  modelVersion?: string;
  responseId?: string;
  createTime?: string;
  text?: string;
  functionCalls?: GeminiFunctionCall[];
}

/**
 * Error information from Gemini API
 */
export interface GeminiErrorInfo {
  status?: number;
  code?: number;
  message?: string;
  details?: Array<{
    "@type"?: string;
    reason?: string;
    domain?: string;
    metadata?: Record<string, string>;
  }>;
}

/**
 * Finish reasons returned by Gemini
 */
export const FINISH_REASON = {
  FINISH_REASON_UNSPECIFIED: "FINISH_REASON_UNSPECIFIED",
  STOP: "STOP",
  MAX_TOKENS: "MAX_TOKENS",
  SAFETY: "SAFETY",
  RECITATION: "RECITATION",
  LANGUAGE: "LANGUAGE",
  OTHER: "OTHER",
  BLOCKLIST: "BLOCKLIST",
  PROHIBITED_CONTENT: "PROHIBITED_CONTENT",
  SPII: "SPII",
  MALFORMED_FUNCTION_CALL: "MALFORMED_FUNCTION_CALL",
  IMAGE_SAFETY: "IMAGE_SAFETY",
  UNEXPECTED_TOOL_CALL: "UNEXPECTED_TOOL_CALL",
} as const;

export type GeminiFinishReason =
  (typeof FINISH_REASON)[keyof typeof FINISH_REASON];
