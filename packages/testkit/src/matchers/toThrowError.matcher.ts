import { MatcherResult } from "../types/jaypie-testkit";

//
//
// Main
//

type ReceivedFunction = () => unknown | Promise<unknown>;

const toThrowError = async (
  received: ReceivedFunction,
): Promise<MatcherResult> => {
  const isAsync =
    received.constructor.name === "AsyncFunction" ||
    received.constructor.name === "Promise";

  try {
    const result = received();

    if (isAsync) {
      await result;
    }

    return {
      pass: false,
      message: () =>
        "Expected function to throw an error, but it did not throw.",
    };
  } catch (error) {
    return {
      pass: true,
      message: () =>
        `Expected function not to throw an error, but it threw ${error}`,
    };
  }
};

//
//
// Export
//

export default toThrowError;
