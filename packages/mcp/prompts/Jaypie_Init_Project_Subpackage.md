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

* Follow Jaypie_Ideal_Project_Structure.md conventions
* Subpackage names follow "@project-org/package-name" pattern (example: "@jaypie/errors")
* Use `"version": "0.0.1"`, `"type": "module"`, and `"private": true`
* Place packages in `packages/<package-name>/` directory
* Build tool: Use Vite for new TypeScript packages (template uses Vite). Some older packages use Rollup.

## Process

1. Create package directory structure:
   ```
   packages/<package-name>/
   ├── src/
   ├── package.json
   └── tsconfig.json
   ```

2. Create template files using Templates_Project_Subpackage.md:
   * Create `packages/<package-name>/package.json` from template
   * Create `packages/<package-name>/tsconfig.json` from template
   * Create `packages/<package-name>/vite.config.ts` from template
   * Create `packages/<package-name>/vitest.config.ts` from template
   * Create `packages/<package-name>/vitest.setup.ts` from template

3. Update package.json:
   * Edit name from "@project-org/project-name" to "@project-org/<package-name>"
   * Keep all other fields as-is from template

4. Create basic src structure:
   * Create `src/index.ts` with basic export
   * Create `src/__tests__/` directory for tests
   * Create `src/__tests__/index.spec.ts` with basic test (use sections: Base Cases, Happy Paths)

5. Update workspace configuration:
   * Add package path to `test.projects` array in root `vitest.config.ts` (format: "packages/<package-name>")
   * Ensure packages are listed explicitly (no wildcards)
   * Example: Add "packages/new-package" to the projects array

6. Install dependencies for the new package:
   * Use `npm install <package-name> --workspace ./packages/<package-name>` to add dependencies
   * Use `npm install <package-name> --workspace ./packages/<package-name> --save-dev` for dev dependencies
   * Never manually edit `package.json` - always use npm commands to maintain package-lock.json

## Context

prompts/Jaypie_Ideal_Project_Structure.md
prompts/Templates_Project_Subpackage.md
package.json
vitest.config.ts
