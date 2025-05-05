/* eslint-disable @typescript-eslint/no-explicit-any */
import { log } from "@jaypie/core";
import { vi } from "vitest";
import { LogMock } from "./types/jaypie-testkit";

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

// Use Record type for more flexible access pattern
const originalLogMethods = new WeakMap<typeof log, Record<string, unknown>>();

export function spyLog(logInstance: typeof log): void {
  if (!originalLogMethods.has(logInstance)) {
    const mockLog = mockLogFactory();
    const originalMethods: Record<string, unknown> = {};

    // Save only methods that actually exist on the log instance
    LOG_METHOD_NAMES.forEach((method) => {
      if (method in logInstance) {
        originalMethods[method] = logInstance[method as keyof typeof logInstance];
        // Use type assertion after checking existence
        (logInstance as Record<string, unknown>)[method] = mockLog[method];
      }
    });

    originalLogMethods.set(logInstance, originalMethods);
  }
}

export function restoreLog(logInstance: typeof log): void {
  const originalMethods = originalLogMethods.get(logInstance);
  if (originalMethods) {
    LOG_METHOD_NAMES.forEach((method) => {
      if (method in originalMethods && method in logInstance) {
        // Use type assertion after checking existence
        (logInstance as Record<string, unknown>)[method] = originalMethods[method];
      }
    });
    originalLogMethods.delete(logInstance);
  }
}
