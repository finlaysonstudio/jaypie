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
    describe("onEventHandler mode (event without Data)", () => {
      it("Returns PhysicalResourceId immediately without calling the user handler", async () => {
        const userHandler = vi.fn().mockResolvedValue({ status: "complete" });
        const handler = migrationHandler(userHandler);
        const result = await handler({}, {});
        expect(userHandler).not.toHaveBeenCalled();
        expect(result).toMatchObject({ PhysicalResourceId: expect.any(String) });
      });

      it("Preserves PhysicalResourceId from event for Update and Delete requests", async () => {
        const handler = migrationHandler(async () => ({ status: "complete" }));
        const result = await handler(
          { RequestType: "Update", PhysicalResourceId: "my-migration-123" },
          {},
        );
        expect(result).toMatchObject({ PhysicalResourceId: "my-migration-123" });
      });
    });

    describe("isCompleteHandler mode (event with Data)", () => {
      it("Runs the user handler and returns IsComplete: true when no pending flag", async () => {
        const handler = migrationHandler(async () => ({ status: "complete" }));
        const result = await handler({ Data: {} }, {});
        expect(result).toMatchObject({ IsComplete: true });
      });

      it("Returns IsComplete: false when handler returns pending: true", async () => {
        const handler = migrationHandler(
          async () => ({ status: "in-progress", pending: true }),
        );
        const result = await handler({ Data: {} }, {});
        expect(result).toMatchObject({ IsComplete: false });
      });

      it("Returns IsComplete: true when handler returns pending: false", async () => {
        const handler = migrationHandler(
          async () => ({ status: "complete", pending: false }),
        );
        const result = await handler({ Data: {} }, {});
        expect(result).toMatchObject({ IsComplete: true });
      });

      it("Re-throws unhandled errors so CFN sees a failed custom resource", async () => {
        const handler = migrationHandler(async () => {
          throw new Error("AccessDeniedException: dynamodb:DescribeTable");
        });
        await expect(handler({ Data: {} }, {})).rejects.toThrow();
      });

      it("Allows opting out of throwing by passing throw: false", async () => {
        const handler = migrationHandler(
          async () => {
            throw new Error("boom");
          },
          { throw: false },
        );
        const result = await handler({ Data: {} }, {});
        expect(result).toBeDefined();
      });

      it("Accepts options-first parameter order", async () => {
        const handler = migrationHandler({ name: "test" }, async () => ({
          ok: true,
        }));
        await expect(handler({ Data: {} }, {})).resolves.toMatchObject({
          IsComplete: true,
        });
      });
    });
  });
});
