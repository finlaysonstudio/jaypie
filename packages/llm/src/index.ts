export { default as Llm } from "./Llm.js";
export * as LLM from "./constants.js";
export type {
  LlmFallbackConfig,
  LlmHistory,
  LlmInputContent,
  LlmInputContentFile,
  LlmInputContentImage,
  LlmInputContentText,
  LlmInputMessage,
  LlmMessageOptions,
  LlmOperateInput,
  LlmOperateInputContent,
  LlmOperateInputFile,
  LlmOperateInputImage,
  LlmOperateOptions,
  LlmOperateResponse,
  LlmOptions,
  LlmProvider,
} from "./types/LlmProvider.interface.js";
export {
  LlmMessageRole,
  LlmMessageType,
} from "./types/LlmProvider.interface.js";
export {
  isLlmOperateInput,
  isLlmOperateInputContent,
  isLlmOperateInputFile,
  isLlmOperateInputImage,
} from "./types/LlmOperateInput.guards.js";
export type { LlmTool } from "./types/LlmTool.interface.js";
export type {
  LlmStreamChunk,
  LlmStreamChunkDone,
  LlmStreamChunkError,
  LlmStreamChunkText,
  LlmStreamChunkToolCall,
  LlmStreamChunkToolResult,
} from "./types/LlmStreamChunk.interface.js";
export { LlmStreamChunkType } from "./types/LlmStreamChunk.interface.js";

export { JaypieToolkit, toolkit, Toolkit, tools } from "./tools/index.js";

// Utilities
export { extractReasoning } from "./util/extractReasoning.js";

// Providers
export { BedrockProvider } from "./providers/bedrock/index.js";
/** @deprecated Use GoogleProvider — "Google" is the provider; Gemini is the model family */
export { GoogleProvider as GeminiProvider } from "./providers/google/index.js";
export { GoogleProvider } from "./providers/google/index.js";
export { OpenRouterProvider } from "./providers/openrouter/index.js";
export { XaiProvider } from "./providers/xai/index.js";
