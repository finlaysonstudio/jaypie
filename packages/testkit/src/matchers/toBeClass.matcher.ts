import { MatcherResult } from "../types/jaypie-testkit";

//
//
// Main
//

const toBeClass = (received: unknown): MatcherResult => {
  let pass = false;
  if (typeof received === "function") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new (received as any)();
      pass = true;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      pass = false;
    }
  }
  if (pass) {
    return {
      message: () => `expected ${received} not to be a class`,
      pass: true,
    };
  }
  return {
    message: () => `expected ${received} to be a class`,
    pass: false,
  };
};

//
//
// Export
//

export default toBeClass;
