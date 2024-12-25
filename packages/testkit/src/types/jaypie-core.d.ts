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

  export const log: {
    debug: (...args: any[]) => void;
    error: (...args: any[]) => void;
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
  };

  export const force: {
    boolean: (value: unknown) => boolean;
  };

  export function uuid(): string;

  // Error Classes
  export class BadGatewayError extends Error {
    constructor(...args: any[]);
    status: number;
    _type: string;
    json(): object;
  }

  export class BadRequestError extends Error {
    constructor(...args: any[]);
    status: number;
    _type: string;
    json(): object;
  }

  export class ConfigurationError extends Error {
    constructor(...args: any[]);
    status: number;
    _type: string;
    json(): object;
  }

  export class ForbiddenError extends Error {
    constructor(...args: any[]);
    status: number;
    _type: string;
    json(): object;
  }

  export class GatewayTimeoutError extends Error {
    constructor(...args: any[]);
    status: number;
    _type: string;
    json(): object;
  }

  export class GoneError extends Error {
    constructor(...args: any[]);
    status: number;
    _type: string;
    json(): object;
  }

  export class IllogicalError extends Error {
    constructor(...args: any[]);
    status: number;
    _type: string;
    json(): object;
  }

  export class InternalError extends Error {
    constructor(...args: any[]);
    status: number;
    _type: string;
    json(): object;
  }

  export class MethodNotAllowedError extends Error {
    constructor(...args: any[]);
    status: number;
    _type: string;
    json(): object;
  }

  export class MultiError extends Error {
    constructor(...args: any[]);
    status: number;
    _type: string;
    json(): object;
  }

  export class NotFoundError extends Error {
    constructor(...args: any[]);
    status: number;
    _type: string;
    json(): object;
  }

  export class NotImplementedError extends Error {
    constructor(...args: any[]);
    status: number;
    _type: string;
    json(): object;
  }

  export class ProjectError extends Error {
    constructor(...args: any[]);
    status: number;
    _type: string;
    json(): object;
  }

  export class ProjectMultiError extends Error {
    constructor(...args: any[]);
    status: number;
    _type: string;
    json(): object;
  }

  export class RejectedError extends Error {
    constructor(...args: any[]);
    status: number;
    _type: string;
    json(): object;
  }

  export class TeapotError extends Error {
    constructor(...args: any[]);
    status: number;
    _type: string;
    json(): object;
  }

  export class UnauthorizedError extends Error {
    constructor(...args: any[]);
    status: number;
    _type: string;
    json(): object;
  }

  export class UnavailableError extends Error {
    constructor(...args: any[]);
    status: number;
    _type: string;
    json(): object;
  }

  export class UnhandledError extends Error {
    constructor(...args: any[]);
    status: number;
    _type: string;
    json(): object;
  }

  export class UnreachableCodeError extends Error {
    constructor(...args: any[]);
    status: number;
    _type: string;
    json(): object;
  }

  // Error Type Guard
  export function isJaypieError(error: unknown): error is {
    _type: string;
    status: number;
    json(): object;
    [key: string]: unknown;
  };
} 