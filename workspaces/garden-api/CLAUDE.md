# @jaypie/garden-api

Jaypie Garden streaming API deployed via CDK.

## Purpose

This package provides a streaming Express API for the Jaypie Garden application. It uses `createLambdaStreamHandler` for streaming responses via AWS Lambda Function URLs.

## Directory Structure

```
garden-api/
├── index.ts              # Lambda handler entry point (streaming)
├── src/
│   ├── apikey/           # API key generation, validation, and checksum
│   │   ├── checksum.ts   # Checksum computation and format validation
│   │   ├── generate.ts   # Seed-to-key generation and key hashing
│   │   ├── validate.ts   # Full validation flow with DynamoDB lookup
│   │   └── index.ts      # Barrel export
│   ├── routes/
│   │   └── keyTest.route.ts  # POST /api/key/test endpoint
│   └── app.ts            # Express app configuration
├── tsconfig.json         # TypeScript configuration
└── vitest.config.ts      # Test configuration
```

## Routes

- `GET /` - Returns 204 No Content (health check)
- `ALL /_sy/echo` - Echo route for debugging requests
- `POST /api/key/test` - Validate an API key (Bearer token)
- `ALL *` - Returns 404 Not Found

## API Key System

Keys use format `sk_jaypie_{32 base62 chars}_{4 char checksum}` (47 chars total). The last 4 characters (checksum) serve as a visual hint for key identification. Keys are stored as HMAC-SHA256 hashes (salted with `PROJECT_SALT`) in DynamoDB, never in plaintext.

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
