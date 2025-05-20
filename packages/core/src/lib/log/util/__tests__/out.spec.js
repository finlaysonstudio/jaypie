import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { LEVEL } from "../constants.js";
import out from "../out.js";

//
//
// Mock constants
//

//

//
//
// Mock modules
//

beforeAll(() => {
  vi.spyOn(console, "debug");
  vi.spyOn(console, "info");
  vi.spyOn(console, "warn");
  vi.spyOn(console, "error");
});

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

describe("Logger", () => {
  describe("out function", () => {
    it("Works", () => {
      expect(out).toBeFunction();
      out("Hi.");
    });
    it("Logs debug by default to console.debug", () => {
      out("Hi.");
      expect(console.debug).toBeCalled();
      expect(console.debug).toBeCalledTimes(1);
      expect(console.info).not.toBeCalled();
      expect(console.warn).not.toBeCalled();
      expect(console.error).not.toBeCalled();
    });
  });
  describe("Log levels", () => {
    it("Calls console.debug for trace", () => {
      out("Hi.", { level: LEVEL.TRACE });
      expect(console.debug).toBeCalled();
      expect(console.debug).toBeCalledTimes(1);
      expect(console.info).not.toBeCalled();
      expect(console.warn).not.toBeCalled();
      expect(console.error).not.toBeCalled();
    });
    it("Calls console.debug for debug", () => {
      out("Hi.", { level: LEVEL.DEBUG });
      expect(console.debug).toBeCalled();
      expect(console.debug).toBeCalledTimes(1);
      expect(console.info).not.toBeCalled();
      expect(console.warn).not.toBeCalled();
      expect(console.error).not.toBeCalled();
    });
    it("Calls console.info for info", () => {
      out("Hi.", { level: LEVEL.INFO });
      expect(console.info).toBeCalled();
      expect(console.info).toBeCalledTimes(1);
      expect(console.debug).not.toBeCalled();
      expect(console.warn).not.toBeCalled();
      expect(console.error).not.toBeCalled();
    });
    it("Calls console.warn for warn", () => {
      out("Hi.", { level: LEVEL.WARN });
      expect(console.warn).toBeCalled();
      expect(console.warn).toBeCalledTimes(1);
      expect(console.debug).not.toBeCalled();
      expect(console.info).not.toBeCalled();
      expect(console.error).not.toBeCalled();
    });
    it("Calls console.error for error", () => {
      out("Hi.", { level: LEVEL.ERROR });
      expect(console.error).toBeCalled();
      expect(console.error).toBeCalledTimes(1);
      expect(console.debug).not.toBeCalled();
      expect(console.info).not.toBeCalled();
      expect(console.warn).not.toBeCalled();
    });
    it("Calls console.error for fatal", () => {
      out("Hi.", { level: LEVEL.FATAL });
      expect(console.error).toBeCalled();
      expect(console.error).toBeCalledTimes(1);
      expect(console.debug).not.toBeCalled();
      expect(console.info).not.toBeCalled();
      expect(console.warn).not.toBeCalled();
    });
    it("Calls console.log for unknown levels", () => {
      // Spy on console.log
      vi.spyOn(console, "log");
      out("Hi.", { level: "taco" });
      expect(console.error).not.toBeCalled();
      expect(console.debug).not.toBeCalled();
      expect(console.info).not.toBeCalled();
      expect(console.warn).not.toBeCalled();
      expect(console.log).toBeCalled();
      expect(console.log).toBeCalledTimes(1);
      // Restore console.log
      console.log.mockRestore();
    });
  });
});
