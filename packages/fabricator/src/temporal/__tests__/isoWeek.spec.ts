import { describe, expect, it } from "vitest";

import { getISOWeekNumber } from "../isoWeek.js";

describe("getISOWeekNumber", () => {
  //
  // Base Cases
  //

  describe("Base Cases", () => {
    it("returns a number", () => {
      const result = getISOWeekNumber(new Date("2025-06-15"));
      expect(typeof result).toBe("number");
    });

    it("returns values between 1 and 53", () => {
      const result = getISOWeekNumber(new Date("2025-01-01"));
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(53);
    });
  });

  //
  // Happy Paths
  //

  describe("Happy Paths", () => {
    it("returns week 1 for January 4th (always in week 1)", () => {
      // January 4th is always in ISO week 1 by definition
      expect(getISOWeekNumber(new Date("2025-01-04"))).toBe(1);
      expect(getISOWeekNumber(new Date("2024-01-04"))).toBe(1);
      expect(getISOWeekNumber(new Date("2023-01-04"))).toBe(1);
    });

    it("returns correct week for mid-year dates", () => {
      // June 15, 2025 is a Sunday in ISO week 24
      const result = getISOWeekNumber(new Date("2025-06-15"));
      expect(result).toBe(24);
    });

    it("returns correct week for end of year", () => {
      // December 28, 2025 is a Sunday in week 52
      const result = getISOWeekNumber(new Date("2025-12-28"));
      expect(result).toBe(52);
    });
  });

  //
  // Features
  //

  describe("Features", () => {
    describe("Year Boundary Cases", () => {
      it("handles Jan 1 that belongs to previous year week", () => {
        // January 1, 2025 is a Wednesday - belongs to ISO week 1 of 2025
        expect(getISOWeekNumber(new Date("2025-01-01"))).toBe(1);
      });

      it("handles Dec 31 that belongs to next year week", () => {
        // December 31, 2025 is a Wednesday in week 1 of 2026
        expect(getISOWeekNumber(new Date("2025-12-31"))).toBe(1);
      });

      it("handles year with 53 weeks (long year)", () => {
        // 2020 was a long year (53 weeks)
        // December 31, 2020 is a Thursday in week 53
        expect(getISOWeekNumber(new Date("2020-12-31"))).toBe(53);
      });
    });

    describe("UTC Handling", () => {
      it("uses UTC date components to avoid timezone issues", () => {
        // Create a date at UTC midnight
        const date = new Date(Date.UTC(2025, 5, 15, 0, 0, 0));
        const result = getISOWeekNumber(date);
        expect(result).toBe(24);
      });
    });
  });

  //
  // Specific Scenarios
  //

  describe("Specific Scenarios", () => {
    it("returns consistent results for all days in a week", () => {
      // Week 24 of 2025: Monday June 9 through Sunday June 15
      const week24Dates = [
        new Date("2025-06-09"), // Monday
        new Date("2025-06-10"), // Tuesday
        new Date("2025-06-11"), // Wednesday
        new Date("2025-06-12"), // Thursday
        new Date("2025-06-13"), // Friday
        new Date("2025-06-14"), // Saturday
        new Date("2025-06-15"), // Sunday
      ];

      week24Dates.forEach((date) => {
        expect(getISOWeekNumber(date)).toBe(24);
      });
    });

    it("increments week number at Monday boundaries", () => {
      // Sunday June 15 is end of week 24, Monday June 16 is start of week 25
      expect(getISOWeekNumber(new Date("2025-06-15"))).toBe(24); // Sunday
      expect(getISOWeekNumber(new Date("2025-06-16"))).toBe(25); // Monday
    });
  });
});
