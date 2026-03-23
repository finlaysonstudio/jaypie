# @jaypie/garden-api

Jaypie Garden streaming API deployed via CDK.

## Purpose

This package provides a streaming Express API for the Jaypie Garden application. It uses `createLambdaStreamHandler` for streaming responses via AWS Lambda Function URLs.

## Directory Structure

```
garden-api/
├── index.ts              # Lambda handler entry point (streaming)
├── src/
│   ├── apikey/           # API key validation
│   │   ├── validate.ts   # Format check + DynamoDB hash lookup
│   │   └── index.ts      # Barrel export
│   ├── routes/
│   │   └── apikeyValidate.route.ts  # POST /apikey/validate endpoint
│   └── app.ts            # Express app configuration
├── tsconfig.json         # TypeScript configuration
└── vitest.config.ts      # Test configuration
```

## Routes

- `GET /` - Returns 204 No Content (health check)
- `ALL /_sy/echo` - Echo route for debugging requests
- `POST /apikey/validate` - Validate an API key (Bearer token), returns `{ data: { createdAt, id, label, name, permissions, scope, valid } }`
- `ALL *` - Returns 404 Not Found

## API Key Validation

Keys are validated by:
1. Format check via `validateJaypieKey(token, { issuer: "jaypie" })`
2. Hash via `hashJaypieKey(token)` — uses `PROJECT_SALT` env var for HMAC-SHA256
3. DynamoDB lookup by alias (hash) on `apikey` model

Keys are created by `@jaypie/garden-ui` at `/api/apikeys`. Both packages must use the same hashing (no explicit salt override — let `hashJaypieKey` read `PROJECT_SALT`).

## Shared Concerns with garden-ui

> **Keep in sync.** The following patterns are duplicated between `garden-api` and `garden-ui`. When changing one, update the other. Consider abstracting shared logic to a `garden-kit` workspace package.

| Concern | garden-api | garden-ui |
|---------|-----------|-----------|
| API key model registration | `src/apikey/validate.ts` | `src/app/api/apikeys/route.ts` |
| API key format validation | `validateJaypieKey({ issuer: "jaypie" })` | same |
| API key hashing | `hashJaypieKey(token)` (PROJECT_SALT) | same |
| User model registration | — | `src/lib/user/upsert.ts` |
| Session model registration | — | `src/lib/session.ts` |

### Candidates for garden-kit

- `apikey` model registration and indexes
- `validateApiKey(token)` — format check + hash + DynamoDB lookup
- `extractToken(authorization)` — Bearer token extraction
- Shared constants (`GARDEN_KEY_OPTIONS`)

## Commands

```bash
npm run dev               # Start dev server on port 8080
npm run build             # Build to dist/
npm run start             # Run production build
npm run test              # Run tests
npm run typecheck         # Type check code
npm run lint              # Lint code
npm run format            # Auto-fix lint issues
```

## Notes

- This package is `private: true` and not published to npm
- Uses `createLambdaStreamHandler` for streaming responses
- Deployed via CloudFront with Function URL origin (streaming: true)
- Secrets loaded: `PROJECT_SALT`
