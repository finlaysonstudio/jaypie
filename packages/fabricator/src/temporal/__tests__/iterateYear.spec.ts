import { describe, expect, it } from "vitest";

import { getDaysInYear, iterateDaysInYear } from "../iterateYear.js";

describe("getDaysInYear", () => {
  //
  // Base Cases
  //

  describe("Base Cases", () => {
    it("returns an array", () => {
      const result = getDaysInYear(2025);
      expect(Array.isArray(result)).toBe(true);
    });

    it("returns Date objects", () => {
      const result = getDaysInYear(2025);
      expect(result[0]).toBeInstanceOf(Date);
    });
  });

  //
  // Happy Paths
  //

  describe("Happy Paths", () => {
    it("returns 365 days for non-leap year", () => {
      const result = getDaysInYear(2025);
      expect(result.length).toBe(365);
    });

    it("returns 366 days for leap year", () => {
      const result = getDaysInYear(2024);
      expect(result.length).toBe(366);
    });

    it("starts on January 1st", () => {
      const result = getDaysInYear(2025);
      expect(result[0].getUTCFullYear()).toBe(2025);
      expect(result[0].getUTCMonth()).toBe(0);
      expect(result[0].getUTCDate()).toBe(1);
    });

    it("ends on December 31st", () => {
      const result = getDaysInYear(2025);
      const lastDay = result[result.length - 1];
      expect(lastDay.getUTCFullYear()).toBe(2025);
      expect(lastDay.getUTCMonth()).toBe(11);
      expect(lastDay.getUTCDate()).toBe(31);
    });
  });

  //
  // Features
  //

  describe("Features", () => {
    it("all dates are at UTC midnight", () => {
      const result = getDaysInYear(2025);
      result.forEach((date) => {
        expect(date.getUTCHours()).toBe(0);
        expect(date.getUTCMinutes()).toBe(0);
        expect(date.getUTCSeconds()).toBe(0);
        expect(date.getUTCMilliseconds()).toBe(0);
      });
    });

    it("dates are in chronological order", () => {
      const result = getDaysInYear(2025);
      for (let i = 1; i < result.length; i++) {
        expect(result[i].getTime()).toBeGreaterThan(result[i - 1].getTime());
      }
    });

    it("consecutive dates differ by exactly one day", () => {
      const result = getDaysInYear(2025);
      const oneDayMs = 24 * 60 * 60 * 1000;
      for (let i = 1; i < result.length; i++) {
        expect(result[i].getTime() - result[i - 1].getTime()).toBe(oneDayMs);
      }
    });
  });

  //
  // Specific Scenarios
  //

  describe("Specific Scenarios", () => {
    it("includes February 29th for leap year", () => {
      const result = getDaysInYear(2024);
      const feb29 = result.find(
        (d) => d.getUTCMonth() === 1 && d.getUTCDate() === 29,
      );
      expect(feb29).toBeDefined();
    });

    it("does not include February 29th for non-leap year", () => {
      const result = getDaysInYear(2025);
      const feb29 = result.find(
        (d) => d.getUTCMonth() === 1 && d.getUTCDate() === 29,
      );
      expect(feb29).toBeUndefined();
    });
  });
});

describe("iterateDaysInYear", () => {
  //
  // Base Cases
  //

  describe("Base Cases", () => {
    it("returns a generator", () => {
      const result = iterateDaysInYear(2025);
      expect(typeof result.next).toBe("function");
    });
  });

  //
  // Happy Paths
  //

  describe("Happy Paths", () => {
    it("yields 365 days for non-leap year", () => {
      const days = [...iterateDaysInYear(2025)];
      expect(days.length).toBe(365);
    });

    it("yields 366 days for leap year", () => {
      const days = [...iterateDaysInYear(2024)];
      expect(days.length).toBe(366);
    });

    it("yields same dates as getDaysInYear", () => {
      const arrayDays = getDaysInYear(2025);
      const generatorDays = [...iterateDaysInYear(2025)];

      expect(generatorDays.length).toBe(arrayDays.length);

      for (let i = 0; i < arrayDays.length; i++) {
        expect(generatorDays[i].getTime()).toBe(arrayDays[i].getTime());
      }
    });
  });

  //
  // Features
  //

  describe("Features", () => {
    it("can be iterated partially", () => {
      const gen = iterateDaysInYear(2025);
      const first = gen.next().value;
      const second = gen.next().value;

      expect(first?.getUTCDate()).toBe(1);
      expect(second?.getUTCDate()).toBe(2);
    });

    it("returns done after all days", () => {
      const gen = iterateDaysInYear(2025);
      // Consume all days
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const _ of gen) {
        // consume
      }
      const result = gen.next();
      expect(result.done).toBe(true);
    });
  });
});
