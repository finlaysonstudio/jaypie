import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import log from "../index.js";

//
//
// Mock environment
//

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
});
afterEach(() => {
  process.env = DEFAULT_ENV;
  vi.resetModules();
});

//
//
// Run tests
//

describe("Index", () => {
  it("Is an instance", async () => {
    expect(log).toBeObject();
  });

  it("Includes the full class", async () => {
    expect(log.Logger).toBeClass();
  });

  it("Includes a log function", async () => {
    expect(log.log).toBeFunction();
  });

  it("Includes LOG_LEVEL", async () => {
    expect(log.LOG_LEVEL).toBeObject();
    expect(log.LOG_LEVEL.ALL).toBeString();
    expect(log.LOG_LEVEL.TRACE).toBeString();
    expect(log.LOG_LEVEL.DEBUG).toBeString();
    expect(log.LOG_LEVEL.INFO).toBeString();
    expect(log.LOG_LEVEL.WARN).toBeString();
    expect(log.LOG_LEVEL.ERROR).toBeString();
    expect(log.LOG_LEVEL.FATAL).toBeString();
    expect(log.LOG_LEVEL.SILENT).toBeString();
  });
});
