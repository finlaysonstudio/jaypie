# @jaypie/fabricator

Seeded, deterministic test data generation library built on @faker-js/faker, following Jaypie conventions.

## Overview

This package provides utilities for generating realistic, reproducible test data using faker.js with optional seeding. It follows Jaypie standards for error handling, testing, and build configuration.

## Architecture

- **Entry point**: `src/index.ts` - Exports fabricator function, Fabricator class, and utilities
- **Core class**: `src/Fabricator.ts` - Main class wrapping faker.js with seeding support
- **Random utilities**: `src/random.ts` - Seeded random number generation with extensive options
- **Utils**: `src/util/` - Seed conversion utilities (numeric seeds, UUID to bytes/numbers)
- **Constants**: `src/constants.ts` - Probability constants (CHANCE)

## Key Features

### Seeding

The fabricator accepts optional seeds (string or number) for deterministic data generation:

```typescript
const fab = fabricator("my-seed");
// Always generates the same data with the same seed
```

Seeds are converted to numeric arrays for faker.js compatibility via `numericSeedArray()`.

### Random Number Generation

The `random()` function provides extensive options:
- Uniform or normal distribution
- Integer or float output
- Min/max bounds with validation
- Precision control (including currency formatting)
- Per-call seed overrides
- Maintains separate RNG instances per seed

### Complex Data Generation

The `generate` namespace provides methods for generating complex, realistic data:

#### `generate.person(id?: string)`

Generates person data with probabilistic variations:
- Creates a seeded sub-faker using UUID for consistent results
- Uses CHANCE constants for realistic variation probabilities:
  - firstName: 2.1% rare chance to be lastName
  - middleName: 14.6% uncommon to be missing, 2.1% rare to be lastName, 0.307% epic to have two
  - lastName: 2.1% rare chance to be hyphenated
  - fullName: 14.6% uncommon to include middle name

### Faker.js Proxy

All faker.js modules are proxied through getters for direct access:
- `airline`, `animal`, `color`, `commerce`, `company`, `database`, `datatype`, `date`
- `finance`, `git`, `hacker`, `helpers`, `image`, `internet`, `location`, `lorem`
- `music`, `number`, `person`, `phone`, `science`, `string`, `system`, `vehicle`, `word`

## Development

### Testing

```bash
npm test              # Run all tests (non-watch mode)
npm run test:watch    # Run tests in watch mode
```

### Building

```bash
npm run build         # Build with Vite
```

### Type Checking

```bash
npm run typecheck     # TypeScript type checking
```

## Standards & Best Practices

### Error Handling

Always use `@jaypie/errors` package (ConfigurationError, etc.) instead of vanilla `Error`.

### Build Configuration

- Uses Vite for building
- Output: ES modules only
- TypeScript declarations generated via `vite-plugin-dts`
- Target: Node 18+

### Testing

- Uses Vitest
- Global test APIs enabled
- Node environment
- Coverage via v8 provider

## Dependencies

- **@faker-js/faker**: ^9.3.0 - Realistic fake data generation
- **random**: ^5.4.1 - Seedable random number generation
- **uuid**: ^13.0.0 - UUID generation and parsing
- **@jaypie/errors**: ^1.1.7 - Jaypie error types (ConfigurationError)

## Implementation Details

### Seed Conversion

Utilities convert seeds to formats required by different libraries:
- `numericSeed(input)`: Converts string to number using char code sum
- `numericSeedArray(input)`: Converts to number array for faker.js (max 10 numbers)
- `uuidToBytes(uuid)`: Converts UUID string to byte array
- `uuidToNumber(uuid)`: Converts UUID to single number

### Error Handling

Uses `ConfigurationError` from `@jaypie/errors` for:
- Invalid bounds in random (min > max)
- Future schema validation errors

### Testing Strategy

Tests are organized by sections:
- Base Cases: Default behavior, empty inputs
- Error Conditions: Validation, boundary errors
- Security: Input sanitization, injection prevention
- Observability: Logging, debugging features
- Happy Paths: Common use cases
- Features: Specific functionality
- Specific Scenarios: Edge cases, complex interactions

## Future Development

Potential expansions:
- Additional generators in `generate` namespace (address, product, organization, etc.)
- Schema-based generation with type safety
- Composable data factories
- Built-in common test data patterns
- Integration with @jaypie/testkit
