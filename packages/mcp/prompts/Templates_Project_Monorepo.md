---
description: Template files for initializing a new Jaypie monorepo project
---

# Project Monorepo Templates

Templates for initializing a new Jaypie monorepo project.

## .gitignore

Note: This file is stored as `gitignore` in the templates directory and should be renamed to `.gitignore` when copying.

```
.DS_Store
.env
.jaypie
cdk.out
context.out
dist
local
Local
LOCAL
node_modules
var
```

## .vscode/settings.json

```json
{
  "cSpell.words": [
    "addgroup",
    "adduser",
    "arcxp",
    "autofix",
    "buildvcs",
    "CDKTAG",
    "certificatemanager",
    "cicd",
    "civisibility",
    "clonedeep",
    "codegenie",
    "cogenticat",
    "composables",
    "coreutils",
    "datadoghq",
    "ddsource",
    "ddtags",
    "dnsutils",
    "dushi",
    "e2bdev",
    "ejectability",
    "elif",
    "envsubst",
    "esmodules",
    "Ferdinandi",
    "Finlayson",
    "finlaysonstudio",
    "finstu",
    "finstuapps",
    "fontface",
    "hola",
    "hygen",
    "iconsets",
    "importx",
    "initzero",
    "invokeid",
    "isequal",
    "jaypie",
    "jsonapi",
    "knowdev",
    "knowtrace",
    "modelcontextprotocol",
    "nobuild",
    "npmjs",
    "nuxt",
    "oidc",
    "openmeteo",
    "pinia",
    "pipefail",
    "procps",
    "repomix",
    "retryable",
    "rimfaf",
    "roboto",
    "rollup",
    "sorpresa",
    "ssoins",
    "stddev",
    "subpackages",
    "supertest",
    "testkit",
    "unplugin",
    "vendia",
    "vite",
    "vitest",
    "vuekit",
    "vuetify",
    "wght"
  ]
}
```

## eslint.config.mjs

```javascript
export { default as default } from "@jaypie/eslint";
```

## package.json

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
    "build": "npm run build --workspaces",
    "clean": "npm run clean --workspaces && npm run clean:root",
    "clean:root": "rimraf node_modules package-lock.json",
    "format": "eslint --fix",
    "format:package": "sort-package-json ./package.json ./packages/*/package.json",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest watch",
    "typecheck": "npm run typecheck --workspaces"
  }
}
```

## tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true,
    "composite": true,
    "paths": {
      "@pkg-a/*": ["packages/pkg-a/src/*"],
      "@pkg-b/*": ["packages/pkg-b/src/*"]
    }
  }
}
```

## tsconfig.json

```json
{
  "references": [
    { "path": "packages/pkg-a" },
    { "path": "packages/pkg-b" }
  ]
}
```

## vitest.workspace.js

```javascript
import { defineWorkspace } from "vitest/config";

export default defineWorkspace(["packages/*"]);
```
