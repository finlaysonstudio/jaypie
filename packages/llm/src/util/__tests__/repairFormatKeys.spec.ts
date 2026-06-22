import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { JsonObject } from "@jaypie/types";

import { repairFormatKeys } from "../repairFormatKeys.js";

describe("repairFormatKeys", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(typeof repairFormatKeys).toBe("function");
    });

    it("returns content unchanged when keys already match", () => {
      const result = repairFormatKeys({
        content: { name: "Alice" },
        format: { name: String },
      });
      expect(result).toEqual({ name: "Alice" });
    });

    it("returns content unchanged when the format declares no properties", () => {
      const result = repairFormatKeys({
        content: { '"Merchant Request"': "refund" },
        format: {} as JsonObject,
      });
      expect(result).toEqual({ '"Merchant Request"': "refund" });
    });
  });

  describe("Error Conditions", () => {
    it("repairs a single quote-wrapped multi-word key", () => {
      const result = repairFormatKeys({
        content: { '"Merchant Request"': "refund" },
        format: { "Merchant Request": String },
      });
      expect(result).toEqual({ "Merchant Request": "refund" });
    });

    it("repairs the reported production case (mixed single/multi-word keys)", () => {
      const result = repairFormatKeys({
        content: {
          '"Summary"': "A summary",
          '"Recommended Actions"': ["call"],
          Confidence: 5,
          '"Fulfilled Requirements"': ["a"],
          '"Merchant Attachments"': ["file.pdf"],
          '"Merchant Request"': "refund",
          '"Unfulfilled Requirements"': ["b"],
        },
        format: {
          "Merchant Request": String,
          "Merchant Attachments": [String],
          Confidence: Number,
          Summary: String,
          "Fulfilled Requirements": [String],
          "Unfulfilled Requirements": [String],
          "Recommended Actions": [String],
        },
      });
      expect(Object.keys(result).sort()).toEqual(
        [
          "Confidence",
          "Fulfilled Requirements",
          "Merchant Attachments",
          "Merchant Request",
          "Recommended Actions",
          "Summary",
          "Unfulfilled Requirements",
        ].sort(),
      );
      expect((result as Record<string, unknown>)["Merchant Request"]).toBe(
        "refund",
      );
    });

    it("leaves single-word keys untouched", () => {
      const result = repairFormatKeys({
        content: { Confidence: 5 },
        format: { Confidence: Number },
      });
      expect(result).toEqual({ Confidence: 5 });
    });
  });

  describe("Features", () => {
    it("repairs keys nested inside declared objects", () => {
      const result = repairFormatKeys({
        content: { meta: { '"Full Title"': "x" } },
        format: { meta: { "Full Title": String } },
      });
      expect(result).toEqual({ meta: { "Full Title": "x" } });
    });

    it("repairs keys nested inside arrays of objects", () => {
      const result = repairFormatKeys({
        content: { items: [{ '"Display Name"': "x" }] },
        format: { items: [{ "Display Name": String }] },
      });
      expect(result).toEqual({ items: [{ "Display Name": "x" }] });
    });

    it("works with a Zod format declaration", () => {
      const result = repairFormatKeys({
        content: { '"Merchant Request"': "refund" },
        format: z.object({ "Merchant Request": z.string() }),
      });
      expect(result).toEqual({ "Merchant Request": "refund" });
    });

    it("does not mutate the input content", () => {
      const content = { '"Merchant Request"': "refund" };
      repairFormatKeys({
        content,
        format: { "Merchant Request": String },
      });
      expect(content).toEqual({ '"Merchant Request"': "refund" });
    });

    it("prefers an existing correct key over a quoted duplicate", () => {
      const result = repairFormatKeys({
        content: {
          "Merchant Request": "correct",
          '"Merchant Request"': "stale",
        },
        format: { "Merchant Request": String },
      });
      expect(result).toEqual({ "Merchant Request": "correct" });
    });
  });
});
