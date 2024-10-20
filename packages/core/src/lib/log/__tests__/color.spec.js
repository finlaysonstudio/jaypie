import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Logger from "../Logger.js";
import { COLOR, FORMAT, LEVEL } from "../util/constants.js";

import mockLog from "../util/log.js";

//
//
// Mock modules
//

vi.mock("../util/log");

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
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Color", () => {
  it("Colors trace level", () => {
    const log = new Logger({ level: LEVEL.TRACE });
    log.trace("Trace message");
    expect(mockLog).toBeCalledWith(["Trace message"], COLOR.TRACE);
  });
  it("Colors debug level", () => {
    const log = new Logger();
    log.debug("Debug message");
    expect(mockLog).toBeCalledWith(["Debug message"], COLOR.DEBUG);
  });
  it("Colors info level", () => {
    const log = new Logger();
    log.info("Info message");
    expect(mockLog).toBeCalledWith(["Info message"], COLOR.INFO);
  });
  it("Colors warn level", () => {
    const log = new Logger();
    log.warn("Warn message");
    expect(mockLog).toBeCalledWith(["Warn message"], COLOR.WARN);
  });
  it("Colors error level", () => {
    const log = new Logger();
    log.error("Error message");
    expect(mockLog).toBeCalledWith(["Error message"], COLOR.ERROR);
  });
  it("Colors fatal level", () => {
    const log = new Logger();
    log.fatal("Fatal message");
    expect(mockLog).toBeCalledWith(["Fatal message"], COLOR.FATAL);
  });

  it("Doesn't use color when format is 'text'", () => {
    const log = new Logger({ format: FORMAT.TEXT });
    log.info("Info message");
    expect(mockLog).toBeCalledWith(["Info message"], COLOR.PLAIN);
  });
});
