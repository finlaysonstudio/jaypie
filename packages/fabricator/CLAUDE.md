# @jaypie/fabricator

Seeded, deterministic test data generation library built on @faker-js/faker.

## Overview

This package provides utilities for generating realistic, reproducible test data using faker.js with optional seeding. It wraps faker.js with additional features like seeded random number generation, word combinations, and complex data generators.

## Directory Structure

```
src/
├── index.ts              # Main exports: fabricator(), Fabricator, random, utilities
├── Fabricator.ts         # Core Fabricator class with faker.js proxy and generators
├── WorldFabricator.ts    # Example nested fabricator for generating worlds/cities
├── random.ts             # Seeded random number generation with distribution options
├── constants.ts          # CHANCE probability constants, JAYPIE_FABRICATOR_UUID
└── util/
    ├── index.ts          # Utility exports
    ├── isUuid.ts         # UUID validation
    ├── numericSeed.ts    # String to number seed conversion
    ├── numericSeedArray.ts # String to number array for faker.js seeding
    ├── uuidFrom.ts       # Generate UUID v5 from arbitrary string
    ├── uuidToBytes.ts    # UUID to byte array conversion
    └── uuidToNumber.ts   # UUID to single number conversion
```

## Key Features

### Seeding

Fabricator accepts optional seeds (string or number) for deterministic data generation:

```typescript
const fab = fabricator("my-seed");
// Always generates the same data with the same seed
```

Seeds are converted to numeric arrays for faker.js compatibility via `numericSeedArray()`. If no seed is provided, checks `process.env.PROJECT_SEED` as fallback.

### Fabricator.new() - Nested Fabricators

The static `Fabricator.new(config)` method creates hierarchical fabricators with automatic child methods:

```typescript
const world = Fabricator.new({
  seed: "my-world",
  name: worldNameGenerator,
  fabricators: {
    cities: { name: cityNameGenerator },
    exports: { name: exportNameGenerator }
  }
});

world.cities(5);  // Returns array of 5 city fabricators
world.cities();   // Returns infinite generator
```

### Random Number Generation

The `random()` function provides extensive options:
- Uniform or normal distribution (`mean`/`stddev`)
- Integer or float output (`integer: true`)
- Min/max bounds with validation
- Precision control (`precision`, `currency`)
- Per-call seed overrides (`seed`)
- `start` offset added to result

### Probability Constants

From `@jaypie/fabricator/constants`:
- `CHANCE.UNCOMMON`: 0.146 (14.6%)
- `CHANCE.RARE`: 0.021 (2.1%)
- `CHANCE.EPIC`: 0.00307 (0.307%)
- `CHANCE.LEGENDARY`: 0.000441 (0.0441%)

These are the "golden numbers" used for probabilistic variations.

### Complex Data Generation

The `generate` namespace provides methods for generating complex data:

#### `generate.words()`

Returns random word combinations in three patterns:
- adjective + noun
- adjective + verb
- noun + verb

#### `generate.person(id?)`

Generates person data with probabilistic variations using CHANCE constants:
- `firstName`: RARE chance to be lastName
- `middleName`: UNCOMMON to be missing, RARE to be lastName, EPIC to have two
- `lastName`: RARE chance to be hyphenated
- `fullName`: UNCOMMON chance to include middle name

### Faker.js Proxy

All faker.js modules are directly accessible: `airline`, `animal`, `color`, `commerce`, `company`, `database`, `datatype`, `date`, `finance`, `git`, `hacker`, `helpers`, `image`, `internet`, `location`, `lorem`, `music`, `number`, `person`, `phone`, `science`, `string`, `system`, `vehicle`, `word`

## Exports

### Main Export (`@jaypie/fabricator`)

```typescript
// Factory function (preferred)
export function fabricator(seed?: string | number): Fabricator;
export function fabricator(options: FabricatorOptions): Fabricator;

// Class
export class Fabricator { ... }
export type FabricatorOptions;

// Random
export function random(seed?: string | number): RandomFunction;
export type RandomOptions;
export type RandomFunction;
export const DEFAULT_MIN = 0;
export const DEFAULT_MAX = 1;

// Utilities
export { isUuid, numericSeed, numericSeedArray, uuidFrom, uuidToBytes, uuidToNumber };

// Constants (also exported from main)
export { CHANCE, JAYPIE_FABRICATOR_UUID };
```

### Constants Export (`@jaypie/fabricator/constants`)

```typescript
export const CHANCE = { UNCOMMON, RARE, EPIC, LEGENDARY };
export const JAYPIE_FABRICATOR_UUID;
```

## Development

### Commands

```bash
npm run build       # Build with Vite
npm test            # Run tests (vitest run)
npm run test:watch  # Run tests in watch mode
npm run typecheck   # TypeScript type checking
```

### Dependencies

- **@faker-js/faker**: ^9.3.0 - Realistic fake data generation
- **random**: ^5.4.1 - Seedable random number generation
- **uuid**: ^13.0.0 - UUID generation and parsing
- **@jaypie/errors**: ^1.2.1 - Jaypie error types (ConfigurationError)

## Error Handling

Uses `ConfigurationError` from `@jaypie/errors` for validation errors (e.g., min > max in random bounds).

## Usage in Other Packages

This is a standalone package primarily used for testing. Not currently a dependency of other Jaypie packages but can be added as a devDependency for test data generation.

## Testing Notes

When writing tests using this package:
- Use seeded fabricators for deterministic, reproducible tests
- Access faker.js modules directly through the fabricator proxy
- Use `CHANCE` constants for probabilistic test scenarios
- Consider `WorldFabricator` as an example for building domain-specific fabricators
