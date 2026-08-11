import { describe, expect, it } from "vitest";
import { JaypieError } from "../baseErrors";
import {
  BadRequestError,
  ConfigurationError,
  InternalError,
  NotFoundError,
} from "../index";

//
//
// Mock constants
//

const MOCK = {
  DETAIL: "mockDetail",
  STATUS: 600,
  TITLE: "mockTitle",
} as const;

//
//
// Run tests
//

describe("Issue 492: Error classes accept a cause", () => {
  describe("Base Cases", () => {
    it("Does not define cause when none is passed", () => {
      const error = new JaypieError();
      expect("cause" in error).toBe(false);
    });
  });

  describe("Features", () => {
    it("Preserves the cause on the base error", () => {
      const cause = new Error(MOCK.DETAIL);
      const error = new JaypieError(MOCK.DETAIL, { cause });
      expect(error.cause).toBe(cause);
    });

    it("Preserves status and title alongside cause", () => {
      const cause = new Error(MOCK.DETAIL);
      const error = new JaypieError(MOCK.DETAIL, {
        cause,
        status: MOCK.STATUS,
        title: MOCK.TITLE,
      });
      expect(error.cause).toBe(cause);
      expect(error.status).toBe(MOCK.STATUS);
      expect(error.title).toBe(MOCK.TITLE);
    });

    it("Preserves a non-error cause", () => {
      const error = new JaypieError(MOCK.DETAIL, { cause: MOCK.DETAIL });
      expect(error.cause).toBe(MOCK.DETAIL);
    });

    it("Preserves an explicitly undefined cause", () => {
      const error = new JaypieError(MOCK.DETAIL, { cause: undefined });
      expect("cause" in error).toBe(true);
      expect(error.cause).toBeUndefined();
    });
  });

  describe("Provided Errors", () => {
    it.each([
      ["BadRequestError", BadRequestError],
      ["ConfigurationError", ConfigurationError],
      ["InternalError", InternalError],
      ["NotFoundError", NotFoundError],
    ])("%s preserves the cause", (_name, ErrorClass) => {
      const cause = new Error(MOCK.DETAIL);
      const error = new ErrorClass(MOCK.DETAIL, { cause });
      expect(error.cause).toBe(cause);
      expect(error.detail).toBe(MOCK.DETAIL);
    });

    it("Keeps the default message when only a cause is passed", () => {
      const cause = new Error(MOCK.DETAIL);
      const error = new ConfigurationError(undefined, { cause });
      expect(error.cause).toBe(cause);
      expect(error.status).toBe(500);
    });

    it("Does not define cause when none is passed", () => {
      const error = new ConfigurationError(MOCK.DETAIL);
      expect("cause" in error).toBe(false);
    });

    it("Preserves the cause when called without new", () => {
      const cause = new Error(MOCK.DETAIL);
      const error = (
        ConfigurationError as unknown as (
          message?: string,
          options?: { cause?: unknown },
        ) => JaypieError
      )(MOCK.DETAIL, { cause });
      expect(error.cause).toBe(cause);
    });
  });

  describe("Chaining", () => {
    it("Walks a cause chain through a Jaypie wrapper", () => {
      const root = new Error("root");
      const middle = new InternalError("middle", { cause: root });
      const outer = new ConfigurationError("outer", { cause: middle });
      const chain: unknown[] = [];
      // The package targets a lib older than ES2022, where `Error` itself
      // declares no `cause`; the chain is still readable through the option
      let current: unknown = outer;
      while (current instanceof Error) {
        chain.push(current);
        current = (current as Error & { cause?: unknown }).cause;
      }
      expect(chain).toEqual([outer, middle, root]);
    });
  });
});
