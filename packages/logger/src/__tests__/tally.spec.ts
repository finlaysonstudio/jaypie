import { afterEach, describe, expect, it, vi } from "vitest";

import { createLogger } from "../index";
import { tallyMerge } from "../tallyMerge";

const lastReport = (infoSpy: ReturnType<typeof vi.spyOn>) => {
  const calls = infoSpy.mock.calls;
  const output = JSON.parse(calls[calls.length - 1][0] as string);
  return output.data;
};

describe("tally", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Base Cases", () => {
    it("is a function on the logger", () => {
      const logger = createLogger();
      expect(typeof logger.tally).toBe("function");
    });

    it("does not throw without an active session", () => {
      const logger = createLogger();
      expect(() => logger.tally({ count: 1 })).not.toThrow();
    });

    it("does not warn without an active session", () => {
      const logger = createLogger();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      logger.tally({ count: 1 });
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("tallyMerge", () => {
    it("sums numbers", () => {
      expect(tallyMerge({ existing: 2, incoming: 3 })).toBe(5);
    });

    it("collects two strings into an array of strings", () => {
      expect(tallyMerge({ existing: "a", incoming: "b" })).toEqual(["a", "b"]);
    });

    it("appends a string to an existing array", () => {
      expect(tallyMerge({ existing: ["a", "b"], incoming: "c" })).toEqual([
        "a",
        "b",
        "c",
      ]);
    });

    it("ANDs booleans", () => {
      expect(tallyMerge({ existing: true, incoming: true })).toBe(true);
      expect(tallyMerge({ existing: true, incoming: false })).toBe(false);
      expect(tallyMerge({ existing: false, incoming: true })).toBe(false);
    });

    it("concatenates arrays", () => {
      expect(tallyMerge({ existing: [1], incoming: [2, 3] })).toEqual([
        1, 2, 3,
      ]);
    });

    it("merges objects recursively", () => {
      expect(
        tallyMerge({
          existing: { llm: { tokens: 10, turns: 1 } },
          incoming: { llm: { toolCalls: 2, tokens: 5, turns: 1 } },
        }),
      ).toEqual({ llm: { tokens: 15, toolCalls: 2, turns: 2 } });
    });

    it("defers null and undefined to the other value", () => {
      expect(tallyMerge({ existing: undefined, incoming: 3 })).toBe(3);
      expect(tallyMerge({ existing: null, incoming: 3 })).toBe(3);
      expect(tallyMerge({ existing: 3, incoming: undefined })).toBe(3);
      expect(tallyMerge({ existing: 3, incoming: null })).toBe(3);
    });

    it("preserves mismatched types in an array", () => {
      expect(tallyMerge({ existing: "a", incoming: 1 })).toEqual(["a", 1]);
      expect(tallyMerge({ existing: 1, incoming: { a: 1 } })).toEqual([
        1,
        { a: 1 },
      ]);
    });
  });

  describe("Features", () => {
    it("includes tallied data in the teardown report", () => {
      const logger = createLogger();
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      logger.setup();
      logger.tally({ llm: { turns: 2 } });
      logger.teardown();
      expect(lastReport(infoSpy)).toMatchObject({ llm: { turns: 2 } });
    });

    it("sums numbers across repeated tally calls", () => {
      const logger = createLogger();
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      logger.setup();
      logger.tally({ llm: { toolCalls: 1, turns: 2 } });
      logger.tally({ llm: { toolCalls: 2, turns: 3 } });
      logger.teardown();
      expect(lastReport(infoSpy)).toMatchObject({
        llm: { toolCalls: 3, turns: 5 },
      });
    });

    it("collects strings and ANDs booleans across tally calls", () => {
      const logger = createLogger();
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      logger.setup();
      logger.tally({ model: "alpha", succeeded: true });
      logger.tally({ model: "beta", succeeded: false });
      logger.tally({ model: "gamma" });
      logger.teardown();
      expect(lastReport(infoSpy)).toMatchObject({
        model: ["alpha", "beta", "gamma"],
        succeeded: false,
      });
    });

    it("merges tally into report() data on collision", () => {
      const logger = createLogger();
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      logger.setup();
      logger.report({ requests: 1 });
      logger.tally({ requests: 2 });
      logger.teardown();
      expect(lastReport(infoSpy)).toMatchObject({ requests: 3 });
    });

    it("ignores tally calls made without an active session", () => {
      const logger = createLogger();
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      logger.tally({ llm: { turns: 99 } });
      logger.setup();
      logger.teardown();
      expect(lastReport(infoSpy).llm).toBeUndefined();
    });

    it("resets tally data between sessions", () => {
      const logger = createLogger();
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      logger.setup();
      logger.tally({ llm: { turns: 2 } });
      logger.teardown();
      logger.setup();
      logger.teardown();
      expect(lastReport(infoSpy).llm).toBeUndefined();
    });
  });
});
