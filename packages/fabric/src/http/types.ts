import type { Service, ServiceConfig } from "../types.js";

// #region HTTP Context

/**
 * HTTP request context passed to the `http` transformation function
 */
export interface HttpContext {
  /** Parsed request body */
  body: unknown;
  /** Request headers */
  headers: Headers;
  /** HTTP method (GET, POST, PUT, DELETE, PATCH) */
  method: string;
  /** URL path */
  path: string;
  /** Query string parameters */
  query: URLSearchParams;
  /** Path parameters extracted from route pattern (e.g., :id) */
  params: Record<string, string>;
}

/**
 * Function that transforms HTTP context to fabric service input
 */
export type HttpTransformFunction<TInput = Record<string, unknown>> = (
  context: HttpContext,
) => TInput | Promise<TInput>;

// #endregion

// #region Authorization

/**
 * Authorization function that validates a token and returns auth context
 * Token is extracted from Authorization header with Bearer prefix removed
 */
export type AuthorizationFunction<TAuth = unknown> = (
  token: string,
) => TAuth | Promise<TAuth>;

/**
 * Authorization configuration - either a function or false for public endpoints
 */
export type AuthorizationConfig<TAuth = unknown> =
  | AuthorizationFunction<TAuth>
  | false;

// #endregion

// #region CORS

/**
 * CORS configuration options
 */
export interface CorsConfig {
  /** Allowed origins - "*" for all, or array of specific origins */
  origin?: string | string[];
  /** Allow credentials (Access-Control-Allow-Credentials) */
  credentials?: boolean;
  /** Additional allowed headers (Access-Control-Allow-Headers) */
  headers?: string[];
  /** Headers to expose to the client (Access-Control-Expose-Headers) */
  exposeHeaders?: string[];
  /** Preflight cache duration in seconds (Access-Control-Max-Age) */
  maxAge?: number;
}

/**
 * CORS configuration - object config, true for defaults, or false to disable
 */
export type CorsOption = CorsConfig | boolean;

/**
 * Resolved CORS headers to send in response
 */
export interface CorsHeaders {
  "Access-Control-Allow-Origin"?: string;
  "Access-Control-Allow-Methods"?: string;
  "Access-Control-Allow-Headers"?: string;
  "Access-Control-Allow-Credentials"?: string;
  "Access-Control-Expose-Headers"?: string;
  "Access-Control-Max-Age"?: string;
}

// #endregion

// #region Response Format

/**
 * JSON:API-style success response envelope
 */
export interface DataResponse<T = unknown> {
  data: T;
}

/**
 * JSON:API-style error object
 */
export interface ErrorObject {
  status: number;
  title: string;
  detail?: string;
}

/**
 * JSON:API-style error response envelope
 */
export interface ErrorResponse {
  errors: ErrorObject[];
}

// #endregion

// #region fabricHttp Config

/**
 * HTTP service configuration - extends base ServiceConfig with HTTP-specific options
 */
export interface FabricHttpConfig<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
  TAuth = unknown,
> extends Omit<ServiceConfig<TInput, TOutput>, "service"> {
  /** Pre-built fabricService or inline service function */
  service?:
    | Service<TInput, TOutput>
    | ServiceConfig<TInput, TOutput>["service"];

  /** Transform HTTP context to service input (defaults to body + query merge) */
  http?: HttpTransformFunction<TInput>;

  /** Authorization function or false for public endpoints */
  authorization?: AuthorizationConfig<TAuth>;

  /** CORS configuration (enabled by default) */
  cors?: CorsOption;

  /** Streaming configuration (disabled by default) */
  stream?: StreamOption;
}

/**
 * HTTP service - fabricService with HTTP-specific metadata
 */
export interface FabricHttpService<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
  TAuth = unknown,
> extends Service<TInput, TOutput> {
  /** HTTP transformation function */
  http: HttpTransformFunction<TInput>;
  /** Authorization configuration */
  authorization: AuthorizationConfig<TAuth>;
  /** CORS configuration */
  cors: CorsOption;
  /** Streaming configuration */
  stream: StreamOption;
}

// #endregion

// #region HTTP Methods

/**
 * Supported HTTP methods
 */
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "OPTIONS";

/**
 * Default HTTP methods for fabric services
 */
export const DEFAULT_HTTP_METHODS: HttpMethod[] = ["GET", "POST", "DELETE"];

// #endregion

// #region Streaming

/**
 * HTTP stream event types for SSE/NDJSON streaming
 */
export enum HttpStreamEventType {
  /** Stream complete */
  Complete = "complete",
  /** Final response data */
  Data = "data",
  /** Error event */
  Error = "error",
  /** Fabric progress message (from sendMessage) */
  Message = "message",
  /** Keep-alive signal (no content) */
  Noop = "noop",
  /** LLM text chunk */
  Text = "text",
  /** LLM tool call event */
  ToolCall = "tool_call",
  /** LLM tool result event */
  ToolResult = "tool_result",
}

/**
 * Base stream event structure
 */
export interface HttpStreamEventBase {
  stream: HttpStreamEventType;
}

/**
 * Message event - progress updates from sendMessage
 */
export interface HttpStreamEventMessage extends HttpStreamEventBase {
  stream: HttpStreamEventType.Message;
  content: string;
  level?: "trace" | "debug" | "info" | "warn" | "error";
}

/**
 * Text event - LLM text chunk
 */
export interface HttpStreamEventText extends HttpStreamEventBase {
  stream: HttpStreamEventType.Text;
  content: string;
}

/**
 * Tool call event - LLM requesting tool execution
 */
export interface HttpStreamEventToolCall extends HttpStreamEventBase {
  stream: HttpStreamEventType.ToolCall;
  toolCall: {
    id: string;
    name: string;
    arguments: string;
  };
}

/**
 * Tool result event - result from tool execution
 */
export interface HttpStreamEventToolResult extends HttpStreamEventBase {
  stream: HttpStreamEventType.ToolResult;
  toolResult: {
    id: string;
    name: string;
    result: unknown;
  };
}

/**
 * Data event - final response data
 */
export interface HttpStreamEventData<T = unknown> extends HttpStreamEventBase {
  stream: HttpStreamEventType.Data;
  data: T;
}

/**
 * Error event
 */
export interface HttpStreamEventError extends HttpStreamEventBase {
  stream: HttpStreamEventType.Error;
  error: {
    status: number | string;
    title: string;
    detail?: string;
  };
}

/**
 * Complete event - stream complete
 */
export interface HttpStreamEventComplete extends HttpStreamEventBase {
  stream: HttpStreamEventType.Complete;
}

/**
 * Noop event - keep-alive signal
 */
export interface HttpStreamEventNoop extends HttpStreamEventBase {
  stream: HttpStreamEventType.Noop;
}

/**
 * Union of all stream event types
 */
export type HttpStreamEvent =
  | HttpStreamEventComplete
  | HttpStreamEventData
  | HttpStreamEventError
  | HttpStreamEventMessage
  | HttpStreamEventNoop
  | HttpStreamEventText
  | HttpStreamEventToolCall
  | HttpStreamEventToolResult;

/**
 * Stream configuration options (internal)
 */
export interface StreamConfig {
  /** Output format - NDJSON (default) or SSE */
  format?: "ndjson" | "sse";
  /** Keep-alive heartbeat interval in ms (default: 15000) */
  heartbeat?: number;
  /** Include tool calls/results in stream (default: true) */
  includeTools?: boolean;
}

/**
 * Stream option - true to enable streaming, false to disable
 */
export type StreamOption = boolean;

/**
 * Streaming service function that yields events
 */
export type StreamingServiceFunction<
  TInput extends Record<string, unknown> = Record<string, unknown>,
> = (
  input: TInput,
  context: unknown,
) => AsyncIterable<HttpStreamEvent> | Promise<AsyncIterable<HttpStreamEvent>>;

// #endregion

// #region FabricHttpServer Config

/**
 * Route entry for FabricHttpServer - service with path and method configuration
 */
export interface FabricHttpServerRoute<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
  TAuth = unknown,
> {
  /** The FabricHttpService to handle requests */
  service: FabricHttpService<TInput, TOutput, TAuth>;
  /** Route path pattern (defaults to /${alias}) */
  path?: string;
  /** Allowed HTTP methods (defaults to DEFAULT_HTTP_METHODS) */
  methods?: HttpMethod[];
}

/**
 * Service entry - either a FabricHttpService or a route config
 */
export type FabricHttpServerServiceEntry =
  | FabricHttpService
  | FabricHttpServerRoute;

/**
 * Configuration for FabricHttpServer
 */
export interface FabricHttpServerConfig {
  /** Array of services or route configs to register */
  services: FabricHttpServerServiceEntry[];
  /** Server-level authorization (applied to all services unless overridden) */
  authorization?: AuthorizationConfig;
  /** Server-level CORS config (applied to all services unless overridden) */
  cors?: CorsOption;
  /** Path prefix for all routes (e.g., "/api") */
  prefix?: string;
}

/**
 * API Gateway v1 (REST API) event format
 */
export interface ApiGatewayV1Event {
  body: string | null;
  headers: Record<string, string>;
  httpMethod: string;
  path: string;
  pathParameters?: Record<string, string> | null;
  queryStringParameters?: Record<string, string> | null;
  requestContext?: {
    requestId?: string;
  };
}

/**
 * API Gateway v2 (HTTP API) event format
 */
export interface ApiGatewayV2Event {
  body?: string;
  headers: Record<string, string>;
  rawPath: string;
  rawQueryString?: string;
  requestContext: {
    http: {
      method: string;
      path: string;
    };
    requestId?: string;
  };
  pathParameters?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
}

/**
 * Union of API Gateway event types
 */
export type ApiGatewayEvent = ApiGatewayV1Event | ApiGatewayV2Event;

/**
 * API Gateway response format (compatible with v1 and v2)
 */
export interface ApiGatewayResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * Registered route with resolved path and methods
 */
export interface RegisteredRoute {
  /** Compiled path pattern */
  path: string;
  /** Path segments for matching */
  segments: string[];
  /** Allowed methods */
  methods: HttpMethod[];
  /** The service to handle requests */
  service: FabricHttpService;
}

/**
 * Match result from route matching
 */
export interface RouteMatch {
  /** The matched route */
  route: RegisteredRoute;
  /** Extracted path parameters */
  params: Record<string, string>;
}

/**
 * FabricHttpServer handler function
 */
export type FabricHttpServerHandler = (
  event: ApiGatewayEvent,
) => Promise<ApiGatewayResponse>;

/**
 * FabricHttpServer with metadata
 */
export interface FabricHttpServer extends FabricHttpServerHandler {
  /** Registered services */
  services: FabricHttpService[];
  /** Route prefix */
  prefix?: string;
  /** Registered routes */
  routes: RegisteredRoute[];
}

// #endregion
