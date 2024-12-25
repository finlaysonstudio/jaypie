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