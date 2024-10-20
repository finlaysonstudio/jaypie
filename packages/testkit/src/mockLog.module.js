import { vi } from "vitest";

export function mockLogFactory() {
  // Create skeleton of mock objects, as much as possible
  const mock = {
    debug: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    info: vi.fn(),
    init: vi.fn(),
    lib: vi.fn(),
    tag: vi.fn(),
    trace: vi.fn(),
    untag: vi.fn(),
    var: vi.fn(),
    warn: vi.fn(),
    with: vi.fn(),
  };
  // Fill out nested mocks
  mock.debug.var = mock.var;
  mock.error.var = mock.var;
  mock.fatal.var = mock.var;
  mock.info.var = mock.var;
  mock.trace.var = mock.var;
  mock.warn.var = mock.var;
  // Have modules return correct objects
  mock.init.mockReturnValue(null);
  mock.lib.mockReturnValue(mock);
  mock.with.mockReturnValue(mock);

  // Create something in the shape of the module
  const module = {
    debug: mock.debug,
    error: mock.error,
    fatal: mock.fatal,
    info: mock.info,
    init: mock.init,
    lib: mock.lib,
    tag: mock.tag,
    trace: mock.trace,
    untag: mock.untag,
    var: mock.var,
    warn: mock.warn,
    with: mock.with,
  };

  // Pin mocks to the module
  module.mock = mock;

  // return the module
  return module;
}

// export default mockLogFactory();

const logMethodNames = [
  "debug",
  "error",
  "fatal",
  "info",
  "init",
  "lib",
  "tag",
  "trace",
  "untag",
  "var",
  "warn",
  "with",
];
const originalLogMethods = new WeakMap();

export function spyLog(log) {
  if (!originalLogMethods.has(log)) {
    const mockLog = mockLogFactory();
    const originalMethods = {};
    logMethodNames.forEach((method) => {
      originalMethods[method] = log[method];
      log[method] = mockLog[method];
    });
    // Add custom properties
    originalMethods.mock = log.mock;
    log.mock = mockLog.mock;

    originalLogMethods.set(log, originalMethods);
  }
}

export function restoreLog(log) {
  const originalMethods = originalLogMethods.get(log);
  if (originalMethods) {
    logMethodNames.forEach((method) => {
      log[method] = originalMethods[method];
    });
    // Restore custom properties
    log.mock = originalMethods.mock;

    originalLogMethods.delete(log);
  }
}
