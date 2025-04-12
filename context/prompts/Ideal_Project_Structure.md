# Ideal Project Structure 🏆

Specification for an ideal project structure

## ✈️ Overview

* ESLint + Prettier
* NPM with Workspaces ("monorepo")
* TypeScript
* Vite
* Vitest

## 🚦 Parking Lot

Jaypie

* Linting

NPM Scripts

| Script | Top-level | Sub-packages | Root-level |
| ------ | --------- | ------------ | ---------- |
| `build` | `npm run build --workspaces` | `vite build && tsc --emitDeclarationOnly` | N/A |
| `clean` | `npm run clean --workspaces && npm run clean:root` | `rimfaf dist` | `clean:root` |
| `format` | `eslint --fix .` | `eslint --fix .` | N/A |
| `lint` | `eslint .` | `eslint .` | N/A |
| `test` | `vitest run` | `vitest run` | N/A |
| `test:watch` | `vitest watch` | `vitest watch` | N/A |
| `test:<package>:watch` | `npm run test:watch --workspace packages/<package>` |  | N/A |
| `typecheck` | `npm run typecheck --workspaces` |  | N/A |

NPM Dev Dependencies

* eslint - root
* vitest - root

Setup Steps

* Install rimraf
* Customize scripts
* Missing inits: .gitignore, dictionary
* bin:change / new:change

Testing

* Tests side-by-side or in subdirectory?

Utilities

* rimraf
* sort-package-json
* tsx
