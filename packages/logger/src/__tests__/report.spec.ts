import { afterEach, describe, expect, it, vi } from "vitest";

import { JaypieLogger } from "../JaypieLogger";

const OVERWRITE_MESSAGE = "[logger] Overwriting report key: requests";

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

    it("warns when report() is called without an active session", () => {
      const logger = new JaypieLogger({ level: "trace" });
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      logger.report({ requests: 1 });
      expect(warnSpy).toHaveBeenCalled();
    });
  });
});
