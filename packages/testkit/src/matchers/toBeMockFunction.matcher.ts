import { vi } from "vitest";
import type { Assertion } from "vitest";

declare module "vitest" {
  interface Assertion<T = any> {
    toBeMockFunction(): T;
  }
}

export function toBeMockFunction(this: Assertion, received: unknown) {
  const { equals, utils } = this;
  const pass = typeof received === "function" && vi.isMockFunction(received);

  return {
    message: () =>
      `expected ${utils.printReceived(received)} ${
        pass ? "not " : ""
      }to be a mock function`,
    pass,
  };
}
