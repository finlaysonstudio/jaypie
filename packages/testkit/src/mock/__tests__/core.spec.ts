import { describe, it, expect, vi, afterEach } from "vitest";
import { validate, getConfig, log } from "../core";

afterEach(() => {
  vi.clearAllMocks();
});

describe("Core Mocks", () => {
  describe("validate", () => {
    it("should return true by default", () => {
      const result = validate({ name: "test" }, { type: "object" });
      expect(result).toBe(true);
    });

    it("should track calls", () => {
      const data = { name: "test" };
      const schema = { type: "object" };

      validate(data, schema);

      expect(validate.mock.calls.length).toBe(1);
      expect(validate.mock.calls[0][0]).toBe(data);
      expect(validate.mock.calls[0][1]).toBe(schema);
    });
  });

  describe("getConfig", () => {
    it("should return default test environment", () => {
      const config = getConfig();
      expect(config).toEqual({ environment: "test" });
    });

    it("should track calls", () => {
      getConfig();
      expect(getConfig.mock.calls.length).toBe(1);
    });
  });

  describe("logger", () => {
    it("should have mock methods for logging", () => {
      expect(typeof log.debug).toBe("function");
      expect(typeof log.info).toBe("function");
      expect(typeof log.warn).toBe("function");
      expect(typeof log.error).toBe("function");
    });

    it("should track debug calls", () => {
      log.debug("Debug message", { extra: "data" });

      expect(log.debug.mock.calls.length).toBe(1);
      expect(log.debug.mock.calls[0][0]).toBe("Debug message");
      expect(log.debug.mock.calls[0][1]).toEqual({ extra: "data" });
    });

    it("should track info calls", () => {
      log.info("Info message");

      expect(log.info.mock.calls.length).toBe(1);
      expect(log.info.mock.calls[0][0]).toBe("Info message");
    });
  });
});
