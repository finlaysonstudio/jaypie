/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "@jaypie/core" {
  // Core utilities
  export const HTTP: {
    CODE: {
      OK: number;
      CREATED: number;
      NO_CONTENT: number;
      INTERNAL_SERVER_ERROR: number;
      [key: string]: number;
    };
  };

  export const JAYPIE: {
    LIB: {
      TESTKIT: string;
      [key: string]: string;
    };
  };

  export interface LogMethod {
    (...args: any[]): void;
    var: (...args: any[]) => void;
  }

  export interface Log {
    debug: LogMethod;
    error: LogMethod;
    fatal: LogMethod;
    info: LogMethod;
    init: (...args: any[]) => void;
    lib: (name: string) => Log;
    tag: (
      key: string | string[] | Record<string, string> | null,
      value?: string,
    ) => void;
    trace: LogMethod;
    untag: (key: string | string[] | Record<string, string> | null) => void;
    var: (...args: any[]) => void;
    warn: LogMethod;
    with: (key: string | Record<string, string>, value?: string) => Log;
  }

  export const log: Log;

  export const force: {
    array: (value: unknown) => Array<any>;
    boolean: (value: unknown) => boolean;
  };

  export function uuid(): string;
  
  // Validate functions
  export interface ValidateOptional {
    array: (value: unknown) => any[] | undefined;
    boolean: (value: unknown) => boolean | undefined;
    class: (value: unknown, className: any) => any | undefined;
    function: (value: unknown) => Function | undefined;
    null: (value: unknown) => null | undefined;
    number: (value: unknown) => number | undefined;
    object: (value: unknown) => object | undefined;
    string: (value: unknown) => string | undefined;
  }

  export interface ValidateFunction {
    (value: unknown): any;
    array: (value: unknown) => any[];
    boolean: (value: unknown) => boolean;
    class: (value: unknown, className: any) => any;
    function: (value: unknown) => Function;
    null: (value: unknown) => null;
    number: (value: unknown) => number;
    object: (value: unknown) => object;
    string: (value: unknown) => string;
    undefined: (value: unknown) => undefined;
    optional: ValidateOptional;
  }

  export const validate: ValidateFunction;

  // Error Classes
  export class ProjectError extends Error {
    constructor(...args: any[]);
    status: number;
    _type: string;
    json(): object;
    [key: string]: unknown;
  }

  export class BadGatewayError extends ProjectError {
    constructor(...args: any[]);
  }

  export class BadRequestError extends ProjectError {
    constructor(...args: any[]);
  }

  export class ConfigurationError extends ProjectError {
    constructor(...args: any[]);
  }

  export class ForbiddenError extends ProjectError {
    constructor(...args: any[]);
  }

  export class GatewayTimeoutError extends ProjectError {
    constructor(...args: any[]);
  }

  export class GoneError extends ProjectError {
    constructor(...args: any[]);
  }

  export class IllogicalError extends ProjectError {
    constructor(...args: any[]);
  }

  export class InternalError extends ProjectError {
    constructor(...args: any[]);
  }

  export class MethodNotAllowedError extends ProjectError {
    constructor(...args: any[]);
  }

  export class MultiError extends ProjectError {
    constructor(...args: any[]);
  }

  export class NotFoundError extends ProjectError {
    constructor(...args: any[]);
  }

  export class NotImplementedError extends ProjectError {
    constructor(...args: any[]);
  }

  export class ProjectMultiError extends ProjectError {
    constructor(...args: any[]);
  }

  export class RejectedError extends ProjectError {
    constructor(...args: any[]);
  }

  export class TeapotError extends ProjectError {
    constructor(...args: any[]);
  }

  export class UnauthorizedError extends ProjectError {
    constructor(...args: any[]);
  }

  export class UnavailableError extends ProjectError {
    constructor(...args: any[]);
  }

  export class UnhandledError extends ProjectError {
    constructor(...args: any[]);
  }

  export class UnreachableCodeError extends ProjectError {
    constructor(...args: any[]);
  }

  // Error Type Guard
  export function isJaypieError(error: unknown): error is {
    _type: string;
    status: number;
    json(): object;
    [key: string]: unknown;
  };
}
