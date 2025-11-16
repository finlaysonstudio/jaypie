# @jaypie/fabricator

Seeded, deterministic test data generation built on @faker-js/faker

## Installation

```bash
npm install --save-dev @jaypie/fabricator
```

## Usage

### Basic Usage

```typescript
import { fabricator } from "@jaypie/fabricator";

// Create a fabricator instance
const fab = fabricator();

// Access faker.js API directly
const email = fab.internet.email();
const firstName = fab.person.firstName();
const address = fab.location.streetAddress();
```

### Seeded Generation

For deterministic, reproducible test data:

```typescript
import { fabricator } from "@jaypie/fabricator";

// Create seeded fabricator
const fab = fabricator("my-seed");

// Will always generate the same data with the same seed
const email = fab.internet.email(); // Always the same email
```

### Random Numbers

Generate random numbers with various options:

```typescript
import { fabricator } from "@jaypie/fabricator";

const fab = fabricator("seed");

// Basic random float between 0 and 1
const basic = fab.random();

// Integer between min and max
const integer = fab.random({ min: 1, max: 10, integer: true });

// Normal distribution
const normal = fab.random({ mean: 50, stddev: 10 });

// Currency (2 decimal places)
const price = fab.random({ min: 10, max: 100, currency: true });

// Custom precision
const precise = fab.random({ min: 0, max: 1, precision: 4 });
```

You can also use the standalone `random` function:

```typescript
import { random } from "@jaypie/fabricator";

const rng = random("seed");
const value = rng({ min: 1, max: 100 });
```

### Word Combinations

Generate random word combinations:

```typescript
const fab = fabricator();

// Returns one of three patterns:
// - adjective + noun (e.g., "happy dog")
// - adjective + verb (e.g., "quick run")
// - noun + verb (e.g., "cat jump")
const words = fab.words();
```

### Generate Complex Data

#### Person

Generate realistic person data with probabilistic variations:

```typescript
const fab = fabricator("seed");

const person = fab.generate.person();
// {
//   id: "uuid-v4",
//   firstName: "John",
//   middleName: "Paul",    // may be undefined, lastName, or two names
//   lastName: "Smith",      // may be hyphenated
//   fullName: "John Smith"  // may include middle name
// }

// Use a specific ID for deterministic sub-seeding
const seededPerson = fab.generate.person("550e8400-e29b-41d4-a716-446655440000");
```

Person generation uses these probability rules:
- **firstName**: 2.1% chance to be a lastName instead
- **middleName**:
  - 14.6% chance to be missing
  - 2.1% chance to be a lastName
  - 0.307% chance to have two middle names
- **lastName**: 2.1% chance to be hyphenated (two lastNames)
- **fullName**: 14.6% chance to include middle name

### Constants

Probability constants for custom generation:

```typescript
import { CHANCE } from "@jaypie/fabricator/constants";

const fab = fabricator();

if (fab.number.float() < CHANCE.RARE) {
  // 2.1% chance
}

// Available constants:
// CHANCE.UNCOMMON: 0.146 (14.6%)
// CHANCE.RARE: 0.021 (2.1%)
// CHANCE.EPIC: 0.00307 (0.307%)
// CHANCE.LEGENDARY: 0.000441 (0.0441%)
```

## API

### `fabricator(seed?: string | number): Fabricator`

Creates a new Fabricator instance with optional seeding.

### `Fabricator` Class

The Fabricator class wraps faker.js and provides additional functionality:

- **`faker`**: Direct access to the faker.js instance
- **`random(options?)`**: Generate random numbers with extensive options
- **`words()`**: Generate random word combinations
- **`generate.person(id?)`**: Generate person data with realistic variations
- **All faker.js modules**: Direct access to `airline`, `animal`, `color`, `commerce`, `company`, `database`, `datatype`, `date`, `finance`, `git`, `hacker`, `helpers`, `image`, `internet`, `location`, `lorem`, `music`, `number`, `person`, `phone`, `science`, `string`, `system`, `vehicle`, `word`

### Random Options

```typescript
interface RandomOptions {
  min?: number;           // Minimum value
  max?: number;           // Maximum value (defaults to min*2 if only min provided)
  mean?: number;          // Mean for normal distribution (requires stddev)
  stddev?: number;        // Standard deviation for normal distribution (requires mean)
  integer?: boolean;      // Return integer instead of float
  start?: number;         // Starting offset to add to result
  seed?: string;          // Override seed for this call
  precision?: number;     // Number of decimal places
  currency?: boolean;     // Format as currency (2 decimal places)
}
```

## Exports

### Main Export

```typescript
import { fabricator } from "@jaypie/fabricator";
```

### Named Exports

```typescript
import {
  Fabricator,
  random,
  DEFAULT_MIN,
  DEFAULT_MAX,
} from "@jaypie/fabricator";

import type {
  RandomOptions,
  RandomFunction
} from "@jaypie/fabricator";
```

### Constants Export

```typescript
import { CHANCE } from "@jaypie/fabricator/constants";
```

## License

MIT
