import { describe, expect, it } from "vitest";

import {
  TEMPORAL_TEMPLATES,
  TRANSACTION_TEMPLATES,
  HOURS_BUSINESS,
  HOURS_24_7,
  DAYS_WEEKDAYS_ONLY,
  SEASON_SUMMER_ONLY,
  CURVE_MIDDAY_PEAK,
  BOOST_SUMMER,
  LULL_SUMMER,
  SPIKE_MORNING,
  DATES_15_AND_25,
} from "../registry.js";
import type { TemporalTemplate } from "../types.js";

describe("Template Registry", () => {
  //
  // Base Cases
  //

  describe("Base Cases", () => {
    it("TEMPORAL_TEMPLATES is an object", () => {
      expect(typeof TEMPORAL_TEMPLATES).toBe("object");
    });

    it("TRANSACTION_TEMPLATES is an alias for TEMPORAL_TEMPLATES", () => {
      expect(TRANSACTION_TEMPLATES).toBe(TEMPORAL_TEMPLATES);
    });

    it("contains expected number of templates", () => {
      // Should have all the templates defined in registry
      expect(Object.keys(TEMPORAL_TEMPLATES).length).toBeGreaterThanOrEqual(30);
    });
  });

  //
  // Happy Paths
  //

  describe("Happy Paths", () => {
    it("all templates have valid structure", () => {
      const validKeys = [
        "months",
        "weeks",
        "days",
        "dates",
        "hours",
        "isCurve",
      ];

      Object.entries(TEMPORAL_TEMPLATES).forEach(([, template]) => {
        Object.keys(template).forEach((key) => {
          expect(validKeys).toContain(key);
        });
        // Should have at least one temporal property
        const hasTemporalProperty =
          template.months !== undefined ||
          template.weeks !== undefined ||
          template.days !== undefined ||
          template.dates !== undefined ||
          template.hours !== undefined;
        expect(hasTemporalProperty).toBe(true);
      });
    });
  });

  //
  // Features
  //

  describe("Features", () => {
    describe("Hour Templates", () => {
      it("HOURS_BUSINESS has hours 8-17", () => {
        const hours = Object.keys(HOURS_BUSINESS.hours!).map(Number);
        expect(hours).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
      });

      it("HOURS_24_7 has all 24 hours", () => {
        const hours = Object.keys(HOURS_24_7.hours!).map(Number);
        expect(hours.length).toBe(24);
      });

      it("hour templates are not curves", () => {
        expect(HOURS_BUSINESS.isCurve).toBeFalsy();
        expect(HOURS_24_7.isCurve).toBeFalsy();
      });
    });

    describe("Day Templates", () => {
      it("DAYS_WEEKDAYS_ONLY excludes Saturday and Sunday", () => {
        expect(DAYS_WEEKDAYS_ONLY.days!["saturday"]).toBe(0);
        expect(DAYS_WEEKDAYS_ONLY.days!["sunday"]).toBe(0);
        expect(DAYS_WEEKDAYS_ONLY.days!["monday"]).toBe(1);
      });
    });

    describe("Seasonal Templates", () => {
      it("SEASON_SUMMER_ONLY includes only June, July, August", () => {
        const activeMonths = Object.entries(SEASON_SUMMER_ONLY.months!)
          .filter(([, weight]) => weight > 0)
          .map(([month]) => Number(month));
        expect(activeMonths).toEqual([6, 7, 8]);
      });
    });

    describe("Curve Templates", () => {
      it("curve templates have isCurve=true", () => {
        expect(CURVE_MIDDAY_PEAK.isCurve).toBe(true);
      });

      it("curve templates have all 24 hours for shaping", () => {
        const hours = Object.keys(CURVE_MIDDAY_PEAK.hours!).map(Number);
        expect(hours.length).toBe(24);
      });

      it("curve templates have values between 0 and 1", () => {
        Object.values(CURVE_MIDDAY_PEAK.hours!).forEach((weight) => {
          expect(weight).toBeGreaterThanOrEqual(0);
          expect(weight).toBeLessThanOrEqual(1);
        });
      });
    });

    describe("Boost Templates", () => {
      it("boost templates have isCurve=true", () => {
        expect(BOOST_SUMMER.isCurve).toBe(true);
      });

      it("boost templates have multiplier > 1 for boosted periods", () => {
        // Summer boost should boost June, July, August
        expect(BOOST_SUMMER.months![6]).toBe(1.3);
        expect(BOOST_SUMMER.months![7]).toBe(1.3);
        expect(BOOST_SUMMER.months![8]).toBe(1.3);
      });
    });

    describe("Lull Templates", () => {
      it("lull templates have isCurve=true", () => {
        expect(LULL_SUMMER.isCurve).toBe(true);
      });

      it("lull templates have multiplier < 1 for lull periods", () => {
        // Summer lull should reduce June, July, August
        expect(LULL_SUMMER.months![6]).toBe(0.6);
        expect(LULL_SUMMER.months![7]).toBe(0.6);
        expect(LULL_SUMMER.months![8]).toBe(0.6);
      });
    });

    describe("Spike Templates", () => {
      it("spike templates have isCurve=true", () => {
        expect(SPIKE_MORNING.isCurve).toBe(true);
      });

      it("spike templates peak at expected hours", () => {
        // Morning spike peaks at 7-8am
        expect(SPIKE_MORNING.hours![7]).toBe(1.0);
        expect(SPIKE_MORNING.hours![8]).toBe(1.0);
      });
    });

    describe("Date Templates", () => {
      it("DATES_15_AND_25 weights 15th and 25th", () => {
        expect(DATES_15_AND_25.dates![15]).toBe(4);
        expect(DATES_15_AND_25.dates![25]).toBe(1);
        expect(DATES_15_AND_25.dates![1]).toBe(0);
      });

      it("DATES_15_AND_25 includes early morning hours", () => {
        const hours = Object.keys(DATES_15_AND_25.hours!).map(Number);
        expect(hours).toEqual([3, 4, 5, 6]);
      });
    });
  });

  //
  // Specific Scenarios
  //

  describe("Specific Scenarios", () => {
    it("all hour weight values are non-negative", () => {
      Object.values(TEMPORAL_TEMPLATES).forEach(
        (template: TemporalTemplate) => {
          if (template.hours) {
            Object.values(template.hours).forEach((weight) => {
              expect(weight).toBeGreaterThanOrEqual(0);
            });
          }
        },
      );
    });

    it("all templates are accessible by name in registry", () => {
      expect(TEMPORAL_TEMPLATES["HOURS_BUSINESS"]).toBe(HOURS_BUSINESS);
      expect(TEMPORAL_TEMPLATES["DAYS_WEEKDAYS_ONLY"]).toBe(DAYS_WEEKDAYS_ONLY);
      expect(TEMPORAL_TEMPLATES["CURVE_MIDDAY_PEAK"]).toBe(CURVE_MIDDAY_PEAK);
    });
  });
});
