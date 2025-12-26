# @jaypie/repokit

Essential development utilities bundled for Jaypie repositories. Consolidates common tools needed for build scripts, development workflows, and repository maintenance into a single dependency.

## Package Overview

This package serves as a convenience bundle that:
1. **Re-exports utilities** for programmatic use (`dotenv`, `rimraf`)
2. **Provides CLI tools** as dependencies accessible via `npx` (`env-cmd`, `sort-package-json`, `tsx`)

## Directory Structure

```
packages/repokit/
├── src/
│   ├── index.ts              # Re-exports dotenv and rimraf
│   └── __tests__/
│       └── index.spec.ts     # Verifies exports
├── dist/                     # Built ESM and CJS outputs
├── rollup.config.js          # Dual ESM/CJS build configuration
└── tsconfig.json
```

## Exports

```typescript
// Re-exports all of dotenv
export * from "dotenv";

// Re-exports rimraf function
export { rimraf } from "rimraf";
```

### Usage

```typescript
import { config, rimraf } from "@jaypie/repokit";

// Load environment variables
config();

// Remove directories cross-platform
await rimraf("./dist");
```

## CLI Tools (via npx or scripts)

These dependencies are available for use in package.json scripts:

| Tool | Purpose | Example Usage |
|------|---------|---------------|
| `env-cmd` | Run commands with env file | `env-cmd -f .env.dev node server.js` |
| `sort-package-json` | Sort package.json consistently | `sort-package-json ./package.json` |
| `tsx` | Run TypeScript files directly | `tsx scripts/setup.ts` |
| `rimraf` | Cross-platform rm -rf | `rimraf ./dist` |

## Common Script Patterns

```json
{
  "scripts": {
    "clean": "rimraf ./dist",
    "format:package": "sort-package-json ./package.json",
    "bin:script": "tsx scripts/my-script.ts",
    "start:dev": "env-cmd -f .env.development node server.js"
  }
}
```

## Build Configuration

- Uses Rollup with `@rollup/plugin-typescript`
- Outputs both ESM (`dist/esm/`) and CJS (`dist/cjs/`)
- External dependencies: `dotenv`, `rimraf`, `sort-package-json`, `tsx`

## Integration with Monorepo

The root `package.json` uses repokit's tools:
- `npm run clean` uses `rimraf ./packages/*/dist`
- `npm run format:package` uses `sort-package-json`
- `npm run test:llm:*` scripts use `tsx`

Individual packages include repokit as a devDependency to access these tools.

## Commands

```bash
npm run build      # Build with rollup
npm run test       # vitest run
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run format     # eslint --fix
```

## Why Use Repokit

Instead of installing `dotenv`, `rimraf`, `env-cmd`, `sort-package-json`, and `tsx` individually:
1. **Consistency**: Ensures the same versions across all Jaypie packages
2. **Simplicity**: One dependency instead of five
3. **Maintenance**: Update one package to update all utilities
