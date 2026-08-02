import { describe, expect, it } from "vitest";

import { abortableSleep } from "../abortableSleep.js";

//
//
// Tests
//

describe("abortableSleep", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof abortableSleep).toBe("function");
    });

    it("resolves immediately for a non-positive duration", async () => {
      const started = Date.now();
      await abortableSleep({ ms: 0 });
      expect(Date.now() - started).toBeLessThan(50);
    });
  });

  describe("Happy Paths", () => {
    it("waits the requested duration", async () => {
      const started = Date.now();
      await abortableSleep({ ms: 40 });
      expect(Date.now() - started).toBeGreaterThanOrEqual(30);
    });
  });

  describe("Features", () => {
    it("returns early when the signal aborts", async () => {
      const controller = new AbortController();
      const started = Date.now();
      setTimeout(() => controller.abort(), 20);

      await abortableSleep({ ms: 5000, signal: controller.signal });

      expect(Date.now() - started).toBeLessThan(1000);
    });

    it("returns immediately when the signal is already aborted", async () => {
      const started = Date.now();

      await abortableSleep({ ms: 5000, signal: AbortSignal.abort() });

      expect(Date.now() - started).toBeLessThan(50);
    });

    it("resolves rather than throwing on abort", async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        abortableSleep({ ms: 5000, signal: controller.signal }),
      ).resolves.toBeUndefined();
    });

    it("removes its abort listener after a normal wait", async () => {
      const controller = new AbortController();

      await abortableSleep({ ms: 10, signal: controller.signal });
      // A late abort must not fire into a removed timer
      controller.abort();

      expect(controller.signal.aborted).toBe(true);
    });
  });
});
