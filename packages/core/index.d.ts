// Constants
export const TYPE: {
  ANY: "*";
  ARRAY: ArrayConstructor;
  BOOLEAN: BooleanConstructor;
  CLASS: "_CLASS";
  FUNCTION: FunctionConstructor;
  NUMBER: NumberConstructor;
  NULL: null;
  OBJECT: ObjectConstructor;
  STRING: StringConstructor;
  UNDEFINED: "_UNDEFINED";
};

export const VALIDATE: {
  ANY: "*";
  ARRAY: ArrayConstructor;
  BOOLEAN: BooleanConstructor;
  CLASS: "_CLASS";
  FUNCTION: FunctionConstructor;
  NUMBER: NumberConstructor;
  NULL: null;
  OBJECT: ObjectConstructor;
  STRING: StringConstructor;
  UNDEFINED: "_UNDEFINED";
};

export const HTTP: {
  ALLOW: {
    ANY: "*";
  };
  CODE: {
    OK: 200;
    CREATED: 201;
    ACCEPTED: 202;
    NO_CONTENT: 204;
    FOUND: 302;
    BAD_REQUEST: 400;
    UNAUTHORIZED: 401;
    FORBIDDEN: 403;
    NOT_FOUND: 404;
    METHOD_NOT_ALLOWED: 405;
    CONFLICT: 409;
    GONE: 410;
    TEAPOT: 418;
    INTERNAL_ERROR: 500;
    BAD_GATEWAY: 502;
    UNAVAILABLE: 503;
    GATEWAY_TIMEOUT: 504;
  };
  CONTENT: {
    ANY: "*/*";
    HTML: "text/html";
    JSON: "application/json";
    TEXT: "text/plain";
  };
  HEADER: {
    ACCEPT: "Accept";
    ACCEPT_ENCODING: "Accept-Encoding";
    ALLOW: {
      HEADERS: "Access-Control-Allow-Headers";
      METHODS: "Access-Control-Allow-Methods";
      ORIGIN: "Access-Control-Allow-Origin";
    };
    AMAZON: {
      CF_ID: "X-Amz-Cf-Id";
      CLOUDFRONT_COUNTRY: "CloudFront-Viewer-Country";
      CLOUDFRONT_DESKTOP: "CloudFront-Is-Desktop-Viewer";
      CLOUDFRONT_MOBILE: "CloudFront-Is-Mobile-Viewer";
      CLOUDFRONT_PROTOCOL: "CloudFront-Forwarded-Proto";
      CLOUDFRONT_SMARTTV: "CloudFront-Is-SmartTV-Viewer";
      CLOUDFRONT_TABLET: "CloudFront-Is-Tablet-Viewer";
      TRACE_ID: "X-Amzn-Trace-Id";
    };
    AUTHORIZATION: "Authorization";
    CACHE_CONTROL: "Cache-Control";
    CONTENT_TYPE: "Content-Type";
    COOKIE: {
      REQUEST: "Cookie";
      RESPONSE: "Set-Cookie";
    };
    DATADOG: {
      SESSION_ID: "X-Session-Id";
    };
    FORWARDED: {
      FOR: "X-Forwarded-For";
      PORT: "X-Forwarded-Port";
      PROTOCOL: "X-Forwarded-Proto";
    };
    HOST: "Host";
    ORIGIN: "Origin";
    POSTMAN: {
      TOKEN: "Postman-Token";
    };
    POWERED_BY: "X-Powered-By";
    PROJECT: {
      ACCOUNT: "X-Project-Account";
      CALLER: "X-Project-Caller";
      ENVIRONMENT: "X-Project-Environment";
      KEY: "X-Project-Key";
      HANDLER: "X-Project-Handler";
      INVOCATION: "X-Project-Invocation";
      ROOT_INVOCATION: "X-Project-Root-Invocation";
      SECRET: "X-Project-Secret";
      SEED: "X-Project-Seed";
      SESSION: "X-Project-Session";
      VERSION: "X-Project-Version";
    };
    SIGNATURE: {
      ED25519: "X-Signature-Ed25519";
      TIMESTAMP: "X-Signature-Timestamp";
    };
    USER_AGENT: "User-Agent";
    VIA: "Via";
  };
  METHOD: {
    DELETE: "DELETE";
    HEAD: "HEAD";
    GET: "GET";
    OPTIONS: "OPTIONS";
    POST: "POST";
    PUT: "PUT";
  };
  RESPONSE: Record<string, unknown>;
};

export const JAYPIE: {
  LIB: {
    AWS: "@jaypie/aws";
    CDK: "@jaypie/cdk";
    CONSTRUCTS: "@jaypie/constructs";
    CORE: "@jaypie/core";
    ESLINT: "@jaypie/eslint";
    EXPRESS: "@jaypie/express";
    FABRICATOR: "@jaypie/fabricator";
    ERRORS: "@jaypie/errors";
    JAYPIE: "jaypie";
    KIT: "@jaypie/kit";
    LAMBDA: "@jaypie/lambda";
    LLM: "@jaypie/llm";
    LOGGER: "@jaypie/logger";
    MCP: "@jaypie/mcp";
    MOCK: "@jaypie/mock";
    MONGOOSE: "@jaypie/mongoose";
    TESTKIT: "@jaypie/testkit";
    TEXTTRACT: "@jaypie/textract";
    TYPES: "@jaypie/types";
    WEBKIT: "@jaypie/webkit";
  };
  LAYER: {
    EXPRESS: "express";
    HANDLER: "handler";
    JAYPIE: "jaypie";
    LAMBDA: "lambda";
    MODULE: "module";
    NEXTJS: "nextjs";
  };
  LOGGER: {
    DEFAULT: "default";
    MODULE: "module";
  };
  UNKNOWN: "unknown";
};

export const PROJECT: {
  SPONSOR: {
    FINLAYSON: "finlaysonstudio";
    JAYPIE: "jaypie";
    KNOWDEV: "knowdev.studio";
  };
};

// Error Classes
export class ProjectError extends Error {
  isProjectError: true;
  title: string;
  detail: string;
  status: number;
  _type: string;
  json(): { errors: Array<{ title: string; detail: string; status: number }> };
}

export class ProjectMultiError extends Error {
  isProjectError: true;
  errors: ProjectError[];
  status: number;
  _type: string;
  json(): { errors: Array<{ title: string; detail: string; status: number }> };
}

export const MultiError = ProjectMultiError;

// Error Constructors
export class BadGatewayError extends ProjectError {}
export class BadRequestError extends ProjectError {}
export class ConfigurationError extends ProjectError {}
export class ForbiddenError extends ProjectError {}
export class GatewayTimeoutError extends ProjectError {}
export class GoneError extends ProjectError {}
export class IllogicalError extends ProjectError {}
export class InternalError extends ProjectError {}
export class MethodNotAllowedError extends ProjectError {}
export class NotFoundError extends ProjectError {}
export class NotImplementedError extends ProjectError {}
export class RejectedError extends ProjectError {}
export class TeapotError extends ProjectError {}
export class UnauthorizedError extends ProjectError {}
export class UnavailableError extends ProjectError {}
export class UnhandledError extends ProjectError {}
export class UnreachableCodeError extends ProjectError {}

export const ERROR: {
  MESSAGE: {
    BAD_GATEWAY: "An unexpected error occurred on an upstream resource";
    BAD_REQUEST: "The request was not properly formatted";
    CONFIGURATION_ERROR: "The application responding to the request encountered a configuration error";
    FORBIDDEN: "Access to this resource is not authorized";
    GATEWAY_TIMEOUT: "The connection timed out waiting for an upstream resource";
    GONE: "The requested resource is no longer available";
    ILLOGICAL: "The application encountered an illogical condition while processing the request";
    INTERNAL_ERROR: "An unexpected error occurred and the request was unable to complete";
    METHOD_NOT_ALLOWED: "The requested method is not allowed";
    NOT_FOUND: "The requested resource was not found";
    NOT_IMPLEMENTED: "The request was understood but the resource is not implemented";
    REJECTED: "The request was rejected prior to processing";
    TEAPOT: "This resource is a teapot incapable of processing the request";
    UNAUTHORIZED: "The request did not include valid authentication credentials";
    UNAVAILABLE: "The requested resource is temporarily unavailable";
    UNHANDLED: "An unhandled error occurred and the request was unable to complete";
    UNREACHABLE_CODE: "The application encountered an unreachable condition while processing the request";
  };
  TITLE: {
    BAD_GATEWAY: "Bad Gateway";
    BAD_REQUEST: "Bad Request";
    CONFIGURATION_ERROR: "Internal Configuration Error";
    FORBIDDEN: "Forbidden";
    GATEWAY_TIMEOUT: "Gateway Timeout";
    GONE: "Gone";
    INTERNAL_ERROR: "Internal Application Error";
    METHOD_NOT_ALLOWED: "Method Not Allowed";
    NOT_FOUND: "Not Found";
    NOT_IMPLEMENTED: "Not Implemented";
    REJECTED: "Request Rejected";
    TEAPOT: "Teapot";
    UNAUTHORIZED: "Service Unauthorized";
    UNAVAILABLE: "Service Unavailable";
  };
  TYPE: {
    BAD_GATEWAY: "BAD_GATEWAY";
    BAD_REQUEST: "BAD_REQUEST";
    CONFIGURATION_ERROR: "CONFIGURATION_ERROR";
    FORBIDDEN: "FORBIDDEN";
    GATEWAY_TIMEOUT: "GATEWAY_TIMEOUT";
    GONE: "GONE";
    ILLOGICAL: "ILLOGICAL";
    INTERNAL_ERROR: "INTERNAL_ERROR";
    METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED";
    MULTI_ERROR: "MULTI_ERROR";
    NOT_FOUND: "NOT_FOUND";
    NOT_IMPLEMENTED: "NOT_IMPLEMENTED";
    REJECTED: "REJECTED";
    TEAPOT: "TEAPOT";
    UNAUTHORIZED: "UNAUTHORIZED";
    UNAVAILABLE: "UNAVAILABLE";
    UNHANDLED: "UNHANDLED";
    UNKNOWN_TYPE: "UNKNOWN_TYPE";
    UNREACHABLE_CODE: "UNREACHABLE_CODE";
  };
};

// Utility Functions
export function envBoolean(
  key: string,
  options?: { defaultValue?: boolean },
): boolean | undefined;
export function envsKey(
  key: string,
  options?: { env?: string },
): string | false;
export function errorFromStatusCode(
  statusCode: number,
  message?: string,
): ProjectError;
export function formatError(error: ProjectError): {
  status: number;
  data: { errors: Array<{ title: string; detail: string; status: number }> };
};
export function getHeaderFrom(
  headerKey: string,
  searchObject: Record<string, unknown>,
): string | undefined;
export function getObjectKeyCaseInsensitive(
  object: Record<string, unknown>,
  key: string,
): unknown;
export function isClass(subject: unknown): boolean;
export function isJaypieError(error: unknown): boolean;

// Handler Function
export interface HandlerOptions {
  name?: string;
  setup?: Array<(...args: unknown[]) => Promise<void> | void>;
  teardown?: Array<(...args: unknown[]) => Promise<void> | void>;
  unavailable?: boolean;
  validate?: Array<(...args: unknown[]) => Promise<boolean> | boolean>;
}

export function jaypieHandler<T extends (...args: unknown[]) => unknown>(
  handler: T,
  options?: HandlerOptions,
): (...args: Parameters<T>) => Promise<ReturnType<T>>;

// Logger
export const log: {
  debug: {
    (...args: unknown[]): void;
    var(key: string | Record<string, unknown>, value?: unknown): void;
  };
  error: {
    (...args: unknown[]): void;
    var(key: string | Record<string, unknown>, value?: unknown): void;
  };
  fatal: {
    (...args: unknown[]): void;
    var(key: string | Record<string, unknown>, value?: unknown): void;
  };
  info: {
    (...args: unknown[]): void;
    var(key: string | Record<string, unknown>, value?: unknown): void;
  };
  trace: {
    (...args: unknown[]): void;
    var(key: string | Record<string, unknown>, value?: unknown): void;
  };
  warn: {
    (...args: unknown[]): void;
    var(key: string | Record<string, unknown>, value?: unknown): void;
  };
  var(key: string | Record<string, unknown>, value?: unknown): void;
  with(tags: Record<string, unknown>): typeof log;
  tag(
    key: string | string[] | Record<string, unknown> | null,
    value?: string,
  ): void;
  untag(tags: string | string[] | Record<string, unknown> | null): void;
  lib(options: {
    level?: string;
    lib?: string;
    tags?: Record<string, unknown>;
  }): typeof log;
};

// Validation Functions
export interface ValidationOptions {
  falsy?: boolean;
  required?: boolean;
  throws?: boolean;
}

export const validate: {
  (
    argument: unknown,
    options?: ValidationOptions & { type?: unknown },
  ): boolean;
  array<T = unknown>(
    argument: unknown,
    options?: ValidationOptions,
  ): argument is T[];
  boolean(argument: unknown, options?: ValidationOptions): argument is boolean;
  class(argument: unknown, options?: ValidationOptions): boolean;
  function(
    argument: unknown,
    options?: ValidationOptions,
  ): argument is (...args: unknown[]) => unknown;
  null(argument: unknown, options?: ValidationOptions): argument is null;
  number(argument: unknown, options?: ValidationOptions): argument is number;
  object<T extends Record<string, unknown> = Record<string, unknown>>(
    argument: unknown,
    options?: ValidationOptions,
  ): argument is T;
  string(argument: unknown, options?: ValidationOptions): argument is string;
  undefined(
    argument: unknown,
    options?: ValidationOptions,
  ): argument is undefined;
  optional: {
    array<T = unknown>(
      argument: unknown,
      options?: ValidationOptions,
    ): argument is T[] | undefined;
    boolean(
      argument: unknown,
      options?: ValidationOptions,
    ): argument is boolean | undefined;
    class(argument: unknown, options?: ValidationOptions): boolean;
    function(
      argument: unknown,
      options?: ValidationOptions,
    ): argument is ((...args: unknown[]) => unknown) | undefined;
    null(
      argument: unknown,
      options?: ValidationOptions,
    ): argument is null | undefined;
    number(
      argument: unknown,
      options?: ValidationOptions,
    ): argument is number | undefined;
    object<T extends Record<string, unknown> = Record<string, unknown>>(
      argument: unknown,
      options?: ValidationOptions,
    ): argument is T | undefined;
    string(
      argument: unknown,
      options?: ValidationOptions,
    ): argument is string | undefined;
  };
};

export const force: {
  (
    value: unknown,
    type: unknown,
    options?:
      | string
      | { key?: string; maximum?: number; minimum?: number; nan?: boolean },
  ): unknown;
  array<T = unknown>(value: unknown): T[];
  boolean(value: unknown): boolean;
  number(value: unknown): number;
  object<T extends Record<string, unknown> = Record<string, unknown>>(
    value: unknown,
    key?: string,
  ): T;
  positive(value: unknown): number;
  string(value: unknown, defaultValue?: string): string;
};

export const optional: {
  (value: unknown, type: unknown, options?: Record<string, unknown>): boolean;
  array<T = unknown>(value: unknown): value is T[] | undefined;
  boolean(value: unknown): value is boolean | undefined;
  number(value: unknown): value is number | undefined;
  object<T extends Record<string, unknown> = Record<string, unknown>>(
    value: unknown,
  ): value is T | undefined;
  positive(value: unknown): value is number | undefined;
  string(value: unknown, defaultValue?: string): value is string | undefined;
};

export const required: {
  (value: unknown, type: unknown, options?: Record<string, unknown>): boolean;
  array<T = unknown>(value: unknown): value is T[];
  boolean(value: unknown): value is boolean;
  number(value: unknown): value is number;
  object<T extends Record<string, unknown> = Record<string, unknown>>(
    value: unknown,
  ): value is T;
  positive(value: unknown): value is number;
  string(value: unknown, defaultValue?: string): value is string;
};

// Utility Functions
export function placeholders(
  template: string | (() => string),
  data?: Record<string, unknown>,
): string;
export function resolveValue<T = unknown>(valueOrFunction: T | (() => T)): T;
export function safeParseFloat(value: string | number): number;
export function sleep(milliseconds?: number): Promise<void>;

// Re-exports
export const cloneDeep: <T>(value: T) => T;
export { v4 as uuid } from "uuid";
