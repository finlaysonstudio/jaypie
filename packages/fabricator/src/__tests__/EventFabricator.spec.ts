import { describe, expect, it } from "vitest";

import {
  EventFabricator,
  Fabricator,
  type CreateEventParams,
  HOURS_BUSINESS,
  DAYS_WEEKDAYS_ONLY,
} from "../index.js";

//
// Test Implementation
//

interface SimpleEvent {
  id: string;
  index: number;
  timestamp: Date;
}

class SimpleEventFabricator extends EventFabricator<SimpleEvent> {
  protected createEvent({
    timestamp,
    seed,
    index,
  }: CreateEventParams): SimpleEvent {
    return {
      id: seed,
      index,
      timestamp,
    };
  }
}

describe("EventFabricator", () => {
  //
  // Base Cases
  //

  describe("Base Cases", () => {
    it("is a class that extends Fabricator", () => {
      const fabricator = new SimpleEventFabricator();
      expect(fabricator).toBeInstanceOf(Fabricator);
      expect(fabricator).toBeInstanceOf(EventFabricator);
    });

    it("has an id", () => {
      const fabricator = new SimpleEventFabricator();
      expect(typeof fabricator.id).toBe("string");
      expect(fabricator.id.length).toBeGreaterThan(0);
    });

    it("has a name", () => {
      const fabricator = new SimpleEventFabricator();
      expect(typeof fabricator.name).toBe("string");
    });

    it("has events method", () => {
      const fabricator = new SimpleEventFabricator();
      expect(typeof fabricator.events).toBe("function");
    });
  });

  //
  // Happy Paths
  //

  describe("Happy Paths", () => {
    it("generates events array", () => {
      const fabricator = new SimpleEventFabricator({
        seed: "test-seed",
        annualCount: 10,
      });
      const events = fabricator.events({ year: 2025 });

      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(10);
    });

    it("events have timestamp, id, and index", () => {
      const fabricator = new SimpleEventFabricator({
        seed: "test-seed",
        annualCount: 5,
      });
      const events = fabricator.events({ year: 2025 });

      events.forEach((event, i) => {
        expect(event.timestamp).toBeInstanceOf(Date);
        expect(typeof event.id).toBe("string");
        expect(event.index).toBe(i);
      });
    });

    it("events are sorted chronologically", () => {
      const fabricator = new SimpleEventFabricator({
        seed: "test-seed",
        annualCount: 100,
      });
      const events = fabricator.events({ year: 2025 });

      for (let i = 1; i < events.length; i++) {
        expect(events[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          events[i - 1].timestamp.getTime(),
        );
      }
    });

    it("all events are within the target year", () => {
      const fabricator = new SimpleEventFabricator({
        seed: "test-seed",
        annualCount: 100,
      });
      const events = fabricator.events({ year: 2025 });

      events.forEach((event) => {
        expect(event.timestamp.getUTCFullYear()).toBe(2025);
      });
    });
  });

  //
  // Features
  //

  describe("Features", () => {
    describe("Determinism", () => {
      it("produces same output with same seed", () => {
        const fabricator1 = new SimpleEventFabricator({
          seed: "deterministic-seed",
          annualCount: 50,
        });
        const fabricator2 = new SimpleEventFabricator({
          seed: "deterministic-seed",
          annualCount: 50,
        });

        const events1 = fabricator1.events({ year: 2025 });
        const events2 = fabricator2.events({ year: 2025 });

        expect(events1.length).toBe(events2.length);
        events1.forEach((e1, i) => {
          expect(e1.timestamp.getTime()).toBe(events2[i].timestamp.getTime());
          expect(e1.id).toBe(events2[i].id);
        });
      });

      it("produces different output with different seeds", () => {
        const fabricator1 = new SimpleEventFabricator({
          seed: "seed-one",
          annualCount: 50,
        });
        const fabricator2 = new SimpleEventFabricator({
          seed: "seed-two",
          annualCount: 50,
        });

        const events1 = fabricator1.events({ year: 2025 });
        const events2 = fabricator2.events({ year: 2025 });

        // At least some timestamps should differ
        const differentTimestamps = events1.filter(
          (e1, i) => e1.timestamp.getTime() !== events2[i].timestamp.getTime(),
        );
        expect(differentTimestamps.length).toBeGreaterThan(0);
      });
    });

    describe("Count Override", () => {
      it("respects count parameter in events()", () => {
        const fabricator = new SimpleEventFabricator({
          seed: "test",
          annualCount: 1000,
        });
        const events = fabricator.events({ year: 2025, count: 25 });

        expect(events.length).toBe(25);
      });
    });

    describe("Template Integration", () => {
      it("applies hour template", () => {
        const fabricator = new SimpleEventFabricator({
          seed: "hour-test",
          annualCount: 500,
          template: HOURS_BUSINESS,
        });
        const events = fabricator.events({ year: 2025 });

        // All events should be within business hours (8-17)
        events.forEach((event) => {
          const hour = event.timestamp.getUTCHours();
          expect(hour).toBeGreaterThanOrEqual(8);
          expect(hour).toBeLessThanOrEqual(17);
        });
      });

      it("applies day template", () => {
        const fabricator = new SimpleEventFabricator({
          seed: "day-test",
          annualCount: 500,
          template: DAYS_WEEKDAYS_ONLY,
        });
        const events = fabricator.events({ year: 2025 });

        // No events should be on Saturday (6) or Sunday (0)
        events.forEach((event) => {
          const dayOfWeek = event.timestamp.getUTCDay();
          expect(dayOfWeek).not.toBe(0); // Sunday
          expect(dayOfWeek).not.toBe(6); // Saturday
        });
      });

      it("applies multiple templates", () => {
        const fabricator = new SimpleEventFabricator({
          seed: "multi-template-test",
          annualCount: 500,
          template: [HOURS_BUSINESS, DAYS_WEEKDAYS_ONLY],
        });
        const events = fabricator.events({ year: 2025 });

        events.forEach((event) => {
          const hour = event.timestamp.getUTCHours();
          const dayOfWeek = event.timestamp.getUTCDay();

          // Business hours
          expect(hour).toBeGreaterThanOrEqual(8);
          expect(hour).toBeLessThanOrEqual(17);

          // Weekdays only
          expect(dayOfWeek).not.toBe(0);
          expect(dayOfWeek).not.toBe(6);
        });
      });

      it("applies template by name", () => {
        const fabricator = new SimpleEventFabricator({
          seed: "name-test",
          annualCount: 500,
          template: "HOURS_BUSINESS",
        });
        const events = fabricator.events({ year: 2025 });

        events.forEach((event) => {
          const hour = event.timestamp.getUTCHours();
          expect(hour).toBeGreaterThanOrEqual(8);
          expect(hour).toBeLessThanOrEqual(17);
        });
      });
    });

    describe("Year Selection", () => {
      it("defaults to current year", () => {
        const fabricator = new SimpleEventFabricator({
          seed: "current-year",
          annualCount: 10,
        });
        const events = fabricator.events();
        const currentYear = new Date().getFullYear();

        events.forEach((event) => {
          expect(event.timestamp.getUTCFullYear()).toBe(currentYear);
        });
      });

      it("generates events for specified year", () => {
        const fabricator = new SimpleEventFabricator({
          seed: "year-2020",
          annualCount: 10,
        });
        const events = fabricator.events({ year: 2020 });

        events.forEach((event) => {
          expect(event.timestamp.getUTCFullYear()).toBe(2020);
        });
      });
    });
  });

  //
  // Specific Scenarios
  //

  describe("Specific Scenarios", () => {
    it("handles large event counts", () => {
      const fabricator = new SimpleEventFabricator({
        seed: "large-count",
        annualCount: 10000,
      });
      const events = fabricator.events({ year: 2025 });

      expect(events.length).toBe(10000);
      // Verify chronological order
      for (let i = 1; i < events.length; i++) {
        expect(events[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          events[i - 1].timestamp.getTime(),
        );
      }
    });

    it("handles small event counts", () => {
      const fabricator = new SimpleEventFabricator({
        seed: "small-count",
        annualCount: 1,
      });
      const events = fabricator.events({ year: 2025 });

      expect(events.length).toBe(1);
      expect(events[0].timestamp.getUTCFullYear()).toBe(2025);
    });

    it("handles zero events", () => {
      const fabricator = new SimpleEventFabricator({
        seed: "zero-count",
        annualCount: 0,
      });
      const events = fabricator.events({ year: 2025 });

      expect(events.length).toBe(0);
    });

    it("generates unique seeds for each event", () => {
      const fabricator = new SimpleEventFabricator({
        seed: "unique-seeds",
        annualCount: 100,
      });
      const events = fabricator.events({ year: 2025 });

      const ids = events.map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(events.length);
    });

    it("distributes events throughout the year", () => {
      const fabricator = new SimpleEventFabricator({
        seed: "distribution-test",
        annualCount: 365, // One per day on average
      });
      const events = fabricator.events({ year: 2025 });

      // Check that events span multiple months
      const months = new Set(events.map((e) => e.timestamp.getUTCMonth()));
      expect(months.size).toBeGreaterThan(6); // Should cover most months
    });
  });
});
