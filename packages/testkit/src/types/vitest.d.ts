/// <reference types="vitest" />
/// <reference types="jest-extended" />

import { JaypieMatchers } from "./matchers.js";

declare global {
  namespace Vi {
    interface Assertion<T = unknown> extends JaypieMatchers<T> {
      not: Assertion<T>;
    }
    interface AsymmetricMatchersContaining extends JaypieMatchers {
      not: AsymmetricMatchersContaining;
    }
  }
}

// This is needed for module augmentation to work properly
declare module "vitest" {
  interface Assertion<T = unknown> extends JaypieMatchers<T> {
    not: Assertion<T>;
  }
  interface AsymmetricMatchersContaining extends JaypieMatchers {
    not: AsymmetricMatchersContaining;
  }
}

// Export an empty object to make TypeScript treat this as a module
export {};
