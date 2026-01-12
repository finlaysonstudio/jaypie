---
sidebar_position: 2
---

# @jaypie/fabricator


**Prerequisites:** `npm install @jaypie/fabricator`

**Status:** Experimental - APIs may change

## Overview

`@jaypie/fabricator` provides deterministic test data generation with seeding support, built on Faker.js with Jaypie conventions.

## Installation

```bash
npm install @jaypie/fabricator
```

## Quick Reference

### Exports

| Export | Purpose |
|--------|---------|
| `Fabricator` | Base class for data generation |
| `fabricator` | Factory function |
| `EventFabricator` | Temporal event generation |
| `CHANCE` | Probability constants |

### CHANCE Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `UNCOMMON` | 0.236 | ~1 in 4 |
| `RARE` | 0.146 | ~1 in 7 |
| `EPIC` | 0.021 | ~1 in 50 |
| `LEGENDARY` | 0.005 | ~1 in 200 |

## Basic Usage

### Create Fabricator

```typescript
import { fabricator } from "@jaypie/fabricator";

const fab = fabricator("seed-123");

fab.person.firstName();  // Always same for seed
fab.person.lastName();
fab.internet.email();
```

### Deterministic Output

```typescript
const fab1 = fabricator("seed-123");
const fab2 = fabricator("seed-123");

fab1.person.firstName() === fab2.person.firstName(); // true
```

## Random Numbers

### Basic Random

```typescript
const fab = fabricator("seed");

fab.random();                    // 0-1
fab.random({ min: 1, max: 100 }); // 1-100
fab.random({ integer: true });   // Whole number
```

### Precision

```typescript
fab.random({ precision: 2 });    // 0.00-1.00
fab.random({ min: 0, max: 100, precision: 2 }); // 0.00-100.00
```

### Normal Distribution

```typescript
fab.random({
  min: 0,
  max: 100,
  distribution: "normal",
  mean: 50,
  stdDev: 15,
});
```

### Currency

```typescript
const price = fab.random({
  min: 10,
  max: 1000,
  precision: 2,
});
// 123.45
```

## Word Generation

### Two-Word Combinations

```typescript
import { Fabricator } from "@jaypie/fabricator";

const fab = new Fabricator("seed");

fab.generate.words();        // "swift eagle"
fab.generate.words(3);       // "swift eagle dance"
```

## Person Generation

### Basic Person

```typescript
const person = fab.generate.person();
// {
//   firstName: "Alice",
//   lastName: "Smith",
//   email: "alice.smith@example.com",
//   phone: "+1-555-123-4567"
// }
```

### With Variations

```typescript
const person = fab.generate.person({
  includeMiddleName: CHANCE.UNCOMMON,
  includeNickname: CHANCE.RARE,
});
```

## Custom Fabricator

### Extend for Domain

```typescript
import { Fabricator } from "@jaypie/fabricator";

class UserFabricator extends Fabricator {
  user() {
    return {
      id: this.string.uuid(),
      name: this.person.fullName(),
      email: this.internet.email(),
      createdAt: this.date.recent(),
      role: this.helpers.arrayElement(["admin", "user", "guest"]),
    };
  }

  users(count: number) {
    return Array.from({ length: count }, () => this.user());
  }
}

const fab = new UserFabricator("seed");
const users = fab.users(10);
```

## Event Fabricator

Generate temporal event sequences.

### Basic Events

```typescript
import { EventFabricator } from "@jaypie/fabricator";

const events = new EventFabricator("seed", {
  startDate: new Date("2024-01-01"),
  endDate: new Date("2024-12-31"),
});

const loginEvents = events.generate({
  type: "login",
  count: 100,
  distribution: "uniform",
});
```

### Weighted Time Distribution

```typescript
const events = events.generate({
  type: "purchase",
  count: 50,
  distribution: "weighted",
  weights: {
    morning: 0.3,    // 6am-12pm
    afternoon: 0.4,  // 12pm-6pm
    evening: 0.25,   // 6pm-10pm
    night: 0.05,     // 10pm-6am
  },
});
```

### Derived Events

Events that follow other events:

```typescript
const purchases = events.generate({
  type: "purchase",
  count: 100,
});

const refunds = events.derive(purchases, {
  type: "refund",
  probability: 0.05,  // 5% of purchases
  delay: { min: 1, max: 30, unit: "days" },
});
```

### Event Templates

```typescript
const events = events.generate({
  type: "order",
  count: 100,
  template: (fab, timestamp) => ({
    id: fab.string.uuid(),
    timestamp,
    amount: fab.random({ min: 10, max: 500, precision: 2 }),
    items: fab.random({ min: 1, max: 5, integer: true }),
  }),
});
```

## Probability Patterns

### Conditional Fields

```typescript
const user = {
  name: fab.person.fullName(),
  email: fab.internet.email(),
  // Include phone ~24% of time
  ...(fab.random() < CHANCE.UNCOMMON && {
    phone: fab.phone.number(),
  }),
};
```

### Weighted Selection

```typescript
const status = fab.helpers.weightedArrayElement([
  { value: "active", weight: 0.7 },
  { value: "pending", weight: 0.2 },
  { value: "inactive", weight: 0.1 },
]);
```

## Faker Access

Access underlying Faker modules:

```typescript
const fab = fabricator("seed");

fab.person.firstName();
fab.person.lastName();
fab.internet.email();
fab.internet.url();
fab.date.recent();
fab.date.past();
fab.string.uuid();
fab.number.int({ min: 1, max: 100 });
```

## Testing Usage

```typescript
describe("User Service", () => {
  const fab = fabricator("test-seed");

  it("creates user", async () => {
    const userData = {
      name: fab.person.fullName(),
      email: fab.internet.email(),
    };

    const user = await createUser(userData);

    expect(user.name).toBe(userData.name);
  });
});
```

## Related

- [@jaypie/testkit](/docs/packages/testkit) - Testing utilities
- [Testing](/docs/guides/testing) - Testing guide
