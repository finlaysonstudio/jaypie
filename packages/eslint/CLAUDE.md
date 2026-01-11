# @jaypie/eslint

Opinionated ESLint configuration for Jaypie projects using ESLint 9+ flat config format.

## Package Overview

Provides a shareable ESLint configuration that enforces Jaypie coding standards including:
- ESM over CommonJS (with CommonJS support for `.cjs` files)
- Prettier integration
- TypeScript support
- Vitest test file rules
- Vue/Nuxt support

## File Structure

```
packages/eslint/
├── index.js        # Main ESM configuration (default export)
├── index.d.ts      # TypeScript declarations
├── commonjs.js     # Variant: targets .js files as CommonJS
├── nuxt.js         # Variant: for Nuxt projects (no TS block, no Nuxt ignores)
├── __tests__/
│   └── index.spec.js
└── package.json
```

## Exports

| Export | File | Description |
|--------|------|-------------|
| `@jaypie/eslint` | `index.js` | Default ESM config; `.cjs` files treated as CommonJS |
| `@jaypie/eslint/commonjs` | `commonjs.js` | All `.js` files treated as CommonJS |
| `@jaypie/eslint/nuxt` | `nuxt.js` | For Nuxt projects; removes TypeScript and Nuxt ignore blocks |

### Variant Details

- **commonjs.js**: Maps the `jaypie:commonjs` block to target `**/*.js` instead of `**/*.cjs`
- **nuxt.js**: Filters out `jaypie:ignore-nuxt` and `jaypie:typescript` blocks for Nuxt compatibility

## Configuration Blocks

The default export contains these named configuration blocks:

| Name | Purpose |
|------|---------|
| `jaypie:jsRecommended` | ESLint recommended rules |
| `jaypie:importxRecommended` | Import/export linting |
| `jaypie:typescriptRecommended` | TypeScript import resolution |
| `jaypie:ignore-build` | Ignores `dist/`, `cdk.out/` |
| `jaypie:language-options` | ECMAScript 2024, Node globals, ESM |
| `jaypie:rules` | Core rules: no-console warn, require ESM, object-shorthand |
| `jaypie:commonjs` | CommonJS rules for `.cjs` files |
| `jaypie:ignore-nuxt` | Ignores Nuxt packages and `.nuxt/` |
| `jaypie:prettier` | Prettier plugin integration |
| `jaypie:typescript` | TypeScript parser and rules for `.ts`/`.tsx` |
| `jaypie:tests` | Vitest rules for test files |
| `jaypie:vue` | Vue/Prettier integration for `.vue` files |

## Usage in Other Packages

### Standalone (re-export default)

```javascript
// eslint.config.js
export { default as default } from "@jaypie/eslint";
```

### Spread into custom config

```javascript
// eslint.config.js
import jaypie from "@jaypie/eslint";

export default [
  ...jaypie,
  {
    // Additional rules or overrides
  },
];
```

### Monorepo root example

See `/eslint.config.mjs` for how the Jaypie monorepo extends the base config with project-specific overrides for CDK, MCP, and documentation packages.

## Key Rules Enforced

- `no-console`: warn
- `no-restricted-syntax`: error on `require()`, `module.exports`, `exports` in ESM files
- `object-shorthand`: always required
- `@typescript-eslint/no-explicit-any`: off
- `vitest/no-focused-tests`: error

## Commands

```bash
npm run lint        # Lint the package
npm run test        # Run tests (vitest run)
```

## Dependencies

- `eslint` ^9.0.0 (peer)
- `@eslint/js`, `typescript-eslint`, `@typescript-eslint/*`
- `eslint-plugin-import-x`, `eslint-plugin-prettier`, `eslint-plugin-prettier-vue`
- `@vitest/eslint-plugin`
- `globals`

## Monorepo Integration

This package is used by the root `/eslint.config.mjs` which:
1. Spreads the default config as the base
2. Adds global ignores for documentation and local folders
3. Overrides for CDK (CommonJS + Jest), MCP (gray-matter import), and documentation packages

Example from root config:
```javascript
import jaypie from "@jaypie/eslint";
export default [
  ...jaypie,
  { ignores: ["LOCAL/**", "packages/documentation/build/**"] },
  // Package-specific overrides...
];
```
