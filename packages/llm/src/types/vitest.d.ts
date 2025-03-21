import "vitest";
import "jest-extended";

interface CustomMatchers<R = unknown> {
  toBeArray(): R;
  toBeFunction(): R;
  toBeClass(): R;
  toBeObject(): R;
  toContainEqual(expected: unknown): R;
  toHaveLength(expected: number): R;
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
