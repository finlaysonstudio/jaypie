import { LogMock, MatcherResult } from "../types/jaypie-testkit";

//
//
// Main
//

const calledAboveTrace = (log: LogMock): MatcherResult => {
  try {
    if (
      log.debug.mock.calls.length > 0 ||
      log.info.mock.calls.length > 0 ||
      log.warn.mock.calls.length > 0 ||
      log.error.mock.calls.length > 0 ||
      log.fatal.mock.calls.length > 0
    ) {
      return {
        message: () => `expected log not to have been called above trace`,
        pass: true,
      };
    }
  } catch {
    throw Error(`[calledAboveTrace] log is not a mock object`);
  }

  return {
    message: () => `expected log not to have been called above trace`,
    pass: false,
  };
};

//
//
// Export
//

export default calledAboveTrace;
