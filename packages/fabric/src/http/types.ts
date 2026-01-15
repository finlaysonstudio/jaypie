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
