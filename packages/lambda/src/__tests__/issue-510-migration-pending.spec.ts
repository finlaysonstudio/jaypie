import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { log } from "@jaypie/logger";
import { restoreLog, spyLog } from "@jaypie/testkit";

import migrationHandler from "../migrationHandler.js";

// Issue #510: cr.Provider's framework throws
// `"Data" is not allowed if "IsComplete" is "False"` when an isComplete
// response carries any Data keys alongside IsComplete: false. Delete requests
// must also short-circuit instead of running migrations against a table that
// is being torn down.

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

describe("Issue #510 - migrationHandler pending polls", () => {
  describe("Pending isComplete polls omit Data", () => {
    it("Returns exactly { IsComplete: false } when the migration is pending", async () => {
      const handler = migrationHandler(async () => ({
        applied: ["gsi-1"],
        pending: true,
      }));
      const result = (await handler(
        { Data: { __migration: true }, RequestType: "Create" },
        {},
      )) as Record<string, unknown>;
      expect(result).toEqual({ IsComplete: false });
      expect(result).not.toHaveProperty("Data");
    });

    it("Returns Data alongside IsComplete: true when the migration completes", async () => {
      const handler = migrationHandler(async () => ({
        applied: ["gsi-1"],
        pending: false,
      }));
      const result = (await handler(
        { Data: { __migration: true }, RequestType: "Create" },
        {},
      )) as Record<string, unknown>;
      expect(result).toMatchObject({ IsComplete: true });
      expect(result.Data).toMatchObject({ applied: ["gsi-1"] });
    });

    it("Omits Data when the handler result is not a plain object", async () => {
      const handler = migrationHandler(async () => "ok");
      const result = (await handler(
        { Data: { __migration: true }, RequestType: "Create" },
        {},
      )) as Record<string, unknown>;
      expect(result).toEqual({ IsComplete: true });
    });
  });

  describe("Delete requests do not run migrations", () => {
    it("Returns PhysicalResourceId from onEvent without calling the handler", async () => {
      const userHandler = vi.fn().mockResolvedValue({ pending: true });
      const handler = migrationHandler(userHandler);
      const result = await handler(
        { PhysicalResourceId: "migration-123", RequestType: "Delete" },
        {},
      );
      expect(userHandler).not.toHaveBeenCalled();
      expect(result).toMatchObject({ PhysicalResourceId: "migration-123" });
    });

    it("Returns IsComplete: true from isComplete without calling the handler", async () => {
      const userHandler = vi.fn().mockResolvedValue({ pending: true });
      const handler = migrationHandler(userHandler);
      const onEventResult = (await handler(
        { PhysicalResourceId: "migration-123", RequestType: "Delete" },
        {},
      )) as Record<string, unknown>;
      const isCompleteEvent = {
        PhysicalResourceId: "migration-123",
        RequestType: "Delete",
        ...onEventResult,
      };
      const result = await handler(isCompleteEvent, {});
      expect(userHandler).not.toHaveBeenCalled();
      expect(result).toEqual({ IsComplete: true });
    });
  });
});
