import { describe, expect, it } from "vitest";
import { ERROR, HTTP } from "../types";
import { JaypieError } from "../baseErrors";
import { UnreachableCodeError } from "../index";

const NAME = "JaypieError";

//
//
// Mock constants
//

const MOCK = {
  DETAIL: "mockDetails",
  TITLE: "mockTitle",
  STATUS: 600,
} as const;

//
//
// Run tests
//

describe("JSON:API HTTP Error", () => {
  describe("Base Cases", () => {
    it("Is throwable", () => {
      try {
        const error = new JaypieError();
        throw error;
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as JaypieError).name).toBe(NAME);
      }
      expect.assertions(2);
    });

    it("Has isProjectError for backward compatibility", () => {
      const error = new JaypieError();
      expect(error.isProjectError).toBe(true);
    });

    it("Has isJaypieError", () => {
      const error = new JaypieError();
      expect(error.isJaypieError).toBe(true);
    });

    it("Has json", () => {
      const error = new JaypieError();
      expect(typeof error.json()).toBe("object");
    });

    it("Defaults to internal error", () => {
      const error = new JaypieError();
      expect(error.status).toBe(HTTP.CODE.INTERNAL_ERROR);
      expect(error.title).toBe(ERROR.TITLE.INTERNAL_ERROR);
      expect(error.detail).toBe(ERROR.MESSAGE.INTERNAL_ERROR);
    });
  });

  describe("Features", () => {
    it("Allows custom message", () => {
      const error = new JaypieError(MOCK.DETAIL);
      expect(error.detail).toBe(MOCK.DETAIL);
    });

    it("Allows custom status", () => {
      const error = new JaypieError(undefined, { status: MOCK.STATUS });
      expect(error.status).toBe(MOCK.STATUS);
    });

    it("Allows custom title", () => {
      const error = new JaypieError(undefined, { title: MOCK.TITLE });
      expect(error.title).toBe(MOCK.TITLE);
    });
  });

  describe("Throwing with new", () => {
    it("Works with new", () => {
      try {
        throw new UnreachableCodeError();
      } catch (error) {
        expect((error as JaypieError).isProjectError).toBe(true);
      }
      expect.assertions(1);
    });

    it("Works without new", () => {
      try {
        throw UnreachableCodeError();
      } catch (error) {
        expect((error as JaypieError).isProjectError).toBe(true);
      }
      expect.assertions(1);
    });
  });

  describe("Error Type", () => {
    it("Allows subtype to be passed as an undocumented option", () => {
      const error = new JaypieError(undefined, undefined, { _type: "subtype" });
      expect(error._type).toBe("subtype");
    });

    it("Defaults to unknown type", () => {
      const error = new JaypieError();
      expect(error._type).toBe(ERROR.TYPE.UNKNOWN_TYPE);
    });

    it("Is supported in provided errors", () => {
      const error = new UnreachableCodeError();
      expect(error._type).toBe(ERROR.TYPE.UNREACHABLE_CODE);
    });
  });
}); 