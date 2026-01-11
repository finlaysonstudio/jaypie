import { describe, expect, it } from "vitest";

import { mergeTemplates } from "../mergeTemplates.js";
import {
  HOURS_BUSINESS,
  DAYS_WEEKDAYS_ONLY,
  CURVE_MIDDAY_PEAK,
  BOOST_WEEKDAYS,
} from "../registry.js";

describe("mergeTemplates", () => {
  //
  // Base Cases
  //

  describe("Base Cases", () => {
    it("returns an object", () => {
      const result = mergeTemplates({ templates: [] });
      expect(typeof result).toBe("object");
    });

    it("returns empty object for empty templates array", () => {
      const result = mergeTemplates({ templates: [] });
      expect(result).toEqual({});
    });

    it("returns single template unchanged", () => {
      const result = mergeTemplates({ templates: [HOURS_BUSINESS] });
      expect(result.hours).toEqual(HOURS_BUSINESS.hours);
    });
  });

  //
  // Error Conditions
  //

  describe("Error Conditions", () => {
    it("throws error for unknown template name", () => {
      expect(() => {
        mergeTemplates({ templates: ["UNKNOWN_TEMPLATE"] });
      }).toThrow("Unknown template: UNKNOWN_TEMPLATE");
    });
  });

  //
  // Happy Paths
  //

  describe("Happy Paths", () => {
    it("resolves template by name", () => {
      const result = mergeTemplates({ templates: ["HOURS_BUSINESS"] });
      expect(result.hours).toEqual(HOURS_BUSINESS.hours);
    });

    it("merges multiple non-curve templates", () => {
      const result = mergeTemplates({
        templates: [HOURS_BUSINESS, DAYS_WEEKDAYS_ONLY],
      });

      expect(result.hours).toBeDefined();
      expect(result.days).toBeDefined();
    });

    it("merges template names", () => {
      const result = mergeTemplates({
        templates: ["HOURS_BUSINESS", "DAYS_WEEKDAYS_ONLY"],
      });

      expect(result.hours).toBeDefined();
      expect(result.days).toBeDefined();
    });
  });

  //
  // Features
  //

  describe("Features", () => {
    describe("Curve Templates", () => {
      it("applies curve templates multiplicatively to existing hours", () => {
        const result = mergeTemplates({
          templates: [HOURS_BUSINESS, CURVE_MIDDAY_PEAK],
        });

        // Business hours are 8-17, curve should modify those weights
        expect(result.hours).toBeDefined();
        // Hour 8 should have HOURS_BUSINESS[8] * CURVE_MIDDAY_PEAK[8] = 1 * 0.7 = 0.7
        expect(result.hours![8]).toBeCloseTo(0.7);
        // Hour 11 (peak) should have 1 * 0.95 = 0.95
        expect(result.hours![11]).toBeCloseTo(0.95);
      });

      it("does not create new hours from curve templates alone", () => {
        // Curve templates alone should return empty since they only modify existing
        const result = mergeTemplates({
          templates: [CURVE_MIDDAY_PEAK],
        });

        // Since there's no base template, curve has nothing to modify
        expect(result.hours).toBeUndefined();
      });

      it("applies curve after non-curve templates", () => {
        // Order shouldn't matter - curves should always be applied after non-curves
        const result1 = mergeTemplates({
          templates: [HOURS_BUSINESS, CURVE_MIDDAY_PEAK],
        });
        const result2 = mergeTemplates({
          templates: [CURVE_MIDDAY_PEAK, HOURS_BUSINESS],
        });

        expect(result1.hours).toEqual(result2.hours);
      });
    });

    describe("Boost Templates", () => {
      it("multiplies day weights by boost factor", () => {
        const result = mergeTemplates({
          templates: [DAYS_WEEKDAYS_ONLY, BOOST_WEEKDAYS],
        });

        // Monday should be boosted: 1 * 1.3 = 1.3
        expect(result.days!["monday"]).toBeCloseTo(1.3);
        // Saturday should be 0 * 1.0 = 0
        expect(result.days!["saturday"]).toBe(0);
      });
    });

    describe("Multiple Weight Types", () => {
      it("merges templates with different weight types", () => {
        const hoursTemplate = { hours: { 9: 1, 10: 1, 11: 1 } };
        const daysTemplate = { days: { monday: 1, tuesday: 1 } };
        const monthsTemplate = { months: { 1: 1, 2: 1, 3: 1 } };

        const result = mergeTemplates({
          templates: [hoursTemplate, daysTemplate, monthsTemplate],
        });

        expect(result.hours).toBeDefined();
        expect(result.days).toBeDefined();
        expect(result.months).toBeDefined();
      });
    });
  });

  //
  // Specific Scenarios
  //

  describe("Specific Scenarios", () => {
    it("handles complex multi-template merge", () => {
      const result = mergeTemplates({
        templates: [
          "HOURS_BUSINESS",
          "DAYS_WEEKDAYS_ONLY",
          "CURVE_MIDDAY_PEAK",
          "BOOST_WEEKDAYS",
        ],
      });

      expect(result.hours).toBeDefined();
      expect(result.days).toBeDefined();

      // Verify hours are from business hours, shaped by curve
      expect(
        Object.keys(result.hours!)
          .map(Number)
          .sort((a, b) => a - b),
      ).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
    });

    it("removes undefined values from result", () => {
      const result = mergeTemplates({
        templates: [HOURS_BUSINESS],
      });

      expect(result).not.toHaveProperty("months");
      expect(result).not.toHaveProperty("weeks");
      expect(result).not.toHaveProperty("days");
      expect(result).not.toHaveProperty("dates");
      expect(result).toHaveProperty("hours");
    });
  });
});
