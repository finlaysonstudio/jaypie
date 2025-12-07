import { afterEach, describe, expect, it, vi } from "vitest";

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

  describe("Features", () => {
    describe("Multi-param logging", () => {
      afterEach(() => {
        vi.restoreAllMocks();
      });

      it("joins string and object params with space delimiter (text format)", () => {
        const logger = new Logger({ format: "text", level: "trace" });
        const debugSpy = vi
          .spyOn(console, "debug")
          .mockImplementation(() => {});

        logger.trace("Handling Discord interaction", { type: 1 });

        expect(debugSpy).toHaveBeenCalledWith(
          'Handling Discord interaction {"type":1}',
        );
      });

      it("joins multiple string params with space delimiter (text format)", () => {
        const logger = new Logger({ format: "text", level: "trace" });
        const debugSpy = vi
          .spyOn(console, "debug")
          .mockImplementation(() => {});

        logger.trace("Hello", "world", "test");

        expect(debugSpy).toHaveBeenCalledWith("Hello world test");
      });

      it("joins multiple objects with space delimiter (text format)", () => {
        const logger = new Logger({ format: "text", level: "trace" });
        const debugSpy = vi
          .spyOn(console, "debug")
          .mockImplementation(() => {});

        logger.trace({ a: 1 }, { b: 2 });

        expect(debugSpy).toHaveBeenCalledWith('{"a":1} {"b":2}');
      });

      it("joins mixed params with space delimiter (text format)", () => {
        const logger = new Logger({ format: "text", level: "trace" });
        const debugSpy = vi
          .spyOn(console, "debug")
          .mockImplementation(() => {});

        logger.trace("Start", { id: 123 }, "middle", { status: "ok" }, "end");

        expect(debugSpy).toHaveBeenCalledWith(
          'Start {"id":123} middle {"status":"ok"} end',
        );
      });

      it("joins string and object params in message field (json format)", () => {
        const logger = new Logger({ format: "json", level: "trace" });
        const debugSpy = vi
          .spyOn(console, "debug")
          .mockImplementation(() => {});

        logger.trace("Handling Discord interaction", { type: 1 });

        expect(debugSpy).toHaveBeenCalledWith(
          '{"log":"trace","message":"Handling Discord interaction {\\"type\\":1}"}',
        );
      });
    });
  });
});
