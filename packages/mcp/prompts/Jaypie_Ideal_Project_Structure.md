---
description: Specification for an ideal project structure, referenced by monorepo init
---

# Ideal Project Structure 🏆

Specification for an ideal project structure

## ✈️ Overview

* Jaypie project opinions and tooling
* ESLint 9+ with @jaypie/eslint
* NPM with Workspaces ("monorepo")
* TypeScript
* Vite
* Vitest .spec sibling to implementation

## 🧹 ESLint

Only use ESLint 9+ with the flat file config.

```javascript
// eslint.config.mjs
export { default as default } from "@jaypie/eslint";
```

See context/prompts/Jaypie_Eslint_NPM_Package.md for details and troubleshooting.

## 📦 NPM

### Configuration

Follow the naming convention of other subpackages in a monorepo.
Use `"version": "0.0.1"`, `"type": "module"`, and `"private": true` for all newly created package.json
Do not include authors, keywords, external links.

### Dev Dependencies

#### Top-Level

* @jaypie/eslint
* @jaypie/testkit
* eslint
* rimraf
* sort-package-json
* tsx
* vitest

#### Package-Level

Anything particular to that package outside aforementioned.

### Scripts

| Script | Top-level | Sub-packages | Root-level |
| ------ | --------- | ------------ | ---------- |
| `build` | `npm run build --workspaces` | `vite build` | N/A |
| `clean` | `npm run clean --workspaces && npm run clean:root` | `rimfaf dist` | `clean:root` |
| `format` | `eslint --fix` | `eslint --fix` | N/A |
| `format:package` | `sort-package-json ./package.json ./packages/*/package.json` | `sort-package-json` | N/A |
| `lint` | `eslint` | `eslint .` | N/A |
| `test` | `vitest run` | `vitest run` | N/A |
| `typecheck` | `npm run typecheck --workspaces` | `tsc --noEmit` | N/A |

## 🧪 Testing

### Configure Vitest Workspaces

`vitest.workspace.js`
```javascript
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/<package>",
]);
```

See context/prompts/Jaypie_Mocks_and_Testkit.md for details and troubleshooting.