# @jaypie/garden-api

Jaypie Garden streaming API deployed via CDK.

## Purpose

This package provides a streaming Express API for the Jaypie Garden application. It uses `createLambdaStreamHandler` for streaming responses via AWS Lambda Function URLs.

## Directory Structure

```
garden-api/
├── index.ts              # Lambda handler entry point (streaming)
├── src/
│   └── app.ts           # Express app configuration
├── tsconfig.json        # TypeScript configuration
└── vitest.config.ts     # Test configuration
```

## Routes

- `GET /` - Returns 204 No Content (health check)
- `ALL /_sy/echo` - Echo route for debugging requests
- `ALL *` - Returns 404 Not Found

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
