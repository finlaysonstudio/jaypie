import isEqual from "lodash.isequal";
import { MatcherResult } from "../types.js";

//
//
// Main
//

const toBeCalledWithInitialParams = (
  received: jest.Mock,
  ...passed: unknown[]
): MatcherResult => {
  let pass: boolean | undefined;

  if (!received || typeof received !== "function" || !received.mock) {
    return {
      message: () =>
        `Expectation \`toBeCalledWithInitialParams\` expected a mock function`,
      pass: false,
    };
  }

  received.mock.calls.forEach((call: unknown[]) => {
    if (call.length >= passed.length) {
      let matching = true;
      for (let i = 0; i < passed.length && matching; i += 1) {
        if (!isEqual(passed[i], call[i])) matching = false;
      }
      pass = pass || matching;
    }
  });

  if (pass === undefined) pass = false;

  if (pass) {
    return {
      message: () =>
        `Expectation \`toBeCalledWithInitialParams\` expected call beginning with [${passed},...]`,
      pass: true,
    };
  } else {
    return {
      message: () =>
        `Expectation \`not.toBeCalledWithInitialParams\` did not expect call beginning with [${passed},...]`,
      pass: false,
    };
  }
};

//
//
// Export
//

export default toBeCalledWithInitialParams; 