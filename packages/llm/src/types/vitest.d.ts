import "vitest";

interface CustomMatchers<R = unknown> {
  toBeArray(): R;
  toBeArrayOfSize(size: number): R;
  toBeBoolean(): R;
  toBeClass(): R;
  toBeEmpty(): R;
  toBeFalse(): R;
  toBeFunction(): R;
  toBeNumber(): R;
  toBeObject(): R;
  toBeString(): R;
  toBeTrue(): R;
  toContainAllKeys(keys: string[]): R;
  toContainEqual(expected: unknown): R;
  toContainKeys(keys: string[]): R;
  toEndWith(suffix: string): R;
  toHaveLength(expected: number): R;
  toInclude(substring: unknown): R;
  toStartWith(prefix: string): R;
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
