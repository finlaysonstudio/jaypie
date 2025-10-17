import { describe, expect, it } from "vitest";

import { log, Logger, createLogger } from "../index";

describe("@jaypie/logger", () => {
  describe("Base Cases", () => {
    it("exports log", () => {
      expect(log).toBeDefined();
    });

    it("exports Logger class", () => {
      expect(Logger).toBeDefined();
    });

    it("exports createLogger function", () => {
      expect(createLogger).toBeDefined();
    });

    it("log has debug method", () => {
      expect(log.debug).toBeDefined();
      expect(typeof log.debug).toBe("function");
    });

    it("log has error method", () => {
      expect(log.error).toBeDefined();
      expect(typeof log.error).toBe("function");
    });

    it("log has info method", () => {
      expect(log.info).toBeDefined();
      expect(typeof log.info).toBe("function");
    });

    it("log has warn method", () => {
      expect(log.warn).toBeDefined();
      expect(typeof log.warn).toBe("function");
    });

    it("log has tag method", () => {
      expect(log.tag).toBeDefined();
      expect(typeof log.tag).toBe("function");
    });

    it("log has var method", () => {
      expect(log.var).toBeDefined();
      expect(typeof log.var).toBe("function");
    });
  });

  describe("Happy Paths", () => {
    it("createLogger returns a logger instance", () => {
      const logger = createLogger();
      expect(logger).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    it("log methods can be called", () => {
      expect(() => log.debug("test")).not.toThrow();
      expect(() => log.info("test")).not.toThrow();
      expect(() => log.warn("test")).not.toThrow();
      expect(() => log.error("test")).not.toThrow();
    });
  });
});
