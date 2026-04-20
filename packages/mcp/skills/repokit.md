---
description: Bundled development tooling for Jaypie repositories (dotenv, env-cmd, rimraf, sort-package-json, tsx)
related: monorepo, subpackages, variables
---

# Repokit

`@jaypie/repokit` is a convenience bundle that consolidates common development tooling used across Jaypie repositories into a single devDependency. Install once and get `dotenv`, `env-cmd`, `rimraf`, `sort-package-json`, and `tsx` at consistent versions.

## What Ships

| Tool | Purpose |
|------|---------|
| `dotenv` | Load environment variables from `.env` files (re-exported for programmatic use) |
| `env-cmd` | Run commands with env file loaded (CLI; use in npm scripts) |
| `rimraf` | Cross-platform `rm -rf` (re-exported and available as CLI) |
| `sort-package-json` | Enforce consistent `package.json` key ordering (CLI) |
| `tsx` | Run TypeScript files directly without precompilation (CLI) |

## When to Reach for It

- **Monorepo root devDependency** — single install so every package has access to the same tooling versions
- **Subpackages** — add as a devDependency where build/clean/script tooling is needed
- **Avoid** listing each of the five underlying packages individually — let `@jaypie/repokit` pin them

## Install

```bash
npm install --save-dev @jaypie/repokit
# Or in a monorepo root:
npm install --save-dev @jaypie/repokit -w .
```

## Programmatic Exports

```typescript
import { config, rimraf } from "@jaypie/repokit";

config();                 // dotenv — loads process.env from .env
await rimraf("./dist");   // cross-platform directory removal
```

Re-exports:

- Everything from `dotenv` (`config`, `parse`, `populate`, etc.)
- `rimraf` from `rimraf`

## CLI Usage in `package.json` Scripts

```json
{
  "scripts": {
    "clean": "rimraf ./dist",
    "clean:all": "rimraf ./packages/*/dist",
    "format:package": "sort-package-json ./package.json ./packages/*/package.json",
    "script:setup": "tsx scripts/setup.ts",
    "start:dev": "env-cmd -f .env.development -- node server.js"
  }
}
```

### `env-cmd` — the `--` separator is required

`env-cmd -f <file> -- <command>` passes the env file to the process and runs the command with those variables loaded. **Omit the `--` and env-cmd treats the file as an rc/JSON config instead of a dotenv file, which silently does the wrong thing.**

```bash
# Correct — `.env.dev` is read as a dotenv file
env-cmd -f .env.dev -- node server.js

# Wrong — `.env.dev` is parsed as JSON/rc config; server.js still runs but without env vars
env-cmd -f .env.dev node server.js
```

Use this pattern to load repo-level `.env` files into scripts without hard-coding variables in `package.json`.

### `tsx` — for TypeScript scripts

```bash
tsx scripts/seed.ts
env-cmd -f .env.local -- tsx scripts/seed.ts   # combine with env-cmd
```

### `sort-package-json` — for consistency

Add a `format:package` script and run it before committing, or enforce it in a pre-commit hook.

## Why Not the Five Packages Directly?

- **One devDependency vs five** — fewer entries in `package.json` and `package-lock.json`
- **Pinned versions** — every Jaypie repo using repokit gets the same `dotenv`/`rimraf`/etc. version
- **Easier upgrades** — bump repokit once, all tooling updates together

## See Also

- `skill("monorepo")` — repokit is a recommended devDependency for the monorepo root
- `skill("subpackages")` — use repokit as a devDependency in any package that needs build/clean/script tooling
- `skill("variables")` — pair `env-cmd` with `.env` files to load project environment variables
