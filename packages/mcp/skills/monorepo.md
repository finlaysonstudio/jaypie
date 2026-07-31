---
description: Initialize a Jaypie monorepo project
related: subpackage, cicd, repokit, style, tests
---

# Jaypie Monorepo Setup

Initialize a new monorepo using Jaypie conventions and utilities.

## Overview

- ESLint 9 or 10 flat config with @jaypie/eslint
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

### vitest.config.ts

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*/vitest.config.{ts,js}"],
  },
});
```

Vitest 3 deprecated `vitest.workspace.ts` and Vitest 4 removed it. A root workspace file is silently ignored on current Vitest; declare projects with `test.projects` instead.

### .gitignore

```
.DS_Store
.env
.env.*.local
.env.local
.env.local.*
.jaypie
.next
.open-next
*.tsbuildinfo
build/
cdk.context.json
cdk.out
dist
LOCAL
next-env.d.ts
node_modules
npm-debug.log*
var
```

## Installation

Install root dev dependencies:

```bash
npm install --save-dev @jaypie/eslint @jaypie/repokit @jaypie/testkit eslint vite vite-plugin-dts vitest
```

`@jaypie/repokit` bundles `env-cmd`, `rimraf`, `sort-package-json`, and `tsx` at consistent versions. See `skill("repokit")`.

## Workspace Conventions

| Directory | Purpose |
|-----------|---------|
| `packages/` | npm packages (default workspace) |
| `workspaces/` | CDK-deployed infrastructure and sites |

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

### File Systems

- bin: scripts
- docs: markdown, etc
- etc: configurations
- lib: usually within a src directory, modules of encapsulated logic that could be refactored out later
- LOCAL: human local scratch directory, include in gitignore
- packages: default and preferred name for NPM workspaces; always use for packages publishing to NPM
- stacks: allowed name for NPM workspaces that publish via CDK
- templates: usually CloudFormation
- workspaces: allowed name for NPM workspace that do not publish
- var: agent and machine local scratch directory, include in gitignore

### Discouraged Folder Names

- scripts => bin

### Example

```
bin/
packages/
  cdk/
  express/
    src/
      lib/
      app.ts
      index.ts
package.json
```

## Next Steps

- `skill("subpackage")` - Create packages within the monorepo
- `skill("cicd")` - Add GitHub Actions workflows
- `skill("tests")` - Testing patterns with Vitest
