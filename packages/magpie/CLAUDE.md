# @jaypie/magpie

Collection of open source utilities re-exported for Jaypie applications.

## Purpose

Magpie collects and re-exports third-party open source packages that are used across multiple Jaypie packages. This provides:

- Consistent versioning of shared dependencies
- Centralized dependency management
- Simplified imports for consumers

## Structure

```
packages/magpie/
├── src/
│   ├── index.ts          # Main exports
│   └── __tests__/        # Unit tests
├── package.json
├── rollup.config.js      # Dual ESM/CJS build config
└── tsconfig.json
```

## Exports

### dotenv

Re-exports the `dotenv` package (pinned to v16.x to avoid ad messages in v17):

```typescript
import { dotenv } from "@jaypie/magpie";

// Use dotenv functions
dotenv.config();
const parsed = dotenv.parse("FOO=bar");
```

Also exports types via `dotenvTypes`:

```typescript
import { dotenvTypes } from "@jaypie/magpie";
```

## Commands

```bash
npm run build      # Build ESM and CJS outputs
npm run test       # Run tests (vitest run)
npm run typecheck  # Type check
npm run lint       # Lint code
npm run format     # Auto-fix lint issues
```

## Adding New Packages

When adding a new open source package to magpie:

1. Add the dependency to `package.json`
2. Export it from `src/index.ts`
3. Add to `external` array in `rollup.config.js`
4. Add basic tests in `src/__tests__/`
5. Update this documentation

## Usage in Other Packages

Currently not imported by other Jaypie packages. Available for use when centralized dependency management is needed.
