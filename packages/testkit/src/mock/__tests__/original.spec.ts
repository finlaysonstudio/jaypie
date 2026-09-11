import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Subject
import { importOptional } from "../original";

const LOAD_FAILURE_FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "loadFailure.ts",
);

describe("importOptional", () => {
  describe("Base Cases", () => {
    it("Is a Function", () => {
      expect(importOptional).toBeFunction();
    });
  });

  describe("Error Conditions", () => {
    it("Rethrows load failures other than a missing package", async () => {
      await expect(importOptional(LOAD_FAILURE_FIXTURE)).rejects.toThrow(
        "_MOCK_LOAD_FAILURE",
      );
    });
  });

  describe("Happy Paths", () => {
    it("Loads an installed package", async () => {
      const errors =
        await importOptional<typeof import("@jaypie/errors")>("@jaypie/errors");
      expect(errors.BadRequestError).toBeClass();
    });

    it("Resolves a missing package to an empty module", async () => {
      await expect(importOptional("@jaypie/not-installed")).resolves.toEqual(
        {},
      );
    });
  });
});
