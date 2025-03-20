import { describe, expect, it } from "vitest";
import {
  MAX_TURNS_ABSOLUTE_LIMIT,
  MAX_TURNS_DEFAULT_LIMIT,
  maxTurnsFromOptions,
} from "../operate";
import type { LlmOperateOptions } from "../../../types/LlmProvider.interface";

describe("operate", () => {
  describe("maxTurnsFromOptions", () => {
    describe("Base Cases", () => {
      it("is a Function", () => {
        expect(maxTurnsFromOptions).toBeFunction();
      });

      it("returns a number", () => {
        const result = maxTurnsFromOptions({});
        expect(result).toBeNumber();
      });
    });

    describe("Features", () => {
      it("returns default limit (12) when turns is undefined", () => {
        const options: LlmOperateOptions = {};
        const result = maxTurnsFromOptions(options);
        expect(result).toBe(MAX_TURNS_DEFAULT_LIMIT);
      });

      it("returns default limit (12) when turns is true", () => {
        const options: LlmOperateOptions = { turns: true };
        const result = maxTurnsFromOptions(options);
        expect(result).toBe(MAX_TURNS_DEFAULT_LIMIT);
      });

      it("returns 1 when turns is false", () => {
        const options: LlmOperateOptions = { turns: false };
        const result = maxTurnsFromOptions(options);
        expect(result).toBe(1);
      });

      it("returns 1 when turns is 0", () => {
        const options: LlmOperateOptions = { turns: 0 };
        const result = maxTurnsFromOptions(options);
        expect(result).toBe(1);
      });

      it("returns the specified number when turns is a positive number", () => {
        const options: LlmOperateOptions = { turns: 5 };
        const result = maxTurnsFromOptions(options);
        expect(result).toBe(5);
      });

      it("caps returns at MAX_TURNS_ABSOLUTE_LIMIT (72) when turns is a large positive number", () => {
        const options: LlmOperateOptions = { turns: 100 };
        const result = maxTurnsFromOptions(options);
        expect(result).toBe(MAX_TURNS_ABSOLUTE_LIMIT);
      });

      it("returns default limit (12) when turns is a negative number", () => {
        const options: LlmOperateOptions = { turns: -5 };
        const result = maxTurnsFromOptions(options);
        expect(result).toBe(MAX_TURNS_DEFAULT_LIMIT);
      });

      it("returns 1 for other falsy values like null", () => {
        // @ts-expect-error Testing with null even though it's not in the type
        const options: LlmOperateOptions = { turns: null };
        const result = maxTurnsFromOptions(options);
        expect(result).toBe(1);
      });
    });
  });
});
