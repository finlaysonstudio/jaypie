---
sidebar_position: 11
---

# @jaypie/repokit


**Prerequisites:** `npm install -D @jaypie/repokit`

## Overview

`@jaypie/repokit` bundles common development tools to reduce dependency duplication across monorepo packages.

## Installation

```bash
npm install -D @jaypie/repokit
```

## Quick Reference

### Bundled Tools

| Tool | Purpose | Command |
|------|---------|---------|
| `dotenv` | Environment variables | `npx dotenv` |
| `env-cmd` | Run with env file | `npx env-cmd` |
| `rimraf` | Cross-platform rm -rf | `npx rimraf` |
| `sort-package-json` | Sort package.json | `npx sort-package-json` |
| `tsx` | TypeScript execution | `npx tsx` |

## Usage

### Environment Variables

Load `.env` file:

```bash
npx dotenv -- node script.js
```

### Run with Env File

```bash
npx env-cmd -f .env.local npm run dev
```

In package.json:

```json
{
  "scripts": {
    "dev": "env-cmd -f .env.local tsx watch src/server.ts"
  }
}
```

### Clean Build Output

```bash
npx rimraf dist
```

In package.json:

```json
{
  "scripts": {
    "clean": "rimraf dist",
    "build": "npm run clean && vite build"
  }
}
```

### Sort package.json

```bash
npx sort-package-json
```

In package.json:

```json
{
  "scripts": {
    "format:package": "sort-package-json"
  }
}
```

### TypeScript Execution

Run TypeScript directly:

```bash
npx tsx src/script.ts
```

Watch mode:

```bash
npx tsx watch src/server.ts
```

## Monorepo Benefits

Install once at root, available to all packages:

```
project/
├── package.json          # Has @jaypie/repokit
├── packages/
│   ├── api/
│   │   └── package.json  # No need for rimraf, tsx, etc.
│   └── worker/
│       └── package.json
```

## Common Scripts

```json
{
  "scripts": {
    "build": "rimraf dist && vite build && tsc --emitDeclarationOnly",
    "clean": "rimraf dist",
    "dev": "env-cmd -f .env.local tsx watch src/server.ts",
    "format:package": "sort-package-json"
  }
}
```

## dotenv-cli vs env-cmd

Both are included. Prefer `env-cmd` for:

- Multiple env files: `env-cmd -f .env.local -f .env.secrets`
- Fallback files: `env-cmd -f .env.local --fallback`

Use `dotenv` for simple cases:

```bash
dotenv -- node script.js
```

## Related

- [@jaypie/eslint](/docs/packages/eslint) - Linting configuration
- [Project Structure](/docs/architecture/project-structure) - Monorepo setup
