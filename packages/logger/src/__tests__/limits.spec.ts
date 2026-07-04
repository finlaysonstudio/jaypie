import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT } from "../constants";
import {
  applyValueLimits,
  byteLength,
  enforceEntryLimit,
  resolveSerializationLimits,
  truncateString,
} from "../limits";
import Logger from "../Logger";
import { createLogger } from "../JaypieLogger";

//
//
// Helpers
//

function lastJsonOutput(spy: ReturnType<typeof vi.spyOn>): any {
  const call = spy.mock.calls[spy.mock.calls.length - 1];
  const line = call[0] as string;
  return JSON.parse(line);
}

//
//
// Tests
//

describe("Serialization Limits", () => {
  const ENV_KEYS = ["LOG_MAX_DEPTH", "LOG_MAX_ENTRY_BYTES", "LOG_MAX_STRING"];
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
    vi.restoreAllMocks();
  });

  describe("resolveSerializationLimits", () => {
    it("defaults maxEntryBytes on, others off", () => {
      const limits = resolveSerializationLimits();
      expect(limits.maxEntryBytes).toBe(DEFAULT.MAX_ENTRY_BYTES);
      expect(limits.maxDepth).toBeUndefined();
      expect(limits.maxStringLength).toBeUndefined();
    });

    it("reads env vars", () => {
      process.env.LOG_MAX_DEPTH = "3";
      process.env.LOG_MAX_ENTRY_BYTES = "1024";
      process.env.LOG_MAX_STRING = "100";
      const limits = resolveSerializationLimits();
      expect(limits.maxDepth).toBe(3);
      expect(limits.maxEntryBytes).toBe(1024);
      expect(limits.maxStringLength).toBe(100);
    });

    it("disables via env values 0 and false", () => {
      process.env.LOG_MAX_ENTRY_BYTES = "0";
      expect(resolveSerializationLimits().maxEntryBytes).toBeUndefined();
      process.env.LOG_MAX_ENTRY_BYTES = "false";
      expect(resolveSerializationLimits().maxEntryBytes).toBeUndefined();
    });

    it("explicit options win over env", () => {
      process.env.LOG_MAX_ENTRY_BYTES = "1024";
      const limits = resolveSerializationLimits({ maxEntryBytes: 2048 });
      expect(limits.maxEntryBytes).toBe(2048);
    });

    it("explicit false disables a defaulted limit", () => {
      const limits = resolveSerializationLimits({ maxEntryBytes: false });
      expect(limits.maxEntryBytes).toBeUndefined();
    });
  });

  describe("truncateString", () => {
    it("passes short strings through", () => {
      expect(truncateString("hello", 10)).toBe("hello");
    });

    it("keeps the first N chars and appends a marker with the dropped count", () => {
      const value = "a".repeat(1000);
      const result = truncateString(value, 72);
      expect(result.startsWith("a".repeat(72))).toBe(true);
      expect(result).toContain("… [truncated 928 chars]");
    });

    it("formats large counts with commas", () => {
      const value = "b".repeat(612412);
      const result = truncateString(value, 72);
      expect(result).toContain("… [truncated 612,340 chars]");
    });
  });

  describe("applyValueLimits", () => {
    it("truncates nested strings with maxStringLength", () => {
      const value = { nested: { text: "x".repeat(100) } };
      const result = applyValueLimits(value, { maxStringLength: 10 }) as any;
      expect(result.nested.text).toContain("… [truncated 90 chars]");
    });

    it("never mutates the input", () => {
      const value = { nested: { text: "x".repeat(100) } };
      applyValueLimits(value, { maxStringLength: 10 });
      expect(value.nested.text).toBe("x".repeat(100));
    });

    it("replaces objects beyond maxDepth with placeholders", () => {
      const value = { a: { b: { c: 1 } }, list: [[1, 2, 3]] };
      const result = applyValueLimits(value, { maxDepth: 1 }) as any;
      expect(result.a).toEqual({ b: "[Object]" });
      expect(result.list).toEqual(["[Array(3)]"]);
    });

    it("handles circular references", () => {
      const value: Record<string, unknown> = { name: "loop" };
      value.self = value;
      const result = applyValueLimits(value, { maxStringLength: 100 }) as any;
      expect(result.self).toBe("[Circular]");
    });

    it("leaves class instances untouched", () => {
      const error = new Error("x".repeat(100));
      const result = applyValueLimits(
        { error },
        { maxStringLength: 10 },
      ) as any;
      expect(result.error).toBe(error);
    });
  });

  describe("enforceEntryLimit", () => {
    it("returns the entry unchanged when under the limit", () => {
      const entry = { data: { small: "ok" }, message: "ok" };
      const result = enforceEntryLimit(entry, { maxEntryBytes: 10000 });
      expect(result).toBe(entry);
    });

    it("truncates top-level attributes largest-first until under the limit", () => {
      const entry = {
        data: {
          big: "b".repeat(5000),
          medium: "m".repeat(500),
          small: "keep-me",
        },
        message: "post body",
        var: "request",
      };
      const result = enforceEntryLimit(entry, { maxEntryBytes: 1024 }) as any;
      expect(result.data.big).toContain("… [truncated");
      expect(result.data.big.startsWith("b".repeat(72))).toBe(true);
      expect(result.data.small).toBe("keep-me");
      expect(byteLength(result)).toBeLessThanOrEqual(1024);
    });

    it("previews stringified objects for non-string attributes", () => {
      const entry = {
        data: { payload: { inner: "z".repeat(5000) } },
        message: "m",
      };
      const result = enforceEntryLimit(entry, { maxEntryBytes: 512 }) as any;
      expect(typeof result.data.payload).toBe("string");
      expect(result.data.payload).toContain("… [truncated");
    });

    it("syncs message to truncated data when syncMessageToData is set", () => {
      const entry = {
        data: { big: "b".repeat(5000) },
        message: JSON.stringify({ big: "b".repeat(5000) }),
        var: "request",
      };
      const result = enforceEntryLimit(entry, {
        maxEntryBytes: 1024,
        syncMessageToData: true,
      }) as any;
      expect(result.message).toContain("… [truncated");
      expect(result.message.length).toBeLessThan(1024);
    });

    it("collapses data to a byte marker as a last resort", () => {
      const data: Record<string, string> = {};
      for (let i = 0; i < 50; i++) {
        data[`key${i}`] = "v".repeat(200);
      }
      const result = enforceEntryLimit(
        { data, message: "m" },
        { maxEntryBytes: 256 },
      ) as any;
      expect(result.data).toMatch(/^\[truncated [\d,]+ bytes\]$/);
    });

    it("truncates message-only entries", () => {
      const entry = { message: "m".repeat(5000) };
      const result = enforceEntryLimit(entry, { maxEntryBytes: 1024 }) as any;
      expect(result.message).toContain("… [truncated");
      expect(byteLength(result)).toBeLessThanOrEqual(1024);
    });

    it("never mutates the input entry", () => {
      const entry = { data: { big: "b".repeat(5000) }, message: "m" };
      enforceEntryLimit(entry, { maxEntryBytes: 512 });
      expect(entry.data.big).toBe("b".repeat(5000));
    });
  });

  describe("Logger integration", () => {
    it("truncates oversized var entries by default", () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const logger = new Logger({ format: "json" });
      const request = { body: "x".repeat(DEFAULT.MAX_ENTRY_BYTES * 2) };
      logger.debug.var({ request });
      const json = lastJsonOutput(spy);
      expect(json.var).toBe("request");
      expect(json.data.body).toContain("… [truncated");
      expect(byteLength(json)).toBeLessThanOrEqual(DEFAULT.MAX_ENTRY_BYTES);
      // The caller's object is untouched
      expect(request.body.length).toBe(DEFAULT.MAX_ENTRY_BYTES * 2);
    });

    it("honors constructor maxEntryBytes", () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const logger = new Logger({ format: "json", maxEntryBytes: 1024 });
      logger.debug.var({ request: { big: "b".repeat(5000), small: "ok" } });
      const json = lastJsonOutput(spy);
      expect(json.data.big).toContain("… [truncated");
      expect(json.data.small).toBe("ok");
    });

    it("honors constructor maxStringLength", () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const logger = new Logger({ format: "json", maxStringLength: 10 });
      logger.debug.var({ value: { text: "x".repeat(100) } });
      const json = lastJsonOutput(spy);
      expect(json.data.text).toContain("… [truncated 90 chars]");
    });

    it("applies limits to standard log methods", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const logger = new Logger({ format: "json", maxEntryBytes: 1024 });
      logger.warn("Processing failed", { payload: "p".repeat(5000) });
      const json = lastJsonOutput(spy);
      expect(json.message).toBe("Processing failed");
      expect(json.data.payload).toContain("… [truncated");
    });

    it("config() updates limits at runtime", () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const logger = new Logger({ format: "json" });
      logger.config({ maxStringLength: 10 });
      logger.debug.var({ value: { text: "x".repeat(100) } });
      const json = lastJsonOutput(spy);
      expect(json.data.text).toContain("… [truncated 90 chars]");
    });

    it("config(false) disables the default entry limit", () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const logger = new Logger({ format: "json" });
      logger.config({ maxEntryBytes: false });
      const body = "x".repeat(DEFAULT.MAX_ENTRY_BYTES * 2);
      logger.debug.var({ request: { body } });
      const json = lastJsonOutput(spy);
      expect(json.data.body).toBe(body);
    });

    it("with() children inherit configured limits", () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const logger = new Logger({ format: "json", maxStringLength: 10 });
      const child = logger.with("request", "abc");
      child.debug.var({ value: { text: "x".repeat(100) } });
      const json = lastJsonOutput(spy);
      expect(json.data.text).toContain("… [truncated 90 chars]");
    });
  });

  describe("JaypieLogger integration", () => {
    it("exposes config() and propagates to derived loggers", () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const logger = createLogger();
      const child = logger.with({ request: "abc" });
      logger.config({ maxStringLength: 10 });
      child.debug.var({ value: { text: "x".repeat(100) } });
      const json = lastJsonOutput(spy);
      expect(json.data.text).toContain("… [truncated 90 chars]");
    });

    it("config persists across init()", () => {
      const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const logger = createLogger();
      logger.config({ maxStringLength: 10 });
      logger.init();
      logger.debug.var({ value: { text: "x".repeat(100) } });
      const json = lastJsonOutput(spy);
      expect(json.data.text).toContain("… [truncated 90 chars]");
    });
  });
});
