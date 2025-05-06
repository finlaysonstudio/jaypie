/* eslint-disable @typescript-eslint/no-unused-vars */
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
 * Creates dynamic mocks based on original implementations
 * Internal utility to create mocks from original implementation
 */
function createAutoMocks<T extends Record<string, unknown>>(
  original: T,
  mockPrefix = "_MOCK_",
): Record<string, unknown> {
  const mocks: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(original)) {
    if (typeof value === "function") {
      mocks[key] = vi.fn().mockImplementation((...args: unknown[]) => {
        try {
          return value(...args);
        } catch (error) {
          return `${mockPrefix}${key.toUpperCase()}_RESULT`;
        }
      });
    } else if (typeof value === "object" && value !== null) {
      mocks[key] = value;
    } else {
      mocks[key] = value;
    }
  }

  return mocks;
}

/**
 * Handles recursive mocking for nested objects
 * Internal utility to create mocks with nested structure
 */
function createDeepMock<T extends object>(
  template: T,
  implementation: Partial<T> = {},
): T {
  const result = { ...template } as T;

  for (const [key, value] of Object.entries(implementation)) {
    if (key in result) {
      (result as any)[key] = value;
    }
  }

  return result;
}

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
  createAutoMocks,
  createDeepMock,
  MockValidationError,
  MockNotFoundError,
};
