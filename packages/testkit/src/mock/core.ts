/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createMockFunction } from "./utils";
import { beforeAll } from "vitest";
import { spyLog } from "../mockLog.module.js";
import { log } from "@jaypie/core";

// Constants for mock values
const TAG = "CORE";

// Base error class for all Jaypie errors
export class JaypieError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JaypieError";
  }
}

// Mock core errors - All error classes extend JaypieError
export class MockValidationError extends JaypieError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class MockNotFoundError extends JaypieError {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

// Add all missing error classes
export class BadGatewayError extends JaypieError {
  constructor(message: string) {
    super(message);
    this.name = "BadGatewayError";
  }
}

export class BadRequestError extends JaypieError {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

export class ConfigurationError extends JaypieError {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export class ForbiddenError extends JaypieError {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class GatewayTimeoutError extends JaypieError {
  constructor(message: string) {
    super(message);
    this.name = "GatewayTimeoutError";
  }
}

export class GoneError extends JaypieError {
  constructor(message: string) {
    super(message);
    this.name = "GoneError";
  }
}

export class IllogicalError extends JaypieError {
  constructor(message: string) {
    super(message);
    this.name = "IllogicalError";
  }
}

export class InternalError extends JaypieError {
  constructor(message: string) {
    super(message);
    this.name = "InternalError";
  }
}

export class MethodNotAllowedError extends JaypieError {
  constructor(message: string) {
    super(message);
    this.name = "MethodNotAllowedError";
  }
}

export class MultiError extends JaypieError {
  constructor(
    message: string,
    public errors: Error[] = [],
  ) {
    super(message);
    this.name = "MultiError";
  }
}

export class NotImplementedError extends JaypieError {
  constructor(message: string) {
    super(message);
    this.name = "NotImplementedError";
  }
}

export class ProjectError extends JaypieError {
  constructor(message: string) {
    super(message);
    this.name = "ProjectError";
  }
}

export class ProjectMultiError extends MultiError {
  constructor(message: string, errors: Error[] = []) {
    super(message, errors);
    this.name = "ProjectMultiError";
  }
}

export class RejectedError extends JaypieError {
  constructor(message: string) {
    super(message);
    this.name = "RejectedError";
  }
}

export class TeapotError extends JaypieError {
  constructor(message: string) {
    super(message);
    this.name = "TeapotError";
  }
}

export class UnauthorizedError extends JaypieError {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class UnavailableError extends JaypieError {
  constructor(message: string) {
    super(message);
    this.name = "UnavailableError";
  }
}

export class UnhandledError extends JaypieError {
  constructor(message: string) {
    super(message);
    this.name = "UnhandledError";
  }
}

export class UnreachableCodeError extends JaypieError {
  constructor(message: string) {
    super(message);
    this.name = "UnreachableCodeError";
  }
}

// Mock core functions
export const validate = createMockFunction<(data: any, schema: any) => boolean>(
  () => true,
);

export const getConfig = createMockFunction<() => Record<string, string>>(
  () => ({ environment: "test" }),
);

beforeAll(async () => {
  spyLog(log);
});
export { log };

// Add missing core functions
export const cloneDeep = createMockFunction<(obj: any) => any>((obj) => {
  try {
    return structuredClone(obj);
  } catch (error) {
    return JSON.parse(JSON.stringify(obj));
  }
});

export const envBoolean = createMockFunction<
  (key: string, defaultValue?: boolean) => boolean
>(() => true);

export const envsKey = createMockFunction<
  (key: string, defaultValue?: string) => string | undefined
>((key, defaultValue) => {
  try {
    // Try original implementation first
    return process.env[key] || defaultValue;
  } catch (error) {
    return `_MOCK_ENVS_KEY_[${TAG}][${key}]`;
  }
});

export const errorFromStatusCode = createMockFunction<
  (statusCode: number, message?: string) => Error
>((statusCode, message = `Mock error for status code ${statusCode}`) => {
  try {
    // Try to mimic original implementation
    switch (statusCode) {
      case 400:
        return new BadRequestError(message);
      case 401:
        return new UnauthorizedError(message);
      case 403:
        return new ForbiddenError(message);
      case 404:
        return new MockNotFoundError(message);
      case 405:
        return new MethodNotAllowedError(message);
      case 410:
        return new GoneError(message);
      case 418:
        return new TeapotError(message);
      case 500:
        return new InternalError(message);
      case 501:
        return new NotImplementedError(message);
      case 502:
        return new BadGatewayError(message);
      case 503:
        return new UnavailableError(message);
      case 504:
        return new GatewayTimeoutError(message);
      default:
        return new Error(message);
    }
  } catch (error) {
    return new Error(`_MOCK_ERROR_FROM_STATUS_CODE_[${TAG}][${statusCode}]`);
  }
});

export const formatError = createMockFunction<(error: any) => any>((error) => {
  try {
    // Try to use original implementation first
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    return error;
  } catch (e) {
    return `_MOCK_FORMAT_ERROR_[${TAG}]`;
  }
});

export const getHeaderFrom = createMockFunction<
  (
    headers: Record<string, string | string[] | undefined>,
    key: string,
  ) => string | undefined
>((headers, key) => {
  try {
    // Try original implementation first
    if (!headers || !key) return undefined;
    const lowerKey = key.toLowerCase();
    for (const [headerKey, value] of Object.entries(headers)) {
      if (headerKey.toLowerCase() === lowerKey) {
        return Array.isArray(value) ? value[0] : value;
      }
    }
    return undefined;
  } catch (error) {
    return `_MOCK_HEADER_FROM_[${TAG}][${key}]`;
  }
});

export const getObjectKeyCaseInsensitive = createMockFunction<
  (obj: Record<string, any>, key: string) => any
>((obj, key) => {
  try {
    // Try original implementation first
    if (!obj || !key) return undefined;
    const lowerKey = key.toLowerCase();
    for (const [objKey, value] of Object.entries(obj)) {
      if (objKey.toLowerCase() === lowerKey) {
        return value;
      }
    }
    return undefined;
  } catch (error) {
    return `_MOCK_OBJECT_KEY_[${TAG}][${key}]`;
  }
});

export const isClass = createMockFunction<(input: any) => boolean>((input) => {
  try {
    // Try original implementation first
    return typeof input === "function" && /^\s*class\s+/.test(input.toString());
  } catch (error) {
    return false;
  }
});

export const isJaypieError = createMockFunction<(input: any) => boolean>(
  (input) => {
    try {
      // Try original implementation first
      return input instanceof JaypieError;
    } catch (error) {
      return false;
    }
  },
);

// Optional/Required validation functions
export const optional = {
  array: createMockFunction<(input: any) => any[]>((input) =>
    Array.isArray(input) ? input : [],
  ),
  boolean: createMockFunction<(input: any) => boolean>((input) =>
    Boolean(input),
  ),
  number: createMockFunction<(input: any) => number>(
    (input) => Number(input) || 0,
  ),
  object: createMockFunction<(input: any) => object>((input) =>
    typeof input === "object" && input !== null ? input : {},
  ),
  string: createMockFunction<(input: any) => string>((input) =>
    String(input || ""),
  ),
};

export const required = {
  array: createMockFunction<(input: any, name?: string) => any[]>(
    (input, name = "array") => {
      if (!Array.isArray(input))
        throw new MockValidationError(`${name} must be an array`);
      return input;
    },
  ),
  boolean: createMockFunction<(input: any, name?: string) => boolean>(
    (input, name = "boolean") => {
      if (typeof input !== "boolean")
        throw new MockValidationError(`${name} must be a boolean`);
      return input;
    },
  ),
  number: createMockFunction<(input: any, name?: string) => number>(
    (input, name = "number") => {
      if (typeof input !== "number" || isNaN(input))
        throw new MockValidationError(`${name} must be a number`);
      return input;
    },
  ),
  object: createMockFunction<(input: any, name?: string) => object>(
    (input, name = "object") => {
      if (typeof input !== "object" || input === null)
        throw new MockValidationError(`${name} must be an object`);
      return input;
    },
  ),
  string: createMockFunction<(input: any, name?: string) => string>(
    (input, name = "string") => {
      if (typeof input !== "string")
        throw new MockValidationError(`${name} must be a string`);
      return input;
    },
  ),
};

export const safeParseFloat = createMockFunction<
  (input: string | number) => number
>((input) => {
  try {
    // Try original implementation first
    if (typeof input === "number") return input;
    const parsed = parseFloat(input);
    return isNaN(parsed) ? 0 : parsed;
  } catch (error) {
    return 0;
  }
});

export const placeholders = createMockFunction<
  (template: string, values: Record<string, any>) => string
>((template, values) => {
  try {
    // Try original implementation first
    return template.replace(/\{([^}]+)\}/g, (_, key) => {
      return values[key] !== undefined ? String(values[key]) : `{${key}}`;
    });
  } catch (error) {
    return `_MOCK_PLACEHOLDERS_[${TAG}]`;
  }
});

// Add force utilities to help with jaypieHandler implementation
export const force = {
  array: (value: any): any[] => {
    if (Array.isArray(value)) return value;
    return [];
  },
  boolean: (value: any): boolean => {
    return Boolean(value);
  },
  object: (value: any): object => {
    if (typeof value === "object" && value !== null) return value;
    return {};
  },
};

export const jaypieHandler = createMockFunction<
  (
    handler: Function,
    options?: {
      setup?: Function | Function[];
      teardown?: Function | Function[];
      unavailable?: boolean;
      validate?: Function | Function[];
    },
  ) => Function
>((handler, options = {}) => {
  return async (...args: any[]) => {
    let result;
    let thrownError;

    // Destructure options with defaults
    const {
      setup = [],
      teardown = [],
      unavailable = force.boolean(process.env.PROJECT_UNAVAILABLE),
      validate = [],
    } = options;

    // Check if service is unavailable
    if (unavailable) throw new UnavailableError("Service unavailable");

    // Run validation functions
    const validateFunctions = force.array(validate);
    for (const validator of validateFunctions) {
      if (typeof validator === "function") {
        const valid = await validator(...args);
        if (valid === false) {
          throw new BadRequestError("Validation failed");
        }
      }
    }

    try {
      // Run setup functions
      const setupFunctions = force.array(setup);
      for (const setupFunction of setupFunctions) {
        if (typeof setupFunction === "function") {
          await setupFunction(...args);
        }
      }

      // Execute the handler
      result = await handler(...args);
    } catch (error) {
      thrownError = error;
    }

    // Run teardown functions (always run even if there was an error)
    const teardownFunctions = force.array(teardown);
    for (const teardownFunction of teardownFunctions) {
      if (typeof teardownFunction === "function") {
        try {
          await teardownFunction(...args);
        } catch (error) {
          // Swallow teardown errors, but log them
          console.error(error);
        }
      }
    }

    // If there was an error in the handler, throw it after teardown
    if (thrownError) {
      throw thrownError;
    }

    return result;
  };
});

export const sleep = createMockFunction<(ms: number) => Promise<boolean>>(
  async () => true,
);

export const uuid = createMockFunction<() => string>(() => {
  try {
    // Try to use a real UUID implementation if available
    const digits = "0123456789abcdef";
    let uuid = "";
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        uuid += "-";
      } else if (i === 14) {
        uuid += "4";
      } else if (i === 19) {
        uuid += digits[(Math.random() * 4) | 8];
      } else {
        uuid += digits[(Math.random() * 16) | 0];
      }
    }
    return uuid;
  } catch (error) {
    return `_MOCK_UUID_[${TAG}]`;
  }
});
