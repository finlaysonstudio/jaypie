/// <reference types="vitest" />

// This file ships to dist/types and is referenced from dist/index.d.ts, so
// `import "@jaypie/testkit"` is enough to bring the matchers into scope.

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

declare module "vitest" {
  // Vitest 3+ augmentation point. `Assertion` and `ExpectStatic` both extend
  // `Matchers`, so this covers `expect(x).toBe*`, `expect(x).not.toBe*`, and
  // the asymmetric `expect.toBe*`. Declaring no members is the point: the
  // augmentation only widens vitest's interface.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Matchers<T = any> extends JaypieMatchers<T> {}

  // `expect.not.toBe*` resolves through AsymmetricMatchersContaining, which
  // does not extend Matchers.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends JaypieMatchers<any> {}

  // Vitest 1 and 2 predate `Matchers`
  interface Assertion<T = unknown> extends JaypieMatchers<T> {
    not: Assertion<T>;
  }
}

// Export an empty object to make TypeScript treat this as a module
export {};
