---
description: Monorepo setup using Jaypie conventions and utilities
---

# Jaypie Initialize Monorepo Project

Monorepo setup using Jaypie conventions and utilities

## Goal

* Jaypie project opinions and tooling
* ESLint 9+ flat config with @jaypie/eslint
* NPM with Workspaces ("monorepo")
* TypeScript
* Vite and Vitest

## Guidelines

* This guide should compliment Jaypie_Project_Structure.md. The two should not conflict. Raise any conflicts with the user.
* Run `npm install` to get the latest version of all software and generate a package-lock.json. Do not hard-code package versions from memory.
* If this is the very first commit, you should make it on main. This is the only time a commit should be made and pushed on main.

## Process

1. Copy all the files from `prompts/templates/project-monorepo/` to the root directory
2. Edit name in "@project-org/project-name" based on user instruction or infer from the directory name
3. Remove the sample paths from tsconfig.base.json
4. Remove the sample references from tsconfig.json
5. Install requisite packages

```bash
npm install --save-dev @jaypie/eslint @jaypie/testkit eslint rimraf sort-package-json tsx vite vite-plugin-dts vitest
```

## Context

prompts/Jaypie_Ideal_Project_Structure.md
prompts/templates/project-monorepo/.gitignore
prompts/templates/project-monorepo/.vscode/settings.json
prompts/templates/project-monorepo/eslint.config.mjs
prompts/templates/project-monorepo/package.json
prompts/templates/project-monorepo/tsconfig.base.json
prompts/templates/project-monorepo/tsconfig.json
prompts/templates/project-monorepo/vitest.workspace.js
