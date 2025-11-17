---
description: coding style resource, helpful when stuck on lint errors
globs: packages/fabricator/**
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

```typescript
import { fabricator } from "@jaypie/fabricator";

// Create unseeded (random) fabricator
const fab = fabricator();

// Create seeded (deterministic) fabricator
const seededFab = fabricator("my-seed");
const uuidFab = fabricator("550e8400-e29b-41d4-a716-446655440000");
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

### 3. Random Number Generation

The `random()` function provides advanced randomness with multiple distribution types:

**Basic Usage:**
```typescript
fab.random();                          // 0-1 float
fab.random({ min: 1, max: 10 });      // 1-10 float
fab.random({ min: 1, max: 10, integer: true }); // 1-10 integer
```

**Advanced Options:**
- `min/max`: Bounds (defaults: 0-1)
- `integer`: Return integers (default: false)
- `mean/stddev`: Normal distribution
- `precision`: Decimal places
- `currency`: Shorthand for precision: 2
- `start`: Add offset to result
- `seed`: Override the fabricator's seed for this call only

**Smart Defaults:**
- If only `min` is set, `max` defaults to `min * 2`
- Normal distribution with `mean/stddev` can optionally be clamped by `min/max`

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

#### `words()`: Two-Word Combinations
Generates one of three patterns randomly:
- adjective + noun
- adjective + verb
- noun + verb

```typescript
fab.words(); // "happy dog" or "quick run" or "mountain climb"
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

## Architecture

### Internal Utilities

- **`numericSeed()`**: Converts strings to numeric seeds using cyrb53 hash
- **`uuidToBytes()`**: Converts UUIDs to byte arrays for seeding
- **`uuidToNumber()`**: Converts UUIDs to single numbers (fallback)
- **`numericSeedArray()`**: Smart converter that detects UUIDs and uses appropriate conversion

## Key Design Patterns

1. **Subfaker Pattern**: Complex generators create independent seeded faker instances to ensure deterministic output regardless of parent state
2. **Probabilistic Variations**: Use float rolls with CHANCE constants for realistic data variety
3. **Proxy Access**: All faker modules exposed through getters for ergonomic API
4. **Seed Flexibility**: Accepts strings, numbers, or UUIDs as seeds

## Usage in @entpayco/fabricator

Your wrapper package should:
- Extend or compose `Fabricator` from `@jaypie/fabricator`
- Add domain-specific generators (payments, accounts, transactions, etc.)
- Follow the same patterns: seeding, probabilistic variations, subfaker for complex objects
- Maintain the same function signature standards (single param, config object, or optional config)

---

Ready to build domain-specific test data generators on this foundation!
