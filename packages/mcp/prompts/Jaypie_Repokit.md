---
description: development utilities bundle for Jaypie repositories
---

# Jaypie Repokit

Essential development utilities bundled for Jaypie repositories. Provides common tools needed for build scripts, development workflows, and repository maintenance.

## Installation

```sh
npm install --save-dev @jaypie/repokit
```

## Exported Utilities

### dotenv

Re-exports everything from `dotenv` for environment variable management.

```typescript
import { config } from "@jaypie/repokit";

config(); // Load .env file
```

### rimraf

Re-exports `rimraf` for cross-platform file deletion.

```typescript
import { rimraf } from "@jaypie/repokit";

await rimraf("./dist");
```

## CLI Tools (via npx)

The package includes CLI tools as dependencies that can be run via npx or in package.json scripts:

### env-cmd

Run commands with environment variables from a file.

```json
{
  "scripts": {
    "start:dev": "env-cmd -f .env.development node server.js"
  }
}
```

### sort-package-json

Sort package.json files for consistent formatting.

```json
{
  "scripts": {
    "format:package": "sort-package-json ./package.json"
  }
}
```

### tsx

Run TypeScript files directly without compilation.

```json
{
  "scripts": {
    "bin:script": "tsx scripts/my-script.ts"
  }
}
```

## Common Usage Patterns

### Build Scripts

```json
{
  "scripts": {
    "clean": "rimraf ./dist",
    "format:package": "sort-package-json ./package.json",
    "bin:setup": "tsx scripts/setup.ts"
  }
}
```

### Environment Management

```typescript
// scripts/deploy.ts
import { config } from "@jaypie/repokit";

config({ path: ".env.production" });
console.log(process.env.API_KEY);
```

## Why Use Repokit

Instead of installing `dotenv`, `rimraf`, `env-cmd`, `sort-package-json`, and `tsx` individually in each package, install `@jaypie/repokit` once to get all essential development utilities. This ensures consistent versions across all Jaypie repositories.
