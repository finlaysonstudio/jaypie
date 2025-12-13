---
description: Configuration examples for creating a monorepo using Jaypie conventions
---

# Project Monorepo Configuration Examples

Configuration examples for creating a monorepo project following Jaypie conventions. These examples show the configuration files used in the Jaypie monorepo itself.

## .gitignore

Example based on Jaypie monorepo:

```
.jaypie

cdk.out

.DS_Store
node_modules
dist

# Generated repomix files
/prompts/context

# local env files
.aider*
.env
.env.local
.env.*.local

# Log files
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Editor directories and files
.idea
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

**/.claude/settings.local.json
*.tsbuildinfo
```

## .vscode/settings.json

Add project-specific words to spell checker. Example from Jaypie:

```json
{
  "cSpell.words": [
    "autofix",
    "datadoghq",
    "esmodules",
    "hygen",
    "jaypie",
    "repomix",
    "rollup",
    "supertest",
    "testkit",
    "vite",
    "vitest"
  ]
}
```

## eslint.config.mjs

```javascript
export { default as default } from "@jaypie/eslint";
```

## package.json

Jaypie uses Lerna to run commands across all packages. Individual packages can be targeted using npm workspaces.

```json
{
  "name": "@project-org/project-name",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "lerna run build",
    "clean": "rimraf ./packages/*/dist",
    "format": "npm run format:package && npm run format:lint",
    "format:lint": "eslint --fix --quiet .",
    "format:package": "sort-package-json ./package.json ./packages/*/package.json",
    "lint": "eslint --quiet .",
    "test": "vitest run",
    "typecheck": "npm run typecheck --workspaces"
  },
  "devDependencies": {
    "@jaypie/eslint": "^1.1.0",
    "@jaypie/testkit": "^1.1.0",
    "eslint": "^9.13.0",
    "lerna": "^9.0.0",
    "prettier": "^3.3.3",
    "rimraf": "^6.0.1",
    "rollup": "^4.24.0",
    "sort-package-json": "^3.2.0",
    "vitest": "^3.0.5"
  }
}
```

Notes:
- Use `lerna run build` to build all packages in dependency order
- Use `npm run build --workspace packages/<package>` to build a single package
- Install dependencies with `npm install <package> -w packages/<workspace>`

## lerna.json

```json
{
  "$schema": "node_modules/lerna/schemas/lerna-schema.json",
  "version": "independent"
}
```

## vitest.config.ts

Jaypie uses an explicit project list rather than a glob pattern:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/errors",
      "packages/core",
      // ... list each package explicitly
    ],
  },
});
```

Note: Use explicit package paths instead of `packages/*` to have better control over test execution order.

## Package-Level tsconfig.json

Each TypeScript package needs its own `tsconfig.json`. Example from `@jaypie/errors`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "declaration": true,
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Package-Level rollup.config

### TypeScript Package (Dual ESM/CJS)

For TypeScript packages that need both ESM and CommonJS builds (`@jaypie/errors` pattern):

```javascript
import typescript from "@rollup/plugin-typescript";

export default [
  // ES modules version
  {
    input: "src/index.ts",
    output: {
      dir: "dist/esm",
      format: "es",
      sourcemap: true,
    },
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: true,
        outDir: "dist/esm",
      }),
    ],
    external: [],
  },
  // CommonJS version
  {
    input: "src/index.ts",
    output: {
      dir: "dist/cjs",
      format: "cjs",
      sourcemap: true,
      exports: "named",
      entryFileNames: "[name].cjs",
    },
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        declaration: true,
        outDir: "dist/cjs",
      }),
    ],
    external: [],
  },
];
```

Package.json exports for this pattern:

```json
{
  "exports": {
    ".": {
      "types": "./dist/esm/index.d.ts",
      "require": "./dist/cjs/index.cjs",
      "import": "./dist/esm/index.js",
      "default": "./dist/esm/index.js"
    }
  },
  "main": "./dist/cjs/index.cjs",
  "module": "./dist/esm/index.js",
  "types": "./dist/esm/index.d.ts"
}
```

### JavaScript Package (ESM with CJS fallback)

For JavaScript packages (`@jaypie/core` pattern):

```javascript
import autoExternal from "rollup-plugin-auto-external";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";

export default {
  input: "src/index.js",
  output: [
    {
      file: "dist/package-name.cjs",
      format: "cjs",
    },
    {
      file: "dist/package-name.esm.js",
      format: "esm",
    },
  ],
  plugins: [
    autoExternal(),
    resolve(),
    commonjs(),
  ],
};
```

## Package-Level package.json

Example from `@jaypie/express`:

```json
{
  "name": "@jaypie/express",
  "version": "1.1.18",
  "repository": {
    "type": "git",
    "url": "https://github.com/finlaysonstudio/jaypie"
  },
  "license": "MIT",
  "author": "Finlayson Studio",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/esm/index.d.ts",
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.cjs"
    }
  },
  "main": "./dist/cjs/index.cjs",
  "module": "./dist/esm/index.js",
  "types": "./dist/esm/index.d.ts",
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "rollup --config",
    "format": "npm run format:package && npm run format:lint",
    "format:lint": "eslint --fix .",
    "format:package": "sort-package-json ./package.json",
    "lint": "eslint .",
    "test": "vitest run .",
    "typecheck": "tsc --noEmit"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

Key points:
- Use `"type": "module"` for ESM
- Include only `dist` in published package via `files` field
- Set `publishConfig.access` to "public" for npm publishing
- Scripts use local paths (`.`) not workspace patterns

## Key Differences from Template

The Jaypie monorepo does NOT use:
- Root-level `tsconfig.base.json` or `tsconfig.json` with project references
- `vitest.workspace.js` with glob patterns
- `npm run build --workspaces` (uses `lerna run build` instead)

The Jaypie monorepo DOES use:
- Individual package-level `tsconfig.json` files
- Explicit vitest project list in root `vitest.config.ts`
- Lerna for running commands across packages in dependency order
- npm workspaces for installing dependencies and running individual package commands
