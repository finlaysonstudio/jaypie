import { describe, expect, it, vi } from "vitest";

import {
  BadRequestError,
  ConfigurationError,
  isJaypieError,
  JaypieError,
  NotFoundError,
} from "../index";

// The published package ships an ESM build and a CommonJS build. Each build
// evaluates its own copy of `errors.ts`, so each owns a distinct class object
// for every error. Re-evaluating the module here reproduces that duplication
// without needing both dist builds on disk.
async function loadDuplicateModule() {
  vi.resetModules();
  return import("../index");
}

describe("Issue 502: instanceof across module formats", () => {
  describe("Base Cases", () => {
    it("produces a genuinely separate module instance", async () => {
      const duplicate = await loadDuplicateModule();
      expect(duplicate.BadRequestError).not.toBe(BadRequestError);
    });
  });

  describe("Happy Paths", () => {
    it("matches an error raised by the duplicate module", async () => {
      const duplicate = await loadDuplicateModule();
      const error = new duplicate.BadRequestError();
      expect(error instanceof BadRequestError).toBe(true);
    });

    it("matches an error raised by this module against the duplicate", async () => {
      const duplicate = await loadDuplicateModule();
      const error = new BadRequestError();
      expect(error instanceof duplicate.BadRequestError).toBe(true);
    });

    it("matches the base class across modules", async () => {
      const duplicate = await loadDuplicateModule();
      const error = new duplicate.NotFoundError();
      expect(error instanceof JaypieError).toBe(true);
    });

    it("matches a base error across modules", async () => {
      const duplicate = await loadDuplicateModule();
      const error = new duplicate.JaypieError("cross-format");
      expect(error instanceof JaypieError).toBe(true);
    });

    it("matches special errors across modules", async () => {
      const duplicate = await loadDuplicateModule();
      const error = new duplicate.ConfigurationError();
      expect(error instanceof ConfigurationError).toBe(true);
    });
  });

  describe("Features", () => {
    it("does not match a different error type", async () => {
      const duplicate = await loadDuplicateModule();
      const error = new duplicate.NotFoundError();
      expect(error instanceof BadRequestError).toBe(false);
    });

    it("does not match non-Jaypie values", () => {
      expect(new Error("plain") instanceof BadRequestError).toBe(false);
      expect(({} as unknown) instanceof BadRequestError).toBe(false);
      expect((null as unknown) instanceof JaypieError).toBe(false);
      expect((undefined as unknown) instanceof BadRequestError).toBe(false);
      expect(("string" as unknown) instanceof JaypieError).toBe(false);
    });

    it("keeps same-module instanceof intact", () => {
      const error = new NotFoundError();
      expect(error instanceof NotFoundError).toBe(true);
      expect(error instanceof JaypieError).toBe(true);
      expect(error instanceof Error).toBe(true);
      expect(isJaypieError(error)).toBe(true);
    });

    it("keeps subclasses distinguishable", () => {
      class CustomError extends BadRequestError {}
      const custom = new CustomError();
      const plain = new BadRequestError();
      expect(custom instanceof CustomError).toBe(true);
      expect(custom instanceof BadRequestError).toBe(true);
      expect(plain instanceof CustomError).toBe(false);
    });
  });
});
