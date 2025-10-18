import { afterEach, describe, expect, it, vi } from "vitest";

import { log } from "@jaypie/core";

// Subject
import { mockLogFactory, restoreLog, spyLog } from "../mockLog.module";

//
//
// Mock environment
//

afterEach(() => {
  vi.clearAllMocks();
});

//
//
// Run tests
//

describe("Mock Log Function", () => {
  it("Exports functions", () => {
    expect(mockLogFactory).toBeFunction();
    expect(restoreLog).toBeFunction();
    expect(spyLog).toBeFunction();
  });
  it("Works", () => {
    spyLog(log);
    log.debug("Hello, world!");
    expect(log.debug).toHaveBeenCalledTimes(1);
    expect(log.debug).toHaveBeenCalledWith("Hello, world!");
    restoreLog(log);
  });
  describe("Features", () => {
    it("mockLogFactory produces a Jaypie logger", () => {
      const log = mockLogFactory();
      expect(log).toBeObject();
      expect(log.debug).toBeFunction();
      expect(log.error).toBeFunction();
      expect(log.fatal).toBeFunction();
      expect(log.info).toBeFunction();
      expect(log.tag).toBeFunction();
      expect(log.trace).toBeFunction();
      expect(log.untag).toBeFunction();
      expect(log.var).toBeFunction();
      expect(log.warn).toBeFunction();
      expect(log.with).toBeFunction();
    });
    it("spyLog swaps out log functions", () => {
      const log = mockLogFactory();
      const original = { ...log };
      spyLog(log);
      expect(log).toBeObject();
      expect(log.debug).toBeFunction();
      expect(log.error).toBeFunction();
      expect(log.fatal).toBeFunction();
      expect(log.info).toBeFunction();
      expect(log.tag).toBeFunction();
      expect(log.trace).toBeFunction();
      expect(log.untag).toBeFunction();
      expect(log.var).toBeFunction();
      expect(log.warn).toBeFunction();
      expect(log.with).toBeFunction();
      expect(log.debug).not.toEqual(original.debug);
      expect(log.error).not.toEqual(original.error);
      expect(log.fatal).not.toEqual(original.fatal);
      expect(log.info).not.toEqual(original.info);
      expect(log.tag).not.toEqual(original.tag);
      expect(log.trace).not.toEqual(original.trace);
      expect(log.untag).not.toEqual(original.untag);
      expect(log.var).not.toEqual(original.var);
      expect(log.warn).not.toEqual(original.warn);
      expect(log.with).not.toEqual(original.with);
    });
    it("restoreLog swaps back original log functions", () => {
      const log = mockLogFactory();
      const original = { ...log };
      spyLog(log);
      restoreLog(log);
      expect(log).toBeObject();
      expect(log.debug).toBeFunction();
      expect(log.error).toBeFunction();
      expect(log.fatal).toBeFunction();
      expect(log.info).toBeFunction();
      expect(log.tag).toBeFunction();
      expect(log.trace).toBeFunction();
      expect(log.untag).toBeFunction();
      expect(log.var).toBeFunction();
      expect(log.warn).toBeFunction();
      expect(log.with).toBeFunction();
      expect(log.debug).toEqual(original.debug);
      expect(log.error).toEqual(original.error);
      expect(log.fatal).toEqual(original.fatal);
      expect(log.info).toEqual(original.info);
      expect(log.tag).toEqual(original.tag);
      expect(log.trace).toEqual(original.trace);
      expect(log.untag).toEqual(original.untag);
      expect(log.var).toEqual(original.var);
      expect(log.warn).toEqual(original.warn);
      expect(log.with).toEqual(original.with);
    });
    it("Tracks calls made to lib instances", () => {
      spyLog(log);
      const subLog = (log.lib as any)("subLog");
      subLog.debug("Hello, world!");
      expect(log.lib).toHaveBeenCalledTimes(1);
      expect(log.debug).toHaveBeenCalledTimes(1);
      expect(log.debug).toHaveBeenCalledWith("Hello, world!");
      expect(subLog.debug).toHaveBeenCalledTimes(1);
      expect(subLog.debug).toHaveBeenCalledWith("Hello, world!");
      restoreLog(log);
    });
  });
});
