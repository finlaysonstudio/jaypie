import { expect } from "vitest";
import * as matchers from "jest-extended";

// Add jest-extended matchers to Vitest's expect
expect.extend(matchers);

// Add any custom matchers here if needed
expect.extend({
  toThrowJaypieError(received) {
    const { isProjectError } = received;
    return {
      pass: isProjectError === true,
      message: () => `expected ${received} to be a Jaypie error`,
    };
  },
});
