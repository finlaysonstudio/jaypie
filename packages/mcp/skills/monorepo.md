---
description: Initialize a Jaypie monorepo project
related: subpackage, cicd, style, tests
---

# Jaypie Monorepo Setup

Initialize a new monorepo using Jaypie conventions and utilities.

## Overview

- ESLint 9+ flat config with @jaypie/eslint
- NPM with Workspaces ("monorepo")
- TypeScript with ESM modules
- Vite for building, Vitest for testing
- Node.js 22, 24, 25 support

## Process

1. Create root configuration files
2. Install dev dependencies
3. Configure workspaces

## Root Files

### package.json

```json
{
  "name": "@project-org/monorepo",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "clean": "rimraf ./packages/*/dist",
    "format": "npm run format:package && npm run format:lint",
    "format:lint": "eslint --fix .",
    "format:package": "sort-package-json ./package.json ./packages/*/package.json",
    "lint": "eslint --quiet .",
    "test": "vitest run",
    "typecheck": "npm run typecheck --workspaces --if-present"
  }
}
```

### eslint.config.mjs

```javascript
export { default } from "@jaypie/eslint";
```

For projects needing custom rules:

```javascript
import jaypie from "@jaypie/eslint";

export default [
  ...jaypie,
  {
    ignores: ["LOCAL/**"],
  },
];
```

### tsconfig.json (root)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "exclude": ["node_modules", "dist"]
}
```

### vitest.workspace.ts

```typescript
export default ["packages/*/vitest.config.{ts,js}"];
```

### .gitignore

```
.DS_Store
node_modules
dist

# Local env files
.env
.env.local
.env.*.local

# Log files
npm-debug.log*

# Editor directories
.idea
*.sw?

# Build artifacts
*.tsbuildinfo
```

### .vscode/settings.json

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

## Installation

Install root dev dependencies:

```bash
npm install --save-dev @jaypie/eslint @jaypie/testkit eslint rimraf sort-package-json tsx vite vite-plugin-dts vitest
```

## Workspace Conventions

| Directory | Purpose |
|-----------|---------|
| `packages/` | npm packages (default workspace) |
| `stacks/` | CDK-deployed infrastructure and sites |

## Scripts Reference

| Script | Top-level | Package-level |
|--------|-----------|---------------|
| `build` | `npm run build --workspaces` | `vite build` |
| `clean` | `rimraf ./packages/*/dist` | `rimraf dist` |
| `format` | `eslint --fix .` | `eslint --fix` |
| `format:package` | `sort-package-json ./package.json ./packages/*/package.json` | `sort-package-json` |
| `lint` | `eslint --quiet .` | `eslint` |
| `test` | `vitest run` | `vitest run` |
| `typecheck` | `npm run typecheck --workspaces` | `tsc --noEmit` |

## Guidelines

- Run `npm install` to generate package-lock.json (do not hard-code versions)
- Use `"version": "0.0.1"`, `"type": "module"`, and `"private": true` for new packages
- Do not include authors, keywords, or external links in package.json
- If this is the first commit, commit directly to main; otherwise create a branch

## Next Steps

- `skill("subpackage")` - Create packages within the monorepo
- `skill("cicd")` - Add GitHub Actions workflows
- `skill("tests")` - Testing patterns with Vitest
