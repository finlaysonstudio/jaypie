import "vitest";

interface CustomMatchers<R = unknown> {
  toBeFunction(): R;
  toBeClass(): R;
  toBeObject(): R;
  toThrowConfigurationError(): R;
}

declare module "vitest" {
  interface Assertion<T = unknown> extends CustomMatchers<T> {
    toBe(expected: T): void;
  }
  interface AsymmetricMatchersContaining extends CustomMatchers {
    toBe(expected: unknown): unknown;
  }
}
