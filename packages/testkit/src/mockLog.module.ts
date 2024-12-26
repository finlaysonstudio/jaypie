import { Log } from "@jaypie/core";
import { vi } from "vitest";
import { LogMock } from "./types.js";

export function mockLogFactory(): LogMock {
  // Create skeleton of mock objects
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
  } as LogMock;

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

  // Pin mocks to the module
  mock.mock = {
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

  return mock;
}

const LOG_METHOD_NAMES = [
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
] as const;

const originalLogMethods = new WeakMap<Log, Partial<Log>>();

export function spyLog(log: Log): void {
  if (!originalLogMethods.has(log)) {
    const mockLog = mockLogFactory();
    const originalMethods: Partial<Log> = {};
    
    LOG_METHOD_NAMES.forEach((method) => {
      originalMethods[method] = log[method] as any;
      log[method] = mockLog[method] as any;
    });

    originalLogMethods.set(log, originalMethods);
  }
}

export function restoreLog(log: Log): void {
  const originalMethods = originalLogMethods.get(log);
  if (originalMethods) {
    LOG_METHOD_NAMES.forEach((method) => {
      if (originalMethods[method]) {
        log[method] = originalMethods[method] as any;
      }
    });
    originalLogMethods.delete(log);
  }
} 