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
    ERRORS: "@jaypie/errors";
    JAYPIE: "jaypie";
    LAMBDA: "@jaypie/lambda";
    LLM: "@jaypie/llm";
    MONGOOSE: "@jaypie/mongoose";
    TESTKIT: "@jaypie/testkit";
    WEBKIT: "@jaypie/webkit";
  };
  LAYER: {
    EXPRESS: "express";
    HANDLER: "handler";
    JAYPIE: "jaypie";
    LAMBDA: "lambda";
    MODULE: "module";
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
  debug(...args: unknown[]): void;
  error(...args: unknown[]): void;
  fatal(...args: unknown[]): void;
  info(...args: unknown[]): void;
  trace(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  var(key: string | Record<string, unknown>, value?: unknown): void;
  with(tags: Record<string, unknown>): typeof log;
  tag(tags: Record<string, unknown>): void;
  untag(tags: string | string[] | Record<string, unknown>): void;
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
  array(argument: unknown, options?: ValidationOptions): boolean;
  boolean(argument: unknown, options?: ValidationOptions): boolean;
  class(argument: unknown, options?: ValidationOptions): boolean;
  function(argument: unknown, options?: ValidationOptions): boolean;
  null(argument: unknown, options?: ValidationOptions): boolean;
  number(argument: unknown, options?: ValidationOptions): boolean;
  object(argument: unknown, options?: ValidationOptions): boolean;
  string(argument: unknown, options?: ValidationOptions): boolean;
  undefined(argument: unknown, options?: ValidationOptions): boolean;
  optional: {
    array(argument: unknown, options?: ValidationOptions): boolean;
    boolean(argument: unknown, options?: ValidationOptions): boolean;
    class(argument: unknown, options?: ValidationOptions): boolean;
    function(argument: unknown, options?: ValidationOptions): boolean;
    null(argument: unknown, options?: ValidationOptions): boolean;
    number(argument: unknown, options?: ValidationOptions): boolean;
    object(argument: unknown, options?: ValidationOptions): boolean;
    string(argument: unknown, options?: ValidationOptions): boolean;
  };
};

export const optional: {
  (value: unknown, type: unknown, options?: Record<string, unknown>): boolean;
  array(value: unknown): boolean;
  boolean(value: unknown): boolean;
  number(value: unknown): boolean;
  object(value: unknown): boolean;
  positive(value: unknown): boolean;
  string(value: unknown, defaultValue?: string): boolean;
};

export const required: {
  (value: unknown, type: unknown, options?: Record<string, unknown>): boolean;
  array(value: unknown): boolean;
  boolean(value: unknown): boolean;
  number(value: unknown): boolean;
  object(value: unknown): boolean;
  positive(value: unknown): boolean;
  string(value: unknown, defaultValue?: string): boolean;
};

// Utility Functions
export function force(
  value: unknown,
  type: unknown,
  options?:
    | string
    | { key?: string; maximum?: number; minimum?: number; nan?: boolean },
): unknown;
export function placeholders(
  template: string | (() => string),
  data?: Record<string, unknown>,
): string;
export function safeParseFloat(value: string | number): number;
export function sleep(milliseconds?: number): Promise<void>;

// Re-exports
export { default as cloneDeep } from "lodash.clonedeep";
export { v4 as uuid } from "uuid";
