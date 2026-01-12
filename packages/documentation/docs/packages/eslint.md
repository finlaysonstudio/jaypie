---
sidebar_position: 10
---

# @jaypie/eslint


**Prerequisites:** `npm install -D @jaypie/eslint eslint`

## Overview

`@jaypie/eslint` provides an opinionated ESLint flat configuration with Prettier integration for Jaypie projects.

## Installation

```bash
npm install -D @jaypie/eslint eslint
```

## Quick Reference

### Features

| Feature | Description |
|---------|-------------|
| Flat config | ESLint 9+ flat configuration |
| Prettier | Automatic Prettier integration |
| TypeScript | TypeScript support |
| Import sorting | Alphabetized imports |
| Ignored dirs | Ignores `cdk`, `dist` directories |

## Basic Setup

**eslint.config.mjs:**

```javascript
export { default as default } from "@jaypie/eslint";
```

That's it. Run lint:

```bash
npx eslint .
```

## Package Scripts

```json
{
  "scripts": {
    "lint": "eslint .",
    "format": "eslint . --fix"
  }
}
```

## Special Configurations

### Nuxt Projects

```javascript
import jaypie from "@jaypie/eslint";
import nuxt from "@jaypie/eslint/nuxt";

export default [
  ...jaypie,
  ...nuxt,
];
```

### CommonJS Files

For `.cjs` files:

```javascript
import jaypie from "@jaypie/eslint";
import cjs from "@jaypie/eslint/cjs";

export default [
  ...jaypie,
  ...cjs,
];
```

## Included Plugins

| Plugin | Purpose |
|--------|---------|
| `@eslint/js` | Core ESLint rules |
| `eslint-plugin-import-x` | Import/export rules |
| `eslint-config-prettier` | Prettier compatibility |

## Ignored Patterns

By default ignores:

- `**/cdk/**` - CDK output
- `**/dist/**` - Build output
- `**/node_modules/**` - Dependencies

## Key Rules

| Rule | Setting |
|------|---------|
| Semicolons | Required |
| Quotes | Double |
| Trailing commas | Required |
| Import order | Alphabetized |
| Unused vars | Error (except `_` prefix) |

## Override Rules

```javascript
import jaypie from "@jaypie/eslint";

export default [
  ...jaypie,
  {
    rules: {
      "no-console": "warn",
    },
  },
];
```

## Troubleshooting

### ESLint version mismatch

Ensure ESLint 9+:

```bash
npm install -D eslint@latest
```

### Prettier conflicts

The config handles Prettier automatically. If issues persist:

```bash
npm install -D prettier eslint-config-prettier
```

### TypeScript errors

Ensure TypeScript is installed:

```bash
npm install -D typescript
```

## IDE Integration

### VS Code

Install ESLint extension, add to settings:

```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ]
}
```

### Format on Save

```json
{
  "editor.formatOnSave": false,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## Monorepo Setup

Single config at root works for all packages:

```
project/
├── eslint.config.mjs     # Root config
├── packages/
│   ├── api/
│   └── web/
```

## Related

- [Project Structure](/docs/architecture/project-structure) - Monorepo setup
- [@jaypie/repokit](/docs/packages/repokit) - Repository tooling
