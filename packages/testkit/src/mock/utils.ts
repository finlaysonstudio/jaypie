import { vi } from "vitest";

/**
 * Creates function mocks with proper typing
 */
export function createMockFunction<T extends (...args: any[]) => any>(
  implementation?: (...args: Parameters<T>) => ReturnType<T>,
): T & { mock: any } {
  return vi.fn(implementation) as T & { mock: any };
}

/**
 * Creates dynamic mocks based on original implementations
 */
export function createAutoMocks<T extends Record<string, unknown>>(
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
 */
export function createDeepMock<T extends object>(
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
