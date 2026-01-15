// @jaypie/fabric/http - HTTP adapter for fabric services

// Main exports
export { fabricHttp, isFabricHttpService } from "./fabricHttp.js";
export type { HttpServiceContext } from "./fabricHttp.js";

// Authorization utilities
export {
  extractToken,
  getAuthHeader,
  isAuthorizationRequired,
  validateAuthorization,
} from "./authorization.js";

// CORS utilities
export {
  buildCorsHeaders,
  buildPreflightHeaders,
  DEFAULT_CORS_CONFIG,
  DEFAULT_CORS_METHODS,
  getAllowedOrigin,
  isPreflightRequest,
  normalizeCorsConfig,
} from "./cors.js";

// HTTP transformation utilities
export {
  createHttpContext,
  defaultHttpTransform,
  parseBody,
  parsePathParams,
  parseQueryString,
  transformHttpToInput,
} from "./httpTransform.js";

// Streaming utilities
export {
  collectStreamEvents,
  createCompleteEvent,
  createDataEvent,
  createErrorEvent,
  createMessageEvent,
  createNoopEvent,
  createStreamContext,
  createTextEvent,
  createToolCallEvent,
  createToolResultEvent,
  DEFAULT_STREAM_CONFIG,
  formatNdjsonEvent,
  formatSseEvent,
  formatStreamEvent,
  getStreamContentType,
  isAsyncIterable,
  isStreamingEnabled,
  llmChunkToHttpEvent,
  normalizeStreamConfig,
  pipeLlmStream,
  pipeLlmStreamToWriter,
  wrapServiceForStreaming,
} from "./stream.js";
export type {
  HttpStreamContext,
  LlmStreamChunk,
  PipeLlmStreamOptions,
  StreamWriter,
} from "./stream.js";

// Types
export type {
  AuthorizationConfig,
  AuthorizationFunction,
  CorsConfig,
  CorsHeaders,
  CorsOption,
  DataResponse,
  ErrorObject,
  ErrorResponse,
  FabricHttpConfig,
  FabricHttpService,
  HttpContext,
  HttpMethod,
  HttpStreamEvent,
  HttpStreamEventBase,
  HttpStreamEventComplete,
  HttpStreamEventData,
  HttpStreamEventError,
  HttpStreamEventMessage,
  HttpStreamEventNoop,
  HttpStreamEventText,
  HttpStreamEventToolCall,
  HttpStreamEventToolResult,
  HttpTransformFunction,
  StreamConfig,
  StreamingServiceFunction,
  StreamOption,
} from "./types.js";

export { DEFAULT_HTTP_METHODS, HttpStreamEventType } from "./types.js";
