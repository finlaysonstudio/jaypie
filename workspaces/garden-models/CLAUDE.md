# @jaypie/garden-models

Shared models, types, and utilities for Jaypie Garden applications.

## Purpose

This package centralizes model registrations, types, constants, and pure utilities shared between `@jaypie/garden-api` and `@jaypie/garden-ui`. Importing from this package registers all models as a side effect via `@jaypie/fabric`.

## Directory Structure

```
garden-models/
├── src/
│   ├── index.ts           # Barrel export (registers all models)
│   ├── apikey/
│   │   ├── index.ts       # Barrel
│   │   ├── model.ts       # Model registration + indexes
│   │   ├── types.ts       # ValidateResult
│   │   └── validate.ts    # validateApiKey, extractToken
│   ├── note/
│   │   ├── index.ts       # Barrel
│   │   ├── model.ts       # Model registration + indexes
│   │   └── types.ts       # NoteEntity
│   ├── session/
│   │   ├── index.ts       # Barrel
│   │   ├── model.ts       # Model registration + indexes + constants
│   │   └── types.ts       # HistoryEvent, SessionEntity
│   └── user/
│       ├── index.ts       # Barrel
│       ├── model.ts       # Model registration + indexes + constants
│       ├── permissions.ts # hasPermission, hasAllPermissions, hasAnyPermission
│       └── types.ts       # UpsertUserInput, UserEntity
└── tsconfig.json
```

## Models

| Model | Vocabulary | Description |
|-------|-----------|-------------|
| apikey | alias (hash), label, name, permissions, scope | API key entities with format validation and DynamoDB lookup |
| note | alias, content, name, scope, xid | Textual notes scoped to a garden, subject referenced via xid |
| session | alias (hash), events, scope, xid | Device session tracking with history events |
| user | alias (email), permissions, scope, xid (auth0 sub) | User entities with Auth0 integration |

## Exports

### Constants
- `APIKEY_MODEL`, `APIKEY_INDEXES` - apikey model name and index definitions
- `COOKIE_MAX_AGE`, `COOKIE_NAME`, `SESSION_MODEL`, `SESSION_PREFIX`, `SESSION_INDEXES` - session constants
- `NOTE_MODEL`, `NOTE_INDEXES` - note model name and index definitions
- `DEFAULT_PERMISSIONS`, `USER_MODEL`, `USER_INDEXES` - user constants
- `GARDEN_KEY_OPTIONS` - `{ issuer: "jaypie" }` for key validation

### Functions
- `validateApiKey(token)` - format check + hash + DynamoDB lookup; throws UnauthorizedError or ForbiddenError
- `extractToken(authorization)` - extract Bearer token from Authorization header
- `hasPermission(permissions, required)` - check single permission with wildcard support
- `hasAllPermissions(permissions, required[])` - check all permissions
- `hasAnyPermission(permissions, required[])` - check any permission

### Types
- `ValidateResult` - apikey validation response shape
- `HistoryEvent`, `SessionEntity` - session model types
- `NoteEntity` - note model type
- `UpsertUserInput`, `UserEntity` - user model types

## Commands

```bash
npm run typecheck         # Type check code
npm run lint              # Lint code
npm run format            # Auto-fix lint issues
npm run test              # Run tests
```
