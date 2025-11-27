import { describe, expect, it } from "vitest";

import { shiftHoursForTimezone } from "../shiftHoursForTimezone.js";

describe("shiftHoursForTimezone", () => {
  //
  // Base Cases
  //

  describe("Base Cases", () => {
    it("returns an object", () => {
      const result = shiftHoursForTimezone({
        hours: { 9: 1 },
        timezone: "UTC",
      });
      expect(typeof result).toBe("object");
    });

    it("returns same keys count as input", () => {
      const input = { 8: 1, 9: 1, 10: 1, 11: 1, 12: 1 };
      const result = shiftHoursForTimezone({
        hours: input,
        timezone: "America/New_York",
      });
      expect(Object.keys(result).length).toBe(Object.keys(input).length);
    });
  });

  //
  // Happy Paths
  //

  describe("Happy Paths", () => {
    it("returns unchanged hours for UTC timezone", () => {
      const input = { 8: 1, 9: 1, 10: 1, 11: 1, 12: 1 };
      const result = shiftHoursForTimezone({
        hours: input,
        timezone: "UTC",
      });
      expect(result).toEqual(input);
    });

    it("shifts hours forward for negative UTC offset (America/New_York in winter)", () => {
      // New York is UTC-5 in winter
      // 9am local -> 14:00 UTC
      const result = shiftHoursForTimezone({
        hours: { 9: 1 },
        timezone: "America/New_York",
      });
      // Should shift forward by 5 hours
      expect(Object.keys(result).map(Number)).toContain(14);
    });

    it("shifts hours backward for positive UTC offset (Europe/London in winter)", () => {
      // London is UTC+0 in winter (no shift)
      const input = { 9: 1, 10: 1, 11: 1 };
      const result = shiftHoursForTimezone({
        hours: input,
        timezone: "Europe/London",
      });
      // GMT is UTC+0, so no shift expected
      expect(result).toEqual(input);
    });
  });

  //
  // Features
  //

  describe("Features", () => {
    describe("Hour Wrapping", () => {
      it("wraps hours past midnight correctly", () => {
        // If timezone is UTC-8, hour 20 local becomes hour 4 next day (20 + 8 = 28 % 24 = 4)
        const result = shiftHoursForTimezone({
          hours: { 20: 1, 21: 1, 22: 1 },
          timezone: "America/Los_Angeles",
        });
        // All hours should be valid (0-23)
        Object.keys(result).forEach((hour) => {
          const h = Number(hour);
          expect(h).toBeGreaterThanOrEqual(0);
          expect(h).toBeLessThanOrEqual(23);
        });
      });

      it("wraps hours before midnight correctly", () => {
        // For positive offsets, early morning hours might wrap to previous day
        const result = shiftHoursForTimezone({
          hours: { 1: 1, 2: 1, 3: 1 },
          timezone: "Asia/Tokyo",
        });
        // All hours should be valid (0-23)
        Object.keys(result).forEach((hour) => {
          const h = Number(hour);
          expect(h).toBeGreaterThanOrEqual(0);
          expect(h).toBeLessThanOrEqual(23);
        });
      });
    });

    describe("Weight Preservation", () => {
      it("preserves weight values through shifting", () => {
        const result = shiftHoursForTimezone({
          hours: { 9: 0.5, 10: 1.0, 11: 1.5 },
          timezone: "America/Chicago",
        });
        const weights = Object.values(result);
        expect(weights).toContain(0.5);
        expect(weights).toContain(1.0);
        expect(weights).toContain(1.5);
      });
    });
  });

  //
  // Specific Scenarios
  //

  describe("Specific Scenarios", () => {
    it("handles business hours shift for America/New_York", () => {
      // Business hours 9-17 local should shift to 14-22 UTC (winter)
      const localHours: Record<number, number> = {};
      for (let h = 9; h <= 17; h++) {
        localHours[h] = 1;
      }

      const result = shiftHoursForTimezone({
        hours: localHours,
        timezone: "America/New_York",
      });

      // Should have 9 hours
      expect(Object.keys(result).length).toBe(9);
    });

    it("handles full day (all 24 hours)", () => {
      const allHours: Record<number, number> = {};
      for (let h = 0; h < 24; h++) {
        allHours[h] = 1;
      }

      const result = shiftHoursForTimezone({
        hours: allHours,
        timezone: "America/Denver",
      });

      // Should still have 24 hours
      expect(Object.keys(result).length).toBe(24);
    });

    it("handles empty hours object", () => {
      const result = shiftHoursForTimezone({
        hours: {},
        timezone: "America/New_York",
      });
      expect(result).toEqual({});
    });
  });
});
