import { describe, expect, it } from "vitest";

import fabricApiResponse from "../fabricApiResponse.js";

describe("fabricApiResponse", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof fabricApiResponse).toBe("function");
    });
  });

  describe("Nullish input", () => {
    it("wraps null as { data: null }", () => {
      expect(fabricApiResponse(null)).toEqual({ data: null });
    });

    it("wraps undefined as { data: null }", () => {
      expect(fabricApiResponse(undefined)).toEqual({ data: null });
    });
  });

  describe("Primitives and arrays", () => {
    it("wraps a plain object in { data }", () => {
      expect(fabricApiResponse({ id: "1" })).toEqual({ data: { id: "1" } });
    });

    it("wraps an array in { data }", () => {
      expect(fabricApiResponse([{ a: 1 }, { a: 2 }])).toEqual({
        data: [{ a: 1 }, { a: 2 }],
      });
    });

    it("wraps a string in { data }", () => {
      expect(fabricApiResponse("hello")).toEqual({ data: "hello" });
    });

    it("wraps a number in { data }", () => {
      expect(fabricApiResponse(42)).toEqual({ data: 42 });
    });
  });

  describe("Pass-through", () => {
    it("passes { data } through unchanged", () => {
      const input = { data: { id: "1" } };
      expect(fabricApiResponse(input)).toBe(input);
    });

    it("passes { errors } through unchanged", () => {
      const input = { errors: [{ status: 404, title: "Not Found" }] };
      expect(fabricApiResponse(input)).toBe(input);
    });
  });

  describe("Re-wraps objects with extra keys", () => {
    it("wraps { data, other } (extra key)", () => {
      const input = { data: { id: "1" }, other: "x" };
      expect(fabricApiResponse(input)).toEqual({ data: input });
    });

    it("wraps { data, errors } (both present)", () => {
      const input = { data: { id: "1" }, errors: [{ status: 400 }] };
      expect(fabricApiResponse(input)).toEqual({ data: input });
    });

    it("wraps { items } (not 'data' or 'errors')", () => {
      const input = { items: [1, 2, 3] };
      expect(fabricApiResponse(input)).toEqual({ data: input });
    });
  });
});
