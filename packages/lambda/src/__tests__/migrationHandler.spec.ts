import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { log } from "@jaypie/logger";
import { restoreLog, spyLog } from "@jaypie/testkit";

import migrationHandler from "../migrationHandler.js";

const DEFAULT_ENV = process.env;
beforeEach(() => {
  process.env = { ...process.env };
  spyLog(log);
});
afterEach(() => {
  process.env = DEFAULT_ENV;
  vi.clearAllMocks();
  restoreLog(log);
});

describe("migrationHandler", () => {
  describe("Base Cases", () => {
    it("Works", () => {
      expect(migrationHandler).toBeDefined();
      expect(migrationHandler).toBeFunction();
    });
    it("Returns a function", () => {
      const handler = migrationHandler(async () => "ok");
      expect(handler).toBeFunction();
    });
  });

  describe("Behavior", () => {
    it("Returns the handler result on success", async () => {
      const handler = migrationHandler(async () => ({ status: "complete" }));
      const result = await handler({}, {});
      expect(result).toEqual({ status: "complete" });
    });

    it("Re-throws unhandled errors so CFN sees a failed custom resource", async () => {
      const handler = migrationHandler(async () => {
        throw new Error("AccessDeniedException: dynamodb:DescribeTable");
      });
      await expect(handler({}, {})).rejects.toThrow();
    });

    it("Allows opting out of throwing by passing throw: false", async () => {
      const handler = migrationHandler(
        async () => {
          throw new Error("boom");
        },
        { throw: false },
      );
      const result = await handler({}, {});
      expect(result).toBeDefined();
    });

    it("Accepts options-first parameter order", async () => {
      const handler = migrationHandler({ name: "test" }, async () => ({
        ok: true,
      }));
      await expect(handler({}, {})).resolves.toEqual({ ok: true });
    });
  });
});
