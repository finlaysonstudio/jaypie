/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";

/**
 * Creates function mocks with proper typing
 * Internal utility to create properly typed mocks
 */
function createMockFunction<T extends (...args: any[]) => any>(
  implementation?: (...args: Parameters<T>) => ReturnType<T>,
): T & { mock: any } {
  // Use a more specific type conversion to avoid TypeScript error
  return vi.fn(implementation) as unknown as T & { mock: any };
}

/**
 * Creates a mock function that resolves to a value when awaited
 * Internal utility to create async mock functions
 */
function createMockResolvedFunction<T>(
  value: T,
): (...args: unknown[]) => Promise<T> {
  return vi.fn().mockResolvedValue(value);
}

/**
 * Creates a mock function that returns a value
 * Internal utility to create mock functions that return a value
 */
function createMockReturnedFunction<T>(value: T): (...args: unknown[]) => T {
  return vi.fn().mockReturnValue(value);
}

/**
 * Creates a mock function that wraps another function
 * Internal utility to create mock functions that wrap another function
 */
function createMockWrappedFunction<T>(
  fn: (...args: unknown[]) => unknown,
  fallback: any = "_MOCK_WRAPPED_RESULT",
): (...args: unknown[]) => T {
  return vi.fn().mockImplementation((...args: unknown[]) => {
    try {
      return fn(...args);
    } catch (error) {
      /* eslint-disable no-console */
      console.warn(
        `[@jaypie/testkit] Actual implementation failed. To suppress this warning, manually mock the response with mockReturnValue`,
      );
      if (error instanceof Error) {
        console.warn(`[@jaypie/testkit] ${error.message}`);
      }
      /* eslint-enable no-console */
      return fallback;
    }
  });
}

/**
 * Utility to create a mock error constructor from an error class
 */
function createMockError<T extends new (...args: any[]) => Error>(
  ErrorClass: T,
): T {
  // Create a mock constructor that returns a new instance of ErrorClass
  const mockConstructor = vi.fn(function (this: any, ...args: any[]) {
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
  MockValidationError,
  MockNotFoundError,
  createMockError,
};
