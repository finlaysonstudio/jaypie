//
//
// Main
//

const calledAboveTrace = (log) => {
  // TODO: what if log is not an object?

  try {
    if (
      log.debug.mock.calls.length > 0
      || log.info.mock.calls.length > 0
      || log.warn.mock.calls.length > 0
      || log.error.mock.calls.length > 0
      || log.fatal.mock.calls.length > 0
    ) {
      return {
        message: () => `expected log not to have been called above trace`,
        pass: true,
      };
    }
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
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
