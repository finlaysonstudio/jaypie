import { afterEach, describe, expect, it, vi } from "vitest";

import { JaypieLogger } from "../JaypieLogger";
import { reportMerge } from "../reportMerge";

const OVERWRITE_MESSAGE = "[logger] Overwriting report key: requests";

const lastReport = (infoSpy: ReturnType<typeof vi.spyOn>) => {
  const calls = infoSpy.mock.calls;
  const output = JSON.parse(calls[calls.length - 1][0] as string);
  return output.data;
};

const overwriteMessages = (debugSpy: ReturnType<typeof vi.spyOn>) =>
  debugSpy.mock.calls
    .map((call: unknown[]) => JSON.parse(String(call[0])).message as string)
    .filter((message: string) =>
      message.startsWith("[logger] Overwriting report key"),
    );

describe("report", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Base Cases", () => {
    it("is a function on the logger", () => {
      const logger = new JaypieLogger({ level: "trace" });
      expect(typeof logger.report).toBe("function");
    });
  });

  describe("Features", () => {
    it("logs an overwritten report key at debug", () => {
      const logger = new JaypieLogger({ level: "trace" });
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      logger.setup();
      logger.report({ requests: 1 });
      logger.report({ requests: 2 });
      expect(
        debugSpy.mock.calls.some((call) =>
          String(call[0]).includes(OVERWRITE_MESSAGE),
        ),
      ).toBe(true);
    });

    it("does not warn when overwriting a report key", () => {
      const logger = new JaypieLogger({ level: "trace" });
      vi.spyOn(console, "debug").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      logger.setup();
      logger.report({ requests: 1 });
      logger.report({ requests: 2 });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("merges nested objects across calls", () => {
      const logger = new JaypieLogger({ level: "trace" });
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      logger.setup();
      logger.report({ a: { x: 1 } });
      logger.report({ a: { y: 2 } });
      logger.teardown();
      expect(lastReport(infoSpy).a).toEqual({ x: 1, y: 2 });
    });

    it("merges sibling units reported under one key", () => {
      const logger = new JaypieLogger({ level: "trace" });
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      logger.setup();
      logger.report({
        agentModel: { agent_notes: { chain: "Fast", servedModel: "haiku" } },
      });
      logger.report({
        agentModel: {
          agent_evidence_list: { chain: "Fast", servedModel: "haiku" },
        },
      });
      logger.teardown();
      expect(lastReport(infoSpy).agentModel).toEqual({
        agent_evidence_list: { chain: "Fast", servedModel: "haiku" },
        agent_notes: { chain: "Fast", servedModel: "haiku" },
      });
      expect(overwriteMessages(debugSpy)).toEqual([]);
    });

    it("logs the dotted path of an overwritten nested leaf at debug", () => {
      const logger = new JaypieLogger({ level: "trace" });
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      logger.setup();
      logger.report({ a: { x: 1, y: 2 } });
      logger.report({ a: { x: 3 } });
      logger.teardown();
      expect(overwriteMessages(debugSpy)).toEqual([
        "[logger] Overwriting report key: a.x",
      ]);
      expect(warnSpy).not.toHaveBeenCalled();
      expect(lastReport(infoSpy).a).toEqual({ x: 3, y: 2 });
    });

    it("does not log when a leaf is rewritten with the same value", () => {
      const logger = new JaypieLogger({ level: "trace" });
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      logger.setup();
      logger.report({ a: { x: 1 } });
      logger.report({ a: { x: 1 } });
      expect(overwriteMessages(debugSpy)).toEqual([]);
    });

    it("warns when report() is called without an active session", () => {
      const logger = new JaypieLogger({ level: "trace" });
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      logger.report({ requests: 1 });
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe("reportMerge", () => {
    it("adds new keys without overwrites", () => {
      expect(reportMerge({ existing: { a: 1 }, incoming: { b: 2 } })).toEqual({
        merged: { a: 1, b: 2 },
        overwrites: [],
      });
    });

    it("merges plain objects recursively", () => {
      expect(
        reportMerge({
          existing: { a: { b: { c: 1 } } },
          incoming: { a: { b: { d: 2 } } },
        }),
      ).toEqual({ merged: { a: { b: { c: 1, d: 2 } } }, overwrites: [] });
    });

    it("replaces an object with a scalar and reports the path", () => {
      expect(
        reportMerge({ existing: { a: { x: 1 } }, incoming: { a: 5 } }),
      ).toEqual({ merged: { a: 5 }, overwrites: ["a"] });
    });

    it("replaces a scalar with an object and reports the path", () => {
      expect(
        reportMerge({ existing: { a: 5 }, incoming: { a: { x: 1 } } }),
      ).toEqual({ merged: { a: { x: 1 } }, overwrites: ["a"] });
    });

    it("treats arrays as leaves", () => {
      expect(
        reportMerge({ existing: { a: [1] }, incoming: { a: [2] } }),
      ).toEqual({ merged: { a: [2] }, overwrites: ["a"] });
    });

    it("does not mutate its inputs", () => {
      const existing = { a: { x: 1 } };
      const incoming = { a: { y: 2 } };
      reportMerge({ existing, incoming });
      expect(existing).toEqual({ a: { x: 1 } });
      expect(incoming).toEqual({ a: { y: 2 } });
    });
  });
});
