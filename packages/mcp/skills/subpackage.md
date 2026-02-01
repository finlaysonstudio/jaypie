---
description: Create a subpackage within a monorepo
related: monorepo, tests, style
---

# Jaypie Subpackage Setup

Create a new subpackage within an existing Jaypie monorepo.

## Overview

- TypeScript subpackage with Vite/Vitest
- Standard Jaypie project structure
- NPM workspace integration
- ESLint configuration inheritance

## Guidelines

- Subpackage names follow `@project-org/package-name` pattern
- Use `"version": "0.0.1"`, `"type": "module"`, and `"private": true`
- Place packages in `packages/<package-name>/` directory
- Use Vite for new TypeScript packages
- Never manually edit package.json for dependencies; use npm commands

## Process

1. Create package directory structure
2. Create configuration files from templates
3. Create basic src structure
4. Update workspace configuration
5. Install dependencies

## Directory Structure

```
packages/<package-name>/
├── src/
│   ├── index.ts
│   └── __tests__/
│       └── index.spec.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── vitest.setup.ts
```

## Template Files

### package.json

```json
{
  "name": "@project-org/package-name",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "scripts": {
    "build": "vite build",
    "clean": "rimraf dist",
    "format": "eslint --fix",
    "format:package": "sort-package-json",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest watch",
    "typecheck": "tsc --noEmit"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "exclude": ["node_modules", "dist"],
  "include": ["src/**/*"]
}
```

### vite.config.ts

```typescript
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      include: ["src"],
      exclude: ["**/*.spec.ts"],
    }),
  ],
  build: {
    lib: {
      entry: "./src/index.ts",
      name: "PackageName",
      fileName: "index",
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        // Add external dependencies here
        "jaypie",
      ],
    },
    target: "node22",
  },
});
```

### vitest.config.ts

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

### vitest.setup.ts

```typescript
import { matchers as jaypieMatchers } from "@jaypie/testkit";
import * as extendedMatchers from "jest-extended";
import { expect } from "vitest";

expect.extend(extendedMatchers);
expect.extend(jaypieMatchers);
```

### src/index.ts

```typescript
// Export public API here
export {};
```

### src/__tests__/index.spec.ts

```typescript
import { describe, expect, it } from "vitest";

describe("Package Name", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      // Replace with actual export test
      expect(true).toBe(true);
    });
  });

  describe("Happy Paths", () => {
    it("works", () => {
      // Add happy path tests
      expect(true).toBe(true);
    });
  });
});
```

## Installation Commands

Add dependencies to the subpackage:

```bash
# Runtime dependencies
npm install <package-name> --workspace ./packages/<package-name>

# Dev dependencies
npm install <package-name> --workspace ./packages/<package-name> --save-dev
```

Common dev dependencies for subpackages:

```bash
npm install jest-extended --workspace ./packages/<package-name> --save-dev
```

## Workspace Configuration

The root `vitest.workspace.ts` uses a glob pattern that auto-discovers packages:

```typescript
export default ["packages/*/vitest.config.{ts,js}"];
```

New packages are automatically included when they have a `vitest.config.ts`.

## Checklist

After creating a subpackage:

1. ✅ Update package name in `package.json`
2. ✅ Update `name` in `vite.config.ts` build.lib
3. ✅ Add external dependencies to `rollupOptions.external`
4. ✅ Run `npm install` from root to link workspace
5. ✅ Verify with `npm run build -w packages/<package-name>`
6. ✅ Verify with `npm run test -w packages/<package-name>`

## Next Steps

- `skill("tests")` - Testing patterns with Vitest
- `skill("mocks")` - Mock patterns via @jaypie/testkit
- `skill("style")` - Code style conventions
