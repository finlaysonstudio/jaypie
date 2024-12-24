import { describe, expect, it } from "vitest";
import { isJaypieError } from "../isJaypieError";
import { JaypieError } from "../baseErrors";

describe("isJaypieError", () => {
  describe("Base Cases", () => {
    it("is a Function", () => {
      expect(typeof isJaypieError).toBe("function");
    });

    it("Works", () => {
      expect(isJaypieError(new Error())).toBe(false);
    });
  });

  describe("Happy Paths", () => {
    it("returns true for JaypieError instances", () => {
      const error = new JaypieError("test error");
      expect(isJaypieError(error)).toBe(true);
    });

    it("returns true for legacy ProjectError instances", () => {
      const error = new JaypieError("test error");
      delete (error as any).isJaypieError; // Simulate legacy error
      expect(isJaypieError(error)).toBe(true);
    });
  });

  describe("Error Conditions", () => {
    it("returns false for null", () => {
      expect(isJaypieError(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isJaypieError(undefined)).toBe(false);
    });

    it("returns false for non-error objects", () => {
      expect(isJaypieError({})).toBe(false);
    });

    it("returns false for objects with only isJaypieError", () => {
      expect(isJaypieError({ isJaypieError: true })).toBe(false);
    });

    it("returns false for objects with only json function", () => {
      expect(isJaypieError({ json: () => ({}) })).toBe(false);
    });
  });
});
