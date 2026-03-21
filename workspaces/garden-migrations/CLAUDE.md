# @jaypie/garden-migrations

DynamoDB migrations for the Jaypie Garden application, deployed as a CDK Custom Resource Lambda.

## Purpose

Runs numbered, idempotent migrations on each CDK deploy. Each migration checks for an existing migration record in DynamoDB before applying. Migrations and their seeded data are written atomically via `transactWriteEntities`.

## Directory Structure

```
garden-migrations/
├── cli.ts                                # CLI entry point for local/on-demand use
├── index.ts                              # Lambda handler (CloudFormation Custom Resource)
├── src/
│   ├── runner.ts                         # Sequential migration runner
│   ├── migrations/
│   │   ├── index.ts                      # Ordered migration array
│   │   └── 001-seed-owner-apikey.ts      # Seed bootstrap owner API key
│   └── __tests__/
│       ├── runner.spec.ts
│       └── 001-seed-owner-apikey.spec.ts
├── esbuild.config.mjs
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── vitest.setup.ts
```

## Adding a Migration

1. Create `src/migrations/NNN-description.ts` following the `Migration` interface:
   - `id`: unique string (e.g., `"002-seed-sessions"`)
   - `apply()`: returns `StorableEntity[]` to write alongside the migration record
2. Add to the ordered array in `src/migrations/index.ts`
3. Write tests in `src/__tests__/NNN-description.spec.ts`

## Commands

```bash
npm run build     # Bundle to dist/index.mjs via esbuild
npm run migrate   # Run migrations locally (reads .env)
npm run test      # Run tests
npm run typecheck # Type check
npm run lint      # Lint
npm run format    # Auto-fix lint
```

From the monorepo root:

```bash
npm run dynamo:init      # Start DynamoDB, create table, run migrations
npm run dynamo:migrate   # Run migrations only (DynamoDB must be running)
```

## Notes

- This package is `private: true` and not published to npm
- Deployed via `JaypieMigration` CDK construct in `GardenDataStack`
- Uses `lambdaHandler` from `jaypie` for lifecycle management
- Secrets loaded: `PROJECT_ADMIN_SEED`
