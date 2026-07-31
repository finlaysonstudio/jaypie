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
  "include": ["src/**/*", "vitest.setup.ts"]
}
```

`vitest.setup.ts` is in `include` on purpose. It is the file that imports
`@jaypie/testkit`, which is what brings the matcher augmentation for `vitest`
into the program. Leave it out and specs that call `toBeFunction()` without
importing the package themselves pass `npm run test` and fail `npm run
typecheck` with `TS2339: Property 'toBeFunction' does not exist`.

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
import { expect } from "vitest";

expect.extend(jaypieMatchers);
```

`@jaypie/testkit` matchers include the extended matchers (`toBeArray`,
`toBeFunction`, `toBeObject`, `toBeString`, `toStartWith`, etc.), so no separate
`jest-extended` setup is required.

The package ships the matching `vitest` type augmentation, so importing
`@jaypie/testkit` anywhere in the TypeScript program types every matcher.
Keep `vitest.setup.ts` inside the tsconfig `include` shown above; the
augmentation is only in scope for files compiled alongside an import of the
package. Requires `@jaypie/testkit` 1.2.60 or later.

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
npm install @jaypie/testkit --workspace ./packages/<package-name> --save-dev
```

## Workspace Configuration

The root `vitest.config.ts` declares `test.projects` with a glob pattern that auto-discovers packages:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*/vitest.config.{ts,js}"],
  },
});
```

New packages are automatically included when they have a `vitest.config.ts`.

## CI/CD Build Integration

**CRITICAL**: New subpackages must be buildable in CI/CD. The root `npm run build` runs all workspaces via `--workspaces --if-present`, so any package with a `build` script will be included automatically. However:

1. **Ensure `build` script exists** in the new package's `package.json`
2. **If the package is a build dependency of other packages** (e.g., CDK stacks reference `code: "../newpackage/dist"`), add it to `build:core-deps` in the root `package.json` so it builds before dependents
3. **Verify the `dist/` directory is produced** — CDK constructs using `code: "../newpackage/dist"` will fail in CI if the package wasn't built first
4. **Run `npm run build` from the root** to confirm the new package builds in the correct order

Without this, CI/CD will fail with errors like `"../newpackage/dist" doesn't exist`.

## Checklist

After creating a subpackage:

1. ✅ Update package name in `package.json`
2. ✅ Update `name` in `vite.config.ts` build.lib
3. ✅ Add external dependencies to `rollupOptions.external`
4. ✅ Run `npm install` from root to link workspace
5. ✅ Verify with `npm run build -w packages/<package-name>`
6. ✅ Verify with `npm run test -w packages/<package-name>`
7. ✅ Verify `npm run build` from root succeeds (CI/CD order)
8. ✅ If CDK references `dist/`, add to `build:core-deps` in root `package.json`

## Next Steps

- `skill("tests")` - Testing patterns with Vitest
- `skill("mocks")` - Mock patterns via @jaypie/testkit
- `skill("style")` - Code style conventions
