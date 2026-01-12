---
sidebar_position: 1
---

# Project Structure

**Use this page when:** setting up a new Jaypie monorepo, configuring workspace packages, or understanding project conventions.

**Prerequisites:** Node.js 20+, npm

## Overview

Jaypie projects use npm workspaces in a monorepo structure with shared configuration for TypeScript, ESLint, Vitest, and Vite.

## Directory Structure

```
project/
├── .github/
│   └── workflows/           # CI/CD workflows
├── packages/
│   ├── api/                 # Express API package
│   ├── cdk/                 # CDK infrastructure
│   ├── worker/              # Lambda workers
│   └── shared/              # Shared utilities
├── eslint.config.mjs        # Root ESLint config
├── lerna.json               # Lerna configuration
├── package.json             # Root package.json
├── tsconfig.json            # Root TypeScript config
└── vitest.config.ts         # Root Vitest config
```

## Root Configuration

### package.json

```json
{
  "name": "my-project",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "lerna run build",
    "clean": "lerna run clean",
    "format": "eslint . --fix",
    "format:package": "sort-package-json package.json packages/*/package.json",
    "lint": "eslint .",
    "test": "vitest run",
    "typecheck": "lerna run typecheck"
  },
  "devDependencies": {
    "@jaypie/eslint": "latest",
    "@jaypie/repokit": "latest",
    "@jaypie/testkit": "latest",
    "eslint": "^9.0.0",
    "lerna": "^8.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "vitest": "^2.0.0"
  }
}
```

### lerna.json

```json
{
  "$schema": "node_modules/lerna/schemas/lerna-schema.json",
  "version": "independent",
  "npmClient": "npm"
}
```

### eslint.config.mjs

```javascript
export { default as default } from "@jaypie/eslint";
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "exclude": ["node_modules", "dist"]
}
```

### vitest.config.ts

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/api",
      "packages/worker",
      "packages/shared",
    ],
  },
});
```

## Package Configuration

### Package package.json

```json
{
  "name": "@project/api",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "vite build && tsc --emitDeclarationOnly",
    "clean": "rimraf dist",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

### Package tsconfig.json

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

### Package vite.config.ts

```typescript
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: [/^@aws-sdk/, /^jaypie/, /^@jaypie/],
    },
    outDir: "dist",
    emptyOutDir: true,
  },
});
```

### Package vitest.config.ts

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["@jaypie/testkit/testSetup"],
  },
});
```

## File Naming

| Pattern | Use Case |
|---------|----------|
| `*.ts` | Source files |
| `*.spec.ts` | Test files (sibling to source) |
| `*.route.ts` | Express route handlers |
| `*.router.ts` | Express routers |
| `*.d.ts` | Type declarations |

## Source Structure

```
packages/api/
├── src/
│   ├── app.ts              # Express app
│   ├── handler.ts          # Lambda entry
│   ├── index.ts            # Package exports
│   ├── routers/
│   │   └── v1.router.ts
│   ├── routes/
│   │   ├── health.route.ts
│   │   └── health.route.spec.ts
│   └── utils/
│       ├── db.ts
│       └── db.spec.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

## Commands

### From Root

```bash
# All packages
npm run build              # Build all
npm run test               # Test all
npm run lint               # Lint all
npm run format             # Fix lint issues

# Specific package
npm run build -w packages/api
npm run test -w packages/api
```

### Workspace Selection

```bash
# By path (preferred)
npm install express -w packages/api

# By name
npm install express -w @project/api
```

## Adding Packages

1. Create directory:
   ```bash
   mkdir -p packages/new-package/src
   ```

2. Create package.json (from template)

3. Add to vitest.config.ts projects array

4. Install dependencies:
   ```bash
   npm install -w packages/new-package
   ```

## NPM Scripts Convention

| Script | Purpose |
|--------|---------|
| `build` | Compile TypeScript |
| `clean` | Remove dist |
| `dev` | Development mode |
| `format` | Fix lint issues |
| `format:package` | Sort package.json |
| `lint` | Check lint |
| `test` | Run tests |
| `typecheck` | Check types |

## Related

- [Express on Lambda](/docs/guides/express-lambda) - API package setup
- [CDK Infrastructure](/docs/guides/cdk-infrastructure) - CDK package setup
- [@jaypie/eslint](/docs/packages/eslint) - ESLint configuration
- [@jaypie/repokit](/docs/packages/repokit) - Development tools
