---
description: Template files for creating a new subpackage within a Jaypie monorepo
---

# Project Subpackage Templates

Templates for creating a new subpackage within a Jaypie monorepo.

## package.json

```json
{
  "name": "@project-org/project-name",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "scripts": {
    "build": "vite build",
    "clean": "rimfaf dist",
    "format": "eslint --fix",
    "format:package": "sort-package-json",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest watch",
    "typecheck": "tsc --noEmit"
  }
}
```

## tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": [
    "src"
  ],
  "references": []
}
```

## vite.config.ts

```typescript
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["jaypie"],
    },
  },
  plugins: [
    dts({
      exclude: ["**/*.spec.ts"],
    }),
  ],
});
```

## vitest.config.ts

```typescript
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

## vitest.setup.ts

```typescript
import { matchers } from "@jaypie/testkit";
import { expect, vi } from "vitest";

expect.extend(matchers);

vi.mock("jaypie", async () => vi.importActual("@jaypie/testkit/mock"));
```
