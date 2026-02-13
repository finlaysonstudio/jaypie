---
description: Seeded deterministic test data generation with @jaypie/fabricator
related: tests, mocks, models
---

# Fabricator

`@jaypie/fabricator` provides seeded, deterministic data generation built on `@faker-js/faker`.

## Installation

```bash
npm install @jaypie/fabricator
```

## Core: Fabricator Class

Wraps faker.js with deterministic seeding. Same seed = same data.

```typescript
import { Fabricator } from "@jaypie/fabricator";

const fab = new Fabricator("my-seed");
fab.internet.email();    // Always the same for "my-seed"
fab.person.firstName();  // Proxies to faker.js
fab.id;                  // UUID derived from seed
fab.name;                // Auto-generated word pair
```

### Factory Function

```typescript
import { fabricator } from "@jaypie/fabricator";

const fab = fabricator("my-seed");
const fab = fabricator({ seed: "my-seed", name: "Custom Name" });
```

### Environment Seed

```typescript
process.env.PROJECT_SEED = "test-seed";
const fab = new Fabricator(); // Falls back to PROJECT_SEED
```

## Random Number Generation

```typescript
const fab = new Fabricator("seed");

fab.random();                                     // 0-1 float
fab.random({ min: 1, max: 10, integer: true });   // 1-10 integer
fab.random({ mean: 50, stddev: 10 });             // Normal distribution
fab.random({ min: 10, max: 100, currency: true }); // 2 decimal places
fab.random({ min: 0, max: 1, precision: 4 });     // 4 decimal places
```

Standalone:

```typescript
import { random } from "@jaypie/fabricator";

const rng = random("my-seed");
rng({ min: 1, max: 100, integer: true });
```

## Built-in Generators

### Words

```typescript
fab.generate.words(); // "adjective noun", "adjective verb", or "noun verb"
```

### Person

Generates realistic person objects with probabilistic variations using Jaypie golden numbers:

```typescript
fab.generate.person();
// { id, firstName, middleName, lastName, fullName }
```

- **UNCOMMON (14.6%)**: middleName missing, fullName includes middle
- **RARE (2.1%)**: firstName is a surname, lastName is hyphenated
- **EPIC (0.307%)**: double middle names

## CHANCE Constants

```typescript
import { CHANCE } from "@jaypie/fabricator/constants";

CHANCE.UNCOMMON;   // 0.146  (14.6%)
CHANCE.RARE;       // 0.021  (2.1%)
CHANCE.EPIC;       // 0.00307 (0.307%)
CHANCE.LEGENDARY;  // 0.000441 (0.0441%)
```

## Nested Fabricators

Create hierarchical fabricators with `Fabricator.new`:

```typescript
const world = Fabricator.new({
  seed: "earth",
  name: ({ fabricator }) => fabricator.generate.words(),
  fabricators: {
    cities: { name: ({ fabricator }) => fabricator.location.city() },
    exports: { name: ({ fabricator }) => fabricator.commerce.product() },
  },
});

world.cities(5);         // Array of 5 city fabricators
for (const c of world.cities()) break; // Infinite generator
```

## EventFabricator

Abstract base for generating temporally-distributed events across a year.

```typescript
import { EventFabricator } from "@jaypie/fabricator";

class OrderFabricator extends EventFabricator<Order> {
  protected createEvent({ timestamp, seed, index }) {
    return { id: seed, timestamp, amount: 100 };
  }
}

const fab = new OrderFabricator({
  seed: "orders-2025",
  annualCount: 10000,
  template: ["HOURS_BUSINESS", "DAYS_WEEKDAYS_ONLY", "BOOST_HOLIDAY_SEASON"],
  timezone: "America/New_York",
});

const orders = fab.events({ year: 2025 });
```

### Temporal Templates

Combine templates for realistic distribution patterns:

| Category | Templates |
|----------|-----------|
| Hours | `HOURS_BUSINESS`, `HOURS_RETAIL`, `HOURS_EVENING`, `HOURS_OVERNIGHT`, `HOURS_24_7`, etc. |
| Days | `DAYS_WEEKDAYS_ONLY`, `DAYS_NO_SUNDAY`, `DAYS_NO_MONDAY`, `DAYS_NO_SUNDAY_MONDAY` |
| Dates | `DATES_15_AND_25` (billing cycles) |
| Seasonal | `SEASON_SUMMER_ONLY`, `SEASON_WINTER_ONLY`, `SEASON_NO_SUMMER`, `SEASON_NO_WINTER` |
| Curves | `CURVE_EVENING_PEAK`, `CURVE_ECOMMERCE`, `CURVE_MIDDAY_PEAK` |
| Spikes | `SPIKE_MORNING`, `SPIKE_LUNCH`, `SPIKE_EVENING` |
| Boosts | `BOOST_SUMMER`, `BOOST_WINTER`, `BOOST_WEEKENDS`, `BOOST_HOLIDAY_SEASON` |
| Lulls | `LULL_SUMMER`, `LULL_WINTER`, `LULL_WEEKENDS`, `LULL_WEEKDAYS` |

### Derived Events

Generate cascading follow-up events from parent events:

```typescript
const fab = new TransactionFabricator({
  seed: "txn",
  annualCount: 500,
  derived: {
    maxDepth: 3,
    rules: [
      {
        name: "refund",
        probability: CHANCE.UNCOMMON,
        timing: { mode: "range", delayMin: 1, delayMax: 30, unit: "days" },
        createDerived: ({ parent, seed, timestamp }) => ({
          id: seed,
          type: "refund",
          amount: -parent.amount,
          timestamp,
          parentId: parent.id,
        }),
      },
    ],
  },
});
```

#### Timing Modes

| Mode | Description |
|------|-------------|
| `fixed` | Exact delay from parent |
| `range` | Random delay within min/max |
| `recurring` | Repeated at interval with `maxRecurrences` or `until` |
| `same-day` | Same day as parent event |

## Utilities

```typescript
import { isUuid, numericSeed, uuidFrom } from "@jaypie/fabricator";

isUuid("550e8400-e29b-41d4-a716-446655440000"); // true
numericSeed("my-string");                        // Deterministic number
uuidFrom("any-value");                           // UUID v5 from string
```
