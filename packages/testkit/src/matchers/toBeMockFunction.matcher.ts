import { vi } from "vitest";
import { MatcherResult } from "../types/jaypie-testkit";

export function toBeMockFunction(received: unknown): MatcherResult {
  const pass = typeof received === "function" && vi.isMockFunction(received);

  return {
    message: () =>
      `expected ${received} ${pass ? "not " : ""}to be a mock function`,
    pass,
  };
}
