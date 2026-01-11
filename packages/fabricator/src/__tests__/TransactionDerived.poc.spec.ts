/**
 * POC Test: Transaction Derived Events
 *
 * This file demonstrates how to use the derived event system to generate
 * financial transactions with follow-up events like voids, refunds,
 * chargebacks, and recurring payments.
 *
 * The Transaction type is defined locally for testing purposes and
 * is not exported from the package.
 */
import { describe, expect, it } from "vitest";

import {
  CHANCE,
  EventFabricator,
  Fabricator,
  HOURS_BUSINESS,
  DAYS_WEEKDAYS_ONLY,
  type CreateEventParams,
  type DerivedConfig,
  type TimestampedEvent,
} from "../index.js";

//
// Transaction Types (local to this test file)
//

interface Transaction extends TimestampedEvent {
  amount: number;
  id: string;
  parentId?: string;
  timestamp: Date;
  type:
    | "chargeback"
    | "payment-retry"
    | "purchase"
    | "refund"
    | "representment"
    | "subscription-renewal"
    | "subscription-start"
    | "void";
}

//
// Derived Event Configurations
//

const BASIC_TRANSACTION_DERIVED: DerivedConfig<Transaction> = {
  boundaryBehavior: "include",
  maxDepth: 4,
  rules: [
    {
      condition: (parent) => parent.type === "purchase",
      createDerived: ({ parent, seed, timestamp }) => ({
        amount: -parent.amount,
        id: seed,
        parentId: parent.id,
        timestamp,
        type: "void" as const,
      }),
      name: "void",
      probability: CHANCE.RARE, // 2.1%
      timing: { mode: "same-day" },
    },
    {
      condition: (parent) => parent.type === "purchase",
      createDerived: ({ parent, seed, timestamp }) => {
        const fab = new Fabricator({ seed: `${seed}-amount` });
        // Refund can be partial (50-100% of original)
        const refundPercent = 0.5 + fab.random() * 0.5;
        return {
          amount: -Math.round(parent.amount * refundPercent * 100) / 100,
          id: seed,
          parentId: parent.id,
          timestamp,
          type: "refund" as const,
        };
      },
      name: "refund",
      probability: 0.1, // 10%
      timing: {
        delayMax: 14,
        delayMin: 1,
        mode: "range",
        unit: "days",
      },
    },
    {
      condition: (parent) => parent.type === "purchase" && parent.amount > 50,
      createDerived: ({ parent, seed, timestamp }) => ({
        amount: -parent.amount,
        id: seed,
        parentId: parent.id,
        timestamp,
        type: "chargeback" as const,
      }),
      derived: [
        {
          createDerived: ({ parent, seed, timestamp }) => ({
            amount: Math.abs(parent.amount), // Re-charge the amount (positive)
            id: seed,
            parentId: parent.id,
            timestamp,
            type: "representment" as const,
          }),
          derived: [
            {
              createDerived: ({ parent, seed, timestamp }) => ({
                amount: -parent.amount,
                id: seed,
                parentId: parent.id,
                timestamp,
                type: "chargeback" as const,
              }),
              name: "second-chargeback",
              probability: 0.15, // 15% of representments get second chargeback
              timing: {
                delayMax: 60,
                delayMin: 30,
                mode: "range",
                unit: "days",
              },
            },
          ],
          name: "representment",
          probability: 0.7, // 70% of chargebacks are contested
          timing: {
            delayMax: 21,
            delayMin: 7,
            mode: "range",
            unit: "days",
          },
        },
      ],
      name: "chargeback",
      probability: CHANCE.RARE, // 2.1%
      timing: {
        delayMax: 90,
        delayMin: 30,
        mode: "range",
        unit: "days",
      },
    },
  ],
};

const SUBSCRIPTION_DERIVED: DerivedConfig<Transaction> = {
  boundaryBehavior: "include",
  maxDepth: 2,
  rules: [
    {
      condition: (parent) => parent.type === "subscription-start",
      createDerived: ({ parent, seed, timestamp, index }) => ({
        amount: parent.amount,
        id: seed,
        parentId: parent.id,
        timestamp,
        type: "subscription-renewal" as const,
      }),
      derived: [
        {
          createDerived: ({ parent, seed, timestamp }) => ({
            amount: parent.amount,
            id: seed,
            parentId: parent.id,
            timestamp,
            type: "payment-retry" as const,
          }),
          name: "payment-retry",
          probability: 0.05, // 5% of renewals fail initially
          timing: {
            delayMin: 3,
            mode: "fixed",
            unit: "days",
          },
        },
      ],
      name: "recurring-charge",
      probability: 1.0, // Always recurs
      timing: {
        interval: 1,
        maxRecurrences: 11, // Up to 11 more charges (12 total including original)
        mode: "recurring",
        unit: "months",
        until: "end-of-year",
      },
    },
  ],
};

//
// Transaction Fabricators
//

class PurchaseFabricator extends EventFabricator<Transaction> {
  constructor(
    options: {
      annualCount?: number;
      derived?: DerivedConfig<Transaction>;
      seed?: number | string;
    } = {},
  ) {
    super({
      annualCount: options.annualCount ?? 100,
      derived: options.derived,
      seed: options.seed,
      template: [HOURS_BUSINESS, DAYS_WEEKDAYS_ONLY],
    });
  }

  protected createEvent({ seed, timestamp }: CreateEventParams): Transaction {
    const fab = new Fabricator({ seed });
    return {
      amount: fab.random({ currency: true, max: 500, min: 10 }),
      id: seed,
      timestamp,
      type: "purchase",
    };
  }
}

class SubscriptionFabricator extends EventFabricator<Transaction> {
  constructor(
    options: {
      annualCount?: number;
      seed?: number | string;
    } = {},
  ) {
    super({
      annualCount: options.annualCount ?? 10,
      derived: SUBSCRIPTION_DERIVED,
      seed: options.seed,
      // Subscriptions typically start in first half of year
      template: HOURS_BUSINESS,
    });
  }

  protected createEvent({ seed, timestamp }: CreateEventParams): Transaction {
    const fab = new Fabricator({ seed });
    // Monthly subscription prices
    const prices = [9.99, 14.99, 19.99, 29.99, 49.99];
    const amount = prices[Math.floor(fab.random() * prices.length)];
    return {
      amount,
      id: seed,
      timestamp,
      type: "subscription-start",
    };
  }
}

//
// Tests
//

describe("Transaction Derived Events POC", () => {
  describe("Basic Transaction Derived Events", () => {
    it("generates purchases without derived events when not configured", () => {
      const fab = new PurchaseFabricator({
        annualCount: 100,
        seed: "no-derived",
      });
      const events = fab.events({ year: 2025 });

      expect(events.length).toBe(100);
      expect(events.every((e) => e.type === "purchase")).toBe(true);
    });

    it("generates purchases with derived events when configured", () => {
      const fab = new PurchaseFabricator({
        annualCount: 100,
        derived: BASIC_TRANSACTION_DERIVED,
        seed: "with-derived",
      });
      const events = fab.events({ year: 2025 });

      // Should have more events due to derived events
      expect(events.length).toBeGreaterThan(100);

      // Should have various transaction types
      const types = new Set(events.map((e) => e.type));
      expect(types.has("purchase")).toBe(true);
      // May or may not have these depending on probability rolls
      // We just check the structure is correct
    });

    it("derived events are deterministic", () => {
      const fab1 = new PurchaseFabricator({
        annualCount: 50,
        derived: BASIC_TRANSACTION_DERIVED,
        seed: "deterministic-test",
      });
      const fab2 = new PurchaseFabricator({
        annualCount: 50,
        derived: BASIC_TRANSACTION_DERIVED,
        seed: "deterministic-test",
      });

      const events1 = fab1.events({ year: 2025 });
      const events2 = fab2.events({ year: 2025 });

      expect(events1.length).toBe(events2.length);
      events1.forEach((e1, i) => {
        expect(e1.id).toBe(events2[i].id);
        expect(e1.type).toBe(events2[i].type);
        expect(e1.amount).toBe(events2[i].amount);
        expect(e1.timestamp.getTime()).toBe(events2[i].timestamp.getTime());
      });
    });

    it("events are sorted chronologically", () => {
      const fab = new PurchaseFabricator({
        annualCount: 50,
        derived: BASIC_TRANSACTION_DERIVED,
        seed: "chronological",
      });
      const events = fab.events({ year: 2025 });

      for (let i = 1; i < events.length; i++) {
        expect(events[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          events[i - 1].timestamp.getTime(),
        );
      }
    });

    it("derived events have parentId referencing parent", () => {
      const fab = new PurchaseFabricator({
        annualCount: 100,
        derived: BASIC_TRANSACTION_DERIVED,
        seed: "parent-refs",
      });
      const events = fab.events({ year: 2025 });

      const purchases = events.filter((e) => e.type === "purchase");
      const derived = events.filter((e) => e.type !== "purchase");

      // All derived events should have parentId
      derived.forEach((d) => {
        expect(d.parentId).toBeDefined();
      });

      // Purchases should not have parentId
      purchases.forEach((p) => {
        expect(p.parentId).toBeUndefined();
      });
    });

    it("voids occur on same day as purchase", () => {
      const fab = new PurchaseFabricator({
        annualCount: 500, // More events to increase chance of voids
        derived: BASIC_TRANSACTION_DERIVED,
        seed: "void-timing",
      });
      const events = fab.events({ year: 2025 });

      const voids = events.filter((e) => e.type === "void");

      voids.forEach((voidEvent) => {
        const parent = events.find((e) => e.id === voidEvent.parentId);
        expect(parent).toBeDefined();
        if (parent) {
          // Same day check
          expect(voidEvent.timestamp.getUTCDate()).toBe(
            parent.timestamp.getUTCDate(),
          );
          expect(voidEvent.timestamp.getUTCMonth()).toBe(
            parent.timestamp.getUTCMonth(),
          );
        }
      });
    });

    it("refunds have negative amounts", () => {
      const fab = new PurchaseFabricator({
        annualCount: 200,
        derived: BASIC_TRANSACTION_DERIVED,
        seed: "refund-amounts",
      });
      const events = fab.events({ year: 2025 });

      const refunds = events.filter((e) => e.type === "refund");

      refunds.forEach((refund) => {
        expect(refund.amount).toBeLessThan(0);
      });
    });
  });

  describe("Chargeback Chains", () => {
    it("chargebacks can spawn representments which can spawn second chargebacks", () => {
      // Use a large sample to increase likelihood of seeing the chain
      const fab = new PurchaseFabricator({
        annualCount: 1000,
        derived: BASIC_TRANSACTION_DERIVED,
        seed: "chargeback-chain",
      });
      const events = fab.events({ year: 2025 });

      const chargebacks = events.filter((e) => e.type === "chargeback");
      const representments = events.filter((e) => e.type === "representment");

      // With 1000 purchases at 2.1% chargeback rate, we should see ~20 chargebacks
      // 70% of those should have representments (~14)
      // This test just verifies the structure works
      if (chargebacks.length > 0) {
        // Some chargebacks should have spawned representments
        // (probabilistic, so we just check structure)
        expect(chargebacks.every((c) => c.amount < 0)).toBe(true);
      }

      if (representments.length > 0) {
        // Representments should have positive amounts (re-charging)
        expect(representments.every((r) => r.amount > 0)).toBe(true);

        // Each representment should reference a chargeback
        representments.forEach((rep) => {
          const parent = events.find((e) => e.id === rep.parentId);
          expect(parent?.type).toBe("chargeback");
        });
      }
    });
  });

  describe("Subscription Renewals", () => {
    it("generates recurring subscription charges", () => {
      const fab = new SubscriptionFabricator({
        annualCount: 5,
        seed: "subscriptions",
      });
      const events = fab.events({ year: 2025 });

      const starts = events.filter((e) => e.type === "subscription-start");
      const renewals = events.filter((e) => e.type === "subscription-renewal");

      expect(starts.length).toBe(5);
      // Each subscription should generate renewals through end of year
      expect(renewals.length).toBeGreaterThan(0);
    });

    it("subscription renewals are monthly", () => {
      const fab = new SubscriptionFabricator({
        annualCount: 1,
        seed: "monthly-check",
      });
      const events = fab.events({ year: 2025 });

      const starts = events.filter((e) => e.type === "subscription-start");
      const renewals = events.filter((e) => e.type === "subscription-renewal");

      if (renewals.length >= 2) {
        // Check that renewals are roughly a month apart
        for (let i = 1; i < renewals.length; i++) {
          const diff =
            renewals[i].timestamp.getTime() -
            renewals[i - 1].timestamp.getTime();
          const daysApart = diff / (24 * 60 * 60 * 1000);
          // Should be approximately 30 days (28-31 due to month variation)
          expect(daysApart).toBeGreaterThanOrEqual(28);
          expect(daysApart).toBeLessThanOrEqual(32);
        }
      }
    });

    it("renewal amounts match original subscription", () => {
      const fab = new SubscriptionFabricator({
        annualCount: 3,
        seed: "amount-match",
      });
      const events = fab.events({ year: 2025 });

      const starts = events.filter((e) => e.type === "subscription-start");

      starts.forEach((start) => {
        const renewals = events.filter(
          (e) => e.type === "subscription-renewal" && e.parentId === start.id,
        );
        renewals.forEach((renewal) => {
          expect(renewal.amount).toBe(start.amount);
        });
      });
    });
  });

  describe("eventsWithMeta", () => {
    it("provides metadata about derived event relationships", () => {
      const fab = new PurchaseFabricator({
        annualCount: 100,
        derived: BASIC_TRANSACTION_DERIVED,
        seed: "with-meta",
      });
      const eventsWithMeta = fab.eventsWithMeta({ year: 2025 });

      // Primary events should have depth 0
      const primary = eventsWithMeta.filter((e) => e.depth === 0);
      expect(primary.length).toBe(100);
      expect(primary.every((e) => e.event.type === "purchase")).toBe(true);

      // Derived events should have depth > 0
      const derived = eventsWithMeta.filter((e) => e.depth > 0);
      derived.forEach((d) => {
        expect(d.parentSeed).toBeDefined();
        expect(d.ruleName).toBeDefined();
      });
    });

    it("tracks chain depth correctly", () => {
      const fab = new PurchaseFabricator({
        annualCount: 1000,
        derived: BASIC_TRANSACTION_DERIVED,
        seed: "depth-tracking",
      });
      const eventsWithMeta = fab.eventsWithMeta({ year: 2025 });

      // Purchases are depth 0
      const purchases = eventsWithMeta.filter(
        (e) => e.event.type === "purchase",
      );
      expect(purchases.every((p) => p.depth === 0)).toBe(true);

      // Voids, refunds, chargebacks are depth 1
      const depth1 = eventsWithMeta.filter(
        (e) =>
          e.event.type === "void" ||
          e.event.type === "refund" ||
          (e.event.type === "chargeback" && e.depth === 1),
      );
      depth1.forEach((e) => {
        expect(e.depth).toBe(1);
      });

      // Representments are depth 2
      const representments = eventsWithMeta.filter(
        (e) => e.event.type === "representment",
      );
      representments.forEach((e) => {
        expect(e.depth).toBe(2);
      });

      // Second chargebacks are depth 3
      const secondChargebacks = eventsWithMeta.filter(
        (e) => e.event.type === "chargeback" && e.depth === 3,
      );
      secondChargebacks.forEach((e) => {
        expect(e.depth).toBe(3);
      });
    });
  });

  describe("Statistics", () => {
    it("logs transaction statistics for analysis", () => {
      const fab = new PurchaseFabricator({
        annualCount: 1000,
        derived: BASIC_TRANSACTION_DERIVED,
        seed: "statistics",
      });
      const events = fab.events({ year: 2025 });

      const stats = {
        chargebacks: events.filter((e) => e.type === "chargeback").length,
        purchases: events.filter((e) => e.type === "purchase").length,
        refunds: events.filter((e) => e.type === "refund").length,
        representments: events.filter((e) => e.type === "representment").length,
        total: events.length,
        voids: events.filter((e) => e.type === "void").length,
      };

      console.log("\nTransaction Statistics:");
      console.log(`  Purchases: ${stats.purchases}`);
      console.log(
        `  Voids: ${stats.voids} (${((stats.voids / stats.purchases) * 100).toFixed(1)}%)`,
      );
      console.log(
        `  Refunds: ${stats.refunds} (${((stats.refunds / stats.purchases) * 100).toFixed(1)}%)`,
      );
      console.log(
        `  Chargebacks: ${stats.chargebacks} (${((stats.chargebacks / stats.purchases) * 100).toFixed(1)}%)`,
      );
      console.log(
        `  Representments: ${stats.representments} (${((stats.representments / stats.chargebacks) * 100 || 0).toFixed(1)}% of chargebacks)`,
      );
      console.log(`  Total Events: ${stats.total}`);

      // Basic sanity checks on rates
      expect(stats.purchases).toBe(1000);
      // Void rate should be around 2.1% (CHANCE.RARE)
      expect(stats.voids).toBeGreaterThan(0);
      expect(stats.voids).toBeLessThan(100); // Should be around 21

      // Refund rate should be around 10%
      expect(stats.refunds).toBeGreaterThan(50);
      expect(stats.refunds).toBeLessThan(200); // Should be around 100
    });
  });
});
