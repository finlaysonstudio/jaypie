import { vi } from "vitest";
import { createMockFunction } from "./utils";

// Mock core errors
export class MockValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class MockNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

// Mock core functions
export const validate = createMockFunction<(data: any, schema: any) => boolean>(
  () => true,
);

export const getConfig = createMockFunction<() => Record<string, string>>(
  () => ({ environment: "test" }),
);

export const logger = {
  debug: createMockFunction<(message: string, meta?: any) => void>(),
  info: createMockFunction<(message: string, meta?: any) => void>(),
  warn: createMockFunction<(message: string, meta?: any) => void>(),
  error: createMockFunction<(message: string, meta?: any) => void>(),
};
