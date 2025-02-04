import "vitest";

interface CustomMatchers<R = unknown> {
  toBeFunction(): R;
  toBeClass(): R;
  toBeObject(): R;
  toThrowConfigurationError(): R;
}

declare module "vitest" {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
