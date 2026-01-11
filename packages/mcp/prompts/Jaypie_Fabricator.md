---
description: coding style resource, helpful when stuck on lint errors
globs: packages/fabricator/**
version: 0.3.0
---
# Brief Guide to @jaypie/fabricator

## Overview

`@jaypie/fabricator` is a test data generation library built on top of `@faker-js/faker` that provides deterministic, seeded data generation with additional utilities for randomness and complex data patterns.

## Core Concepts

### 1. The Fabricator Class

The `Fabricator` class wraps faker.js and provides:
- **Deterministic seeding**: Pass a string, number, or UUID to get reproducible test data
- **Direct faker access**: All faker modules are proxied for convenience
- **Enhanced random number generation**: Built-in `random()` function with advanced options
- **Custom generators**: Specialized methods like `words()` and `generate.person()`
- **Unique identifiers**: Each fabricator has an `id` (UUID) and `name` property
- **Nested fabricators**: Support for hierarchical data generation with child fabricators

```typescript
import { fabricator } from "@jaypie/fabricator";

// Create unseeded (random) fabricator
const fab = fabricator();

// Create seeded (deterministic) fabricator
const seededFab = fabricator("my-seed");
const uuidFab = fabricator("550e8400-e29b-41d4-a716-446655440000");

// Access built-in properties
console.log(fab.id);    // UUID
console.log(fab.name);  // Generated name like "Happy Mountain"
```

**Options**:
```typescript
const fab = fabricator("my-seed", {
  name: "Custom Name",  // String or function
  generator: {
    name: ({ fabricator }) => fabricator.faker.person.firstName()
  }
});
```

### 2. Deterministic Seeding

Any string or number can be used as a seed. The same seed always produces the same output:

```typescript
const fab1 = fabricator("test-seed");
const fab2 = fabricator("test-seed");

fab1.faker.person.firstName(); // "Jordan"
fab2.faker.person.firstName(); // "Jordan" (same!)
```

**UUID Seeding**: UUIDs are converted to numeric arrays using `uuidToBytes` for efficient seeding.

**Environment Variable**: Set `PROJECT_SEED` environment variable to provide a default seed for all unseeded fabricators:
```typescript
process.env.PROJECT_SEED = "my-project-seed";
const fab = fabricator(); // Uses PROJECT_SEED
```

### 3. Random Number Generation

The `random()` function provides advanced randomness with multiple distribution types:

**Basic Usage:**
```typescript
fab.random();                                     // 0-1 float
fab.random({ min: 1, max: 10 });                 // 1-10 float
fab.random({ min: 1, max: 10, integer: true });  // 1-10 integer
```

**All Options:**
```typescript
fab.random({
  min: 1,           // Minimum value (default: 0)
  max: 10,          // Maximum value (default: 1)
  integer: true,    // Return integer instead of float (default: false)
  mean: 5,          // For normal distribution
  stddev: 2,        // For normal distribution
  precision: 2,     // Decimal places
  currency: true,   // Shorthand for precision: 2
  start: 100,       // Add offset to result
  seed: "override"  // Override fabricator's seed for this call only
});
```

**Smart Defaults:**
- If only `min` is set, `max` defaults to `min * 2`
- Normal distribution with `mean/stddev` can optionally be clamped by `min/max`

**Common Patterns:**
```typescript
// Currency values
fab.random({ min: 10, max: 1000, currency: true });  // e.g., 542.73

// Percentages
fab.random({ min: 0, max: 100, integer: true });     // e.g., 42

// Weighted random with normal distribution
fab.random({ mean: 50, stddev: 15, min: 0, max: 100 }); // Clusters around 50
```

### 4. Faker Integration

All faker modules are directly accessible through getters:

```typescript
fab.person.firstName();
fab.internet.email();
fab.location.city();
fab.company.name();
// ... all faker modules available
```

### 5. Custom Methods

#### `generate.words()`: Two-Word Combinations
Generates one of three patterns randomly:
- adjective + noun
- adjective + verb
- noun + verb

```typescript
fab.generate.words(); // "happy dog" or "quick run" or "mountain climb"
```

#### `generate.person(id?)`: Complex Person Generator
Creates realistic person data with probabilistic variations:

```typescript
const person = fab.generate.person();
// {
//   id: "uuid",
//   firstName: "Jordan",
//   middleName: "Alex" | undefined,
//   lastName: "Smith" | "Smith-Jones",
//   fullName: "Jordan Smith" | "Jordan Alex Smith"
// }
```

**Probabilistic Rules** (using `CHANCE` constants):
- **firstName**: 2.1% chance (RARE) to be a lastName instead
- **middleName**:
  - 14.6% chance (UNCOMMON) to be missing
  - 2.1% chance (RARE) to be a lastName
  - 0.307% chance (EPIC) to have two middle names
- **lastName**: 2.1% chance (RARE) to be hyphenated
- **fullName**: 14.6% chance (UNCOMMON) to include middle name

**Independent Seeding**: Pass an optional UUID to get deterministic person data that's independent of the parent fabricator's seed:

```typescript
const person1 = fab1.generate.person("same-uuid");
const person2 = fab2.generate.person("same-uuid");
// person1 === person2, regardless of fab1/fab2 seeds
```

### 6. Probability Constants

```typescript
export const CHANCE = {
  UNCOMMON: 0.146,    // ~14.6%
  RARE: 0.021,        // ~2.1%
  EPIC: 0.00307,      // ~0.3%
  LEGENDARY: 0.000441 // ~0.04%
};
```

Use these for consistent probability calculations across your test data.

### 7. Nested Fabricators

Create hierarchical data structures with `Fabricator.new()` and nested configurations:

```typescript
import { Fabricator } from "@jaypie/fabricator";

// Define a nested structure
const world = Fabricator.new({
  seed: "my-world",
  name: ({ fabricator }) => fabricator.location.city(),
  fabricators: {
    cities: {
      name: ({ fabricator }) => fabricator.location.city(),
      fabricators: {
        streets: {
          name: ({ fabricator }) => fabricator.location.street()
        }
      }
    },
    exports: {
      name: ({ fabricator }) => fabricator.commerce.product()
    }
  }
});

// Access nested fabricators
const cities = world.cities(5);  // Array of 5 city fabricators
const cityGen = world.cities();  // Generator for infinite cities

// Access nested child fabricators
const city = cities[0];
const streets = city.streets(10);  // 10 streets for this city
```

**Deterministic Child Seeding**: Child fabricators are seeded deterministically based on their parent's ID and their index, ensuring reproducible hierarchies.

**Generator vs Array**:
- `world.cities()` - Returns a generator for unlimited fabricators
- `world.cities(n)` - Returns an array of exactly n fabricators

## Architecture

### Internal Utilities

- **`numericSeed()`**: Converts strings to numeric seeds using cyrb53 hash
- **`uuidToBytes()`**: Converts UUIDs to byte arrays for seeding
- **`uuidToNumber()`**: Converts UUIDs to single numbers (fallback)
- **`numericSeedArray()`**: Smart converter that detects UUIDs and uses appropriate conversion
- **`uuidFrom()`**: Generates deterministic UUID v5 from string or number using `JAYPIE_FABRICATOR_UUID` as namespace
- **`isUuid()`**: Validates if a string is a properly formatted UUID

## Best Practices & Patterns

### Seeding Strategy

Always tie seeds to fabricator instance ID for determinism with variety:

```typescript
// In parent fabricator method
for (let i = 0; i < count; i++) {
  const seed = `${this.id}-tenant-${i}`;
  tenants.push(new TenantFabricator({ seed, name }));
}

// In child fabricator method
for (let i = 0; i < count; i++) {
  const seed = `${this.id}-merchant-${i}`;
  merchants.push(new MerchantFabricator({ seed, name }));
}
```

**Result:**
- Same fabricator instance → same data (deterministic)
- Different fabricator instance → different data (variety)
- Each entity gets unique seed: `parentId-entityType-index`

### Name Handling Pattern

When passing name functions to child fabricators, pass the function itself (don't call it):

```typescript
// ✅ Correct - parent will invoke function
const name = config?.name ? () => config.name : undefined;
new TenantFabricator({ name, seed });

// ❌ Wrong - calling function too early
const name = config?.name ? config.name : generateName({ fabricator: this });
new TenantFabricator({ name: () => name, seed });
```

The parent Fabricator class invokes name functions lazily when `get name()` is accessed and caches the result.

### Generator Functions

Export generator functions separately for reusability and testability:

```typescript
// Export the generator function
export const generateTenantName = ({ fabricator }: FabricatorNameParams) => {
  const city = fabricator.faker.location.city();
  const suffixes = ["Financial", "Payments", "Commerce"];
  const suffixIndex = Math.floor(fabricator.random() * suffixes.length);
  return `${city} ${suffixes[suffixIndex]}`;
};

// Use in fabricator via generator option
const fab = new Fabricator({
  seed: "my-seed",
  generator: {
    name: generateTenantName
  }
});
```

### Extending Fabricator

Create domain-specific fabricators by extending the base class:

```typescript
import { Fabricator as JaypieFabricator } from "@jaypie/fabricator";

export class TenantFabricator extends JaypieFabricator {
  constructor({
    name,
    seed,
  }: {
    name?: string | ((params: FabricatorNameParams) => string);
    seed?: string | number;
  } = {}) {
    super({
      name,
      seed,
      generator: {
        name: generateTenantName,
      },
    });
  }

  // Add domain-specific methods
  merchants(count: number): MerchantFabricator[] {
    const merchants: MerchantFabricator[] = [];
    for (let i = 0; i < count; i++) {
      merchants.push(new MerchantFabricator({
        seed: `${this.id}-merchant-${i}`
      }));
    }
    return merchants;
  }
}
```

### Common Anti-Patterns

**❌ Don't manage name storage yourself**
```typescript
// Wrong - parent already handles this
private readonly _name: string;
get name(): string {
  return this._name;
}
```
**✅ Right:** Use parent's `get name()` accessor via `generator` option.

**❌ Don't pass index parameters**
```typescript
// Wrong - couples fabricator to sequence position
class TenantFabricator {
  constructor({ index, seed }) {
    this._name = this.generateName(index);
  }
}
```
**✅ Right:** Use constructor config or generator functions.

## Key Design Patterns

1. **Subfaker Pattern**: Complex generators create independent seeded faker instances to ensure deterministic output regardless of parent state
2. **Probabilistic Variations**: Use float rolls with CHANCE constants for realistic data variety
3. **Proxy Access**: All faker modules exposed through getters for ergonomic API
4. **Seed Flexibility**: Accepts strings, numbers, or UUIDs as seeds
5. **Hierarchical Generation**: Nested fabricators enable deterministic tree structures for complex data models
6. **Identity & Naming**: Every fabricator has a unique ID and name for tracking and debugging

## EventFabricator: Temporal Event Generation

### Overview

`EventFabricator` is an abstract base class for generating temporally-distributed events across a year. It builds on `Fabricator` to add:
- Annual event counts with configurable distribution
- Temporal templates for hour, day, week, month, and date weighting
- Timezone-aware hour shifting
- Derived event system for cascading events

### Basic Usage

```typescript
import {
  EventFabricator,
  HOURS_BUSINESS,
  DAYS_WEEKDAYS_ONLY,
  type CreateEventParams,
} from "@jaypie/fabricator";

interface SimpleEvent {
  id: string;
  timestamp: Date;
}

class SimpleEventFabricator extends EventFabricator<SimpleEvent> {
  protected createEvent({ seed, timestamp }: CreateEventParams): SimpleEvent {
    return { id: seed, timestamp };
  }
}

const fab = new SimpleEventFabricator({
  seed: "my-events",
  annualCount: 1000,
  template: [HOURS_BUSINESS, DAYS_WEEKDAYS_ONLY],
});

const events = fab.events({ year: 2025 });
// Returns 1000 events during business hours on weekdays
```

### Temporal Templates

Templates control event distribution. They can be combined:

**Hour Templates:**
- `HOURS_BUSINESS` - 8am-5pm
- `HOURS_RETAIL` - 10am-8pm
- `HOURS_EVENING` - 6pm-10pm
- `HOURS_24_7` - All hours equal

**Day Templates:**
- `DAYS_WEEKDAYS_ONLY` - Mon-Fri only
- `DAYS_NO_SUNDAY` - All but Sunday
- `DAYS_NO_MONDAY` - All but Monday

**Curve Templates (gradual peaks):**
- `CURVE_EVENING_PEAK` - Peaks at 7pm
- `CURVE_ECOMMERCE` - Peaks at 8pm
- `CURVE_MIDDAY_PEAK` - Peaks at 11am

**Spike Templates (sharp peaks):**
- `SPIKE_MORNING` - 7-8am peak
- `SPIKE_LUNCH` - 12-1pm peak
- `SPIKE_EVENING` - 6-7pm peak

**Boost/Lull Templates (multipliers):**
- `BOOST_SUMMER`, `LULL_SUMMER`
- `BOOST_WINTER`, `LULL_WINTER`
- `BOOST_WEEKENDS`, `LULL_WEEKENDS`
- `BOOST_HOLIDAY_SEASON` - Nov-Dec 1.5x

```typescript
const fab = new MyFabricator({
  template: [
    HOURS_BUSINESS,
    DAYS_WEEKDAYS_ONLY,
    BOOST_HOLIDAY_SEASON,
    CURVE_MIDDAY_PEAK,
  ],
});
```

## Derived Events: Cascading Event Generation

### Overview

The derived event system allows events to spawn follow-up events based on probabilistic rules. This is ideal for modeling:
- Financial transactions with voids, refunds, chargebacks
- Subscription renewals with payment retries
- Any event chains with cause-and-effect relationships

### Configuration

```typescript
import {
  EventFabricator,
  CHANCE,
  type DerivedConfig,
  type TimestampedEvent,
} from "@jaypie/fabricator";

interface Transaction extends TimestampedEvent {
  id: string;
  amount: number;
  type: "purchase" | "void" | "refund" | "chargeback";
  parentId?: string;
  timestamp: Date;
}

const derivedConfig: DerivedConfig<Transaction> = {
  rules: [
    {
      name: "void",
      probability: CHANCE.RARE,  // 2.1%
      condition: (parent) => parent.type === "purchase",
      timing: { mode: "same-day" },
      createDerived: ({ parent, seed, timestamp }) => ({
        id: seed,
        type: "void",
        amount: -parent.amount,
        timestamp,
        parentId: parent.id,
      }),
    },
    {
      name: "refund",
      probability: 0.10,  // 10%
      timing: {
        mode: "range",
        delayMin: 1,
        delayMax: 14,
        unit: "days",
      },
      createDerived: ({ parent, seed, timestamp }) => ({
        id: seed,
        type: "refund",
        amount: -parent.amount,
        timestamp,
        parentId: parent.id,
      }),
    },
  ],
  boundaryBehavior: "include",  // include | exclude | clamp
  maxDepth: 4,  // Prevent infinite chains
};
```

### Timing Modes

```typescript
interface DerivedTiming {
  mode: "same-day" | "fixed" | "range" | "recurring";
  delayMin?: number;
  delayMax?: number;
  unit?: "days" | "weeks" | "months" | "hours" | "minutes" | "seconds";
  interval?: number;          // For recurring
  maxRecurrences?: number;    // For recurring
  until?: Date | "end-of-year";
}
```

**Examples:**
- Same day: `{ mode: "same-day" }`
- Fixed delay: `{ mode: "fixed", delayMin: 7, unit: "days" }`
- Range: `{ mode: "range", delayMin: 1, delayMax: 14, unit: "days" }`
- Monthly recurring: `{ mode: "recurring", interval: 1, unit: "months", until: "end-of-year" }`

### Nested Derived Events (Chains)

Derived events can spawn their own derived events:

```typescript
{
  name: "chargeback",
  probability: CHANCE.RARE,
  timing: { mode: "range", delayMin: 30, delayMax: 90, unit: "days" },
  createDerived: ({ parent, seed, timestamp }) => ({
    id: seed,
    type: "chargeback",
    amount: -parent.amount,
    timestamp,
    parentId: parent.id,
  }),
  derived: [  // Nested rules for chargebacks
    {
      name: "representment",
      probability: 0.70,  // 70% of chargebacks
      timing: { mode: "range", delayMin: 7, delayMax: 21, unit: "days" },
      createDerived: ({ parent, seed, timestamp }) => ({
        id: seed,
        type: "representment",
        amount: Math.abs(parent.amount),  // Re-charge
        timestamp,
        parentId: parent.id,
      }),
    },
  ],
}
```

### Using with EventFabricator

```typescript
class TransactionFabricator extends EventFabricator<Transaction> {
  constructor(options = {}) {
    super({
      ...options,
      derived: derivedConfig,
      template: [HOURS_BUSINESS, DAYS_WEEKDAYS_ONLY],
    });
  }

  protected createEvent({ seed, timestamp }: CreateEventParams): Transaction {
    const fab = new Fabricator({ seed });
    return {
      id: seed,
      type: "purchase",
      amount: fab.random({ min: 10, max: 500, currency: true }),
      timestamp,
    };
  }
}

const fab = new TransactionFabricator({
  seed: "my-business",
  annualCount: 1000,
});

// Get all events including derived events
const events = fab.events({ year: 2025 });

// Get events with metadata (parent refs, depth, rule names)
const eventsWithMeta = fab.eventsWithMeta({ year: 2025 });
```

### Event Metadata

`eventsWithMeta()` returns events with relationship data:

```typescript
interface EventWithDerivedMeta<T> {
  event: T;
  depth: number;        // 0 = primary, 1 = first derived, etc.
  parentSeed?: string;  // Seed of parent event
  ruleName?: string;    // Rule that created this derived event
}
```

### Key Properties

1. **Deterministic**: Same seed produces same derived event cascade
2. **Chronological**: All events (primary + derived) sorted by timestamp
3. **Depth-Limited**: `maxDepth` prevents infinite chains
4. **Boundary Control**: Events outside target year can be included, excluded, or clamped
