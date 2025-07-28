---
description: Create a subpackage within an existing monorepo project
---

# Jaypie Initialize Project Subpackage

Create a subpackage within an existing monorepo project.

## Goal

* TypeScript subpackage with Vite/Vitest
* Standard Jaypie project structure
* NPM workspace integration
* ESLint configuration inheritance

## Guidelines

* Follow Jaypie_Project_Structure.md conventions
* Subpackage names follow "@project-org/package-name" pattern
* Use `"version": "0.0.1"`, `"type": "module"`, and `"private": true`
* Place packages in `packages/<package-name>/` directory

## Process

1. Create package directory structure:
   ```
   packages/<package-name>/
   ├── src/
   ├── package.json
   └── tsconfig.json
   ```

2. Copy template files:
   * Copy `prompts/templates/project-subpackage/package.json` to `packages/<package-name>/package.json`
   * Copy `prompts/templates/project-subpackage/tsconfig.json` to `packages/<package-name>/tsconfig.json`
   * Copy `prompts/templates/project-subpackage/vite.config.ts` to `packages/<package-name>/vite.config.ts`
   * Copy `prompts/templates/project-subpackage/vitest.config.ts` to `packages/<package-name>/vitest.config.ts`
   * Copy `prompts/templates/project-subpackage/vitest.setup.ts` to `packages/<package-name>/vitest.setup.ts`

3. Update package.json:
   * Edit name from "@project-org/project-name" to "@project-org/<package-name>"
   * Keep all other fields as-is from template

4. Create basic src structure:
   * Create `src/index.ts` with basic export
   * Create `src/index.spec.ts` with basic test

5. Update workspace configuration:
   * Update `references` in root `tsconfig.json`
   * Update `paths` in root `tsconfig.base.json`
   * Add package path to root `vitest.workspace.js`
   * Remove wildcards from `vitest.workspace.js` if present

6. Install requested software:
   * Always use `npm --workspace ./packages/new-package install`
   * Never edit `package.json` from memory

## Context

prompts/prompts/Jaypie_Project_Structure.md
prompts/templates/project-monorepo/tsconfig.base.json
prompts/templates/project-subpackage/package.json
prompts/templates/project-subpackage/tsconfig.json
prompts/templates/project-subpackage/vite.config.ts
prompts/templates/project-subpackage/vitest.config.ts
prompts/templates/project-subpackage/vitest.setup.ts
package.json
tsconfig.json
tsconfig.base.json
vitest.workspace.js
