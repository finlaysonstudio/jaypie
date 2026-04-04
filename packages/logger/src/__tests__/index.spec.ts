import { afterEach, describe, expect, it, vi } from "vitest";

import { getDatadogTransport, log, Logger, createLogger } from "../index";

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

    it("exports getDatadogTransport function", () => {
      expect(typeof getDatadogTransport).toBe("function");
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
          '{"message":"Handling Discord interaction {\\"type\\":1}"}',
        );
      });
    });

    describe("LOG_LEVEL_FIELD", () => {
      afterEach(() => {
        vi.restoreAllMocks();
        delete process.env.LOG_LEVEL_FIELD;
      });

      it("does not include level field by default", () => {
        const logger = new Logger({ format: "json", level: "debug" });
        const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
        logger.debug("test");
        const output = JSON.parse(spy.mock.calls[0][0] as string);
        expect(output.level).toBeUndefined();
        expect(output.status).toBeUndefined();
      });

      it("adds 'level' key when levelField is true", () => {
        const logger = new Logger({
          format: "json",
          level: "debug",
          levelField: true,
        });
        const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
        logger.debug("test");
        const output = JSON.parse(spy.mock.calls[0][0] as string);
        expect(output.level).toBe("debug");
      });

      it("adds custom key when levelField is a string", () => {
        const logger = new Logger({
          format: "json",
          level: "debug",
          levelField: "status",
        });
        const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
        logger.debug("test");
        const output = JSON.parse(spy.mock.calls[0][0] as string);
        expect(output.status).toBe("debug");
        expect(output.level).toBeUndefined();
      });

      it("does not add level field when levelField is false", () => {
        const logger = new Logger({
          format: "json",
          level: "debug",
          levelField: false,
        });
        const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
        logger.debug("test");
        const output = JSON.parse(spy.mock.calls[0][0] as string);
        expect(output.level).toBeUndefined();
      });

      it("reads LOG_LEVEL_FIELD=true from env", () => {
        process.env.LOG_LEVEL_FIELD = "true";
        const logger = new Logger({ format: "json", level: "debug" });
        const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
        logger.debug("test");
        const output = JSON.parse(spy.mock.calls[0][0] as string);
        expect(output.level).toBe("debug");
      });

      it("reads LOG_LEVEL_FIELD=status from env", () => {
        process.env.LOG_LEVEL_FIELD = "status";
        const logger = new Logger({ format: "json", level: "debug" });
        const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
        logger.debug("test");
        const output = JSON.parse(spy.mock.calls[0][0] as string);
        expect(output.status).toBe("debug");
      });

      it("reads LOG_LEVEL_FIELD=false from env as disabled", () => {
        process.env.LOG_LEVEL_FIELD = "false";
        const logger = new Logger({ format: "json", level: "debug" });
        const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
        logger.debug("test");
        const output = JSON.parse(spy.mock.calls[0][0] as string);
        expect(output.level).toBeUndefined();
      });

      it("includes level field in .var() output", () => {
        const logger = new Logger({
          format: "json",
          level: "debug",
          levelField: "status",
        });
        const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
        logger.debug.var({ count: 42 });
        const output = JSON.parse(spy.mock.calls[0][0] as string);
        expect(output.status).toBe("debug");
        expect(output.var).toBe("count");
      });

      it("reflects correct level per method", () => {
        const logger = new Logger({
          format: "json",
          level: "trace",
          levelField: true,
        });
        const debugSpy = vi
          .spyOn(console, "debug")
          .mockImplementation(() => {});
        const infoSpy = vi
          .spyOn(console, "info")
          .mockImplementation(() => {});
        const warnSpy = vi
          .spyOn(console, "warn")
          .mockImplementation(() => {});
        const errorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        logger.trace("t");
        logger.debug("d");
        logger.info("i");
        logger.warn("w");
        logger.error("e");

        expect(JSON.parse(debugSpy.mock.calls[0][0] as string).level).toBe(
          "trace",
        );
        expect(JSON.parse(debugSpy.mock.calls[1][0] as string).level).toBe(
          "debug",
        );
        expect(JSON.parse(infoSpy.mock.calls[0][0] as string).level).toBe(
          "info",
        );
        expect(JSON.parse(warnSpy.mock.calls[0][0] as string).level).toBe(
          "warn",
        );
        expect(JSON.parse(errorSpy.mock.calls[0][0] as string).level).toBe(
          "error",
        );
      });
    });
  });
});
