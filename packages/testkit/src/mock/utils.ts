/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";

/**
 * Internal wrapper for vi.fn() that adds _jaypie: true to all mocks
 */
function _createJaypieMock<T extends (...args: any[]) => any>(
  implementation?: T,
): ReturnType<typeof vi.fn> {
  const mock = vi.fn(implementation);
  Object.defineProperty(mock, "_jaypie", { value: true });
  return mock;
}

/**
 * Creates function mocks with proper typing
 * Internal utility to create properly typed mocks
 */
function createMockFunction<T extends (...args: any[]) => any>(
  implementation?: (...args: Parameters<T>) => ReturnType<T>,
): T & { mock: any } {
  // Use a more specific type conversion to avoid TypeScript error
  return _createJaypieMock(implementation) as unknown as T & { mock: any };
}

/**
 * Creates a mock function that resolves to a value when awaited
 * Internal utility to create async mock functions
 */
function createMockResolvedFunction<T>(
  value: T,
): (...args: unknown[]) => Promise<T> {
  return _createJaypieMock().mockResolvedValue(value);
}

/**
 * Creates a mock function that returns a value
 * Internal utility to create mock functions that return a value
 */
function createMockReturnedFunction<T>(value: T): (...args: unknown[]) => T {
  return _createJaypieMock().mockReturnValue(value);
}

/**
 * Creates a mock function that wraps another function
 * Internal utility to create mock functions that wrap another function
 */
function createMockWrappedFunction<T>(
  fn: (...args: unknown[]) => unknown,
  fallbackOrOptions:
    | any
    | {
        fallback?: any;
        throws?: boolean;
        class?: boolean;
      } = "_MOCK_WRAPPED_RESULT",
): (...args: unknown[]) => T {
  // Determine if we have a direct fallback or options object
  const options =
    typeof fallbackOrOptions === "object" &&
    fallbackOrOptions !== null &&
    ("fallback" in fallbackOrOptions ||
      "throws" in fallbackOrOptions ||
      "class" in fallbackOrOptions)
      ? fallbackOrOptions
      : { fallback: fallbackOrOptions };

  // Extract values with defaults
  const fallback = options.fallback ?? "_MOCK_WRAPPED_RESULT";
  const throws = options.throws ?? false;
  const isClass = options.class ?? false;

  return _createJaypieMock().mockImplementation((...args: unknown[]) => {
    try {
      return isClass ? new (fn as any)(...args) : fn(...args);
    } catch (error) {
      if (throws) {
        throw error;
      }

      /* eslint-disable no-console */
      console.warn(
        `[@jaypie/testkit] Actual implementation failed. To suppress this warning, manually mock the response with mockReturnValue`,
      );
      if (error instanceof Error) {
        console.warn(`[@jaypie/testkit] ${error.message}`);
      }
      /* eslint-enable no-console */

      // If fallback is a function, call it
      if (typeof fallback === "function") {
        try {
          return fallback(...args);
        } catch (fallbackError) {
          console.warn(
            `[@jaypie/testkit] Fallback function failed: ${fallbackError instanceof Error ? fallbackError.message : fallbackError}`,
          );
          return "_MOCK_WRAPPED_RESULT";
        }
      }

      return fallback;
    }
  });
}

function createMockWrappedObject<T extends Record<string, any>>(
  object: T,
  fallbackOrOptions:
    | any
    | {
        fallback?: any;
        throws?: boolean;
        class?: boolean;
      } = "_MOCK_WRAPPED_RESULT",
): T {
  let returnMock: Record<string, any> = {};

  // Extract values with defaults for the top-level call
  const options =
    typeof fallbackOrOptions === "object" &&
    fallbackOrOptions !== null &&
    ("fallback" in fallbackOrOptions ||
      "throws" in fallbackOrOptions ||
      "class" in fallbackOrOptions)
      ? fallbackOrOptions
      : { fallback: fallbackOrOptions };

  const fallback = options.fallback ?? "_MOCK_WRAPPED_RESULT";
  const throws = options.throws ?? false;
  const isClass = options.class ?? false;

  // Create options for recursive calls
  // Do not pass down class=true to nested objects
  const recursiveOptions = {
    fallback,
    throws,
    class: false, // Always pass class=false to nested objects
  };

  if (typeof object === "function") {
    returnMock = createMockWrappedFunction(object, {
      fallback,
      throws,
      class: isClass,
    });
  }
  for (const key of Object.keys(object)) {
    const value = object[key];
    if (typeof value === "function") {
      returnMock[key] = createMockWrappedFunction(value, {
        fallback,
        throws,
        class: isClass,
      });
    } else if (typeof value === "object" && value !== null) {
      returnMock[key] = createMockWrappedObject(value, recursiveOptions);
    } else {
      returnMock[key] = value;
    }
  }
  return returnMock as T;
}

/**
 * Utility to create a mock error constructor from an error class
 */
function createMockError<T extends new (...args: any[]) => Error>(
  ErrorClass: T,
): T {
  // Create a mock constructor that returns a new instance of ErrorClass
  const mockConstructor = _createJaypieMock(function (
    this: any,
    ...args: any[]
  ) {
    return new ErrorClass(...args);
  });
  return mockConstructor as unknown as T;
}

// Mock core errors - All error classes extend JaypieError
class MockValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

class MockNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

// Export functions for internal use
export {
  createMockFunction,
  createMockResolvedFunction,
  createMockReturnedFunction,
  createMockWrappedFunction,
  createMockWrappedObject,
  MockValidationError,
  MockNotFoundError,
  createMockError,
};
