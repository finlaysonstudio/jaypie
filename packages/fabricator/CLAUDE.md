# @jaypie/fabricator

A test data generation library built on top of @faker-js/faker, following Jaypie conventions.

## Overview

This package provides utilities for generating realistic test data using faker.js. It follows Jaypie standards for error handling, testing, and build configuration.

## Architecture

- **Entry point**: `src/index.ts` - Exports the main fabricator function
- **Key dependency**: `@faker-js/faker` - Core data generation library

## API

### fabricator()

Main function for generating fabricated test data.

```typescript
import { fabricator } from "@jaypie/fabricator";

const data = fabricator();
```

Currently returns an empty object. Implementation will be expanded to support various data generation patterns.

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

## Future Development

The fabricator function will be expanded to support:
- Customizable data schemas
- Type-safe data generation
- Common data patterns (users, addresses, products, etc.)
- Composable data factories
