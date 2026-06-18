import { describe, expect, it } from "vitest";
import { z } from "zod/v4";

import { fillFormatArrays } from "../fillFormatArrays.js";

describe("fillFormatArrays", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof fillFormatArrays).toBe("function");
    });

    it("returns content unchanged when no array fields are declared", () => {
      const content = { name: "Alice" };
      const result = fillFormatArrays({
        content,
        format: { name: String },
      });
      expect(result).toEqual({ name: "Alice" });
    });
  });

  describe("NaturalSchema", () => {
    it("fills a declared array field that the model omitted", () => {
      const result = fillFormatArrays({
        content: { "Merchant Request": "refund" },
        format: {
          "Merchant Request": String,
          "Merchant Attachments": [String],
          "Recommended Actions": [String],
        },
      });
      expect(result).toEqual({
        "Merchant Request": "refund",
        "Merchant Attachments": [],
        "Recommended Actions": [],
      });
    });

    it("leaves populated array fields intact", () => {
      const result = fillFormatArrays({
        content: { tags: ["a", "b"] },
        format: { tags: [String] },
      });
      expect(result).toEqual({ tags: ["a", "b"] });
    });

    it("does not mutate the input content", () => {
      const content = { tags: undefined } as Record<string, unknown>;
      fillFormatArrays({
        content: content as never,
        format: { tags: [String] },
      });
      expect(content.tags).toBeUndefined();
    });

    it("backfills arrays nested inside declared objects", () => {
      const result = fillFormatArrays({
        content: { meta: { title: "x" } },
        format: { meta: { title: String, labels: [String] } },
      });
      expect(result).toEqual({ meta: { title: "x", labels: [] } });
    });

    it("backfills arrays nested inside arrays of objects", () => {
      const result = fillFormatArrays({
        content: { items: [{ name: "x" }] },
        format: { items: [{ name: String, tags: [String] }] },
      });
      expect(result).toEqual({ items: [{ name: "x", tags: [] }] });
    });

    it("does not treat string enums as arrays", () => {
      const result = fillFormatArrays({
        content: { color: "red" },
        format: { color: ["red", "green", "blue"] },
      });
      expect(result).toEqual({ color: "red" });
    });
  });

  describe("Zod schema", () => {
    it("fills declared array fields", () => {
      const format = z.object({
        name: z.string(),
        tags: z.array(z.string()),
      });
      const result = fillFormatArrays({
        content: { name: "Alice" },
        format,
      });
      expect(result).toEqual({ name: "Alice", tags: [] });
    });
  });
});
