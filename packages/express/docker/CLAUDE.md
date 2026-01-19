# Local Lambda Testing Guide

## Purpose

This directory provides local Lambda testing for debugging the `@jaypie/express` adapter without deploying to AWS.

## Testing Methods

### Method 1: Docker Raw Events

Uses the official AWS Lambda Node.js 24 base image with the Runtime Interface Emulator.

**Setup:**
```bash
npm run docker:build
npm run docker:run
```

**Test:**
```bash
npm run docker:invoke         # GET /
npm run docker:invoke:echo    # POST /_sys/echo
npm run docker:invoke:stream  # GET /stream (buffered, not real-time)
npm run docker:invoke:404     # GET /unknown
```

**Debug:** View logs in the container terminal or with `docker logs lambda-test`

### Method 2: SAM Local

Uses AWS SAM CLI to simulate API Gateway with HTTP endpoints.

**Setup:**
```bash
npm run sam:build   # Copies dist/ to docker/, runs sam build
npm run sam:start
```

**Test:**
```bash
curl http://localhost:3000/
curl -X POST http://localhost:3000/_sys/echo -d '{"test":"data"}'
curl http://localhost:3000/stream
```

## File Structure

```
docker/
├── CLAUDE.md           # This file
├── README.md           # User documentation
├── Dockerfile          # Lambda container image
├── handler.mjs         # Test Express app
├── package.json        # Dependencies for SAM build
├── template.yaml       # SAM template
├── events/             # Sample Lambda events
│   ├── api-gateway-v1-get.json
│   ├── api-gateway-v1-post.json
│   ├── api-gateway-v1-stream.json
│   ├── api-gateway-v1-404.json
│   └── function-url-v2.json
├── dist/               # (gitignored) Copied from parent during sam:build
└── .aws-sam/           # (gitignored) SAM build artifacts
```

## Test Handler Pattern

The `handler.mjs` implements:
- `GET /` → 204 No Content (health check)
- `ALL /_sys/echo` → Echoes request details
- `GET /stream` → SSE stream (demonstrates res.write/res.end)
- `*` → 404 Not Found

## Streaming

### Why Real-Time Streaming Doesn't Work Locally

The `createLambdaStreamHandler` uses `awslambda.streamifyResponse()` which only exists in the real AWS Lambda runtime. The Runtime Interface Emulator (RIE) in Docker doesn't include this global.

**What works locally:**
- The `/stream` endpoint demonstrates `res.write()` and `res.end()` working correctly
- Chunks are collected and returned as a single buffered response
- Verifies the streaming code path without real-time delivery

**For real-time streaming:**
- Deploy to AWS with a Lambda Function URL
- Use `streaming: true` in `JaypieDistribution`
- Streaming will work in production even though it can't be tested locally

### Deploying Streaming

```typescript
import { JaypieExpressLambda, JaypieDistribution } from "@jaypie/constructs";

const api = new JaypieExpressLambda(this, "Api", {
  code: "dist/api",
  handler: "index.handler",  // Uses createLambdaStreamHandler
});

new JaypieDistribution(this, "Distribution", {
  handler: api,
  streaming: true,
  host: "api.example.com",
  zone: "example.com",
});
```

## Modifying the Test Handler

1. Edit `handler.mjs`
2. For Docker: `npm run docker:build && npm run docker:run`
3. For SAM: `npm run sam:build && npm run sam:start`

## Event Formats

### API Gateway v1 (REST API)
```json
{
  "httpMethod": "GET",
  "path": "/",
  "headers": {},
  "body": null,
  "isBase64Encoded": false,
  "requestContext": {
    "httpMethod": "GET",
    "path": "/",
    "requestId": "...",
    "stage": "local"
  }
}
```

### Function URL v2
```json
{
  "version": "2.0",
  "rawPath": "/",
  "rawQueryString": "",
  "headers": {},
  "requestContext": {
    "http": {
      "method": "GET",
      "path": "/"
    }
  },
  "routeKey": "$default"
}
```

## Troubleshooting

**Docker build fails:** Ensure `npm run build` runs first (included in `docker:build`)

**SAM can't find dist:** Run `npm run sam:build` which copies dist to docker/

**Module not found errors:** Check that all dependencies are in `docker/package.json`

**Container already running:** `docker stop lambda-test`

## Limitations

- `createLambdaStreamHandler` requires the `awslambda` global (AWS Lambda runtime only)
- Only buffered responses work locally
- SAM Local's API Gateway simulation is lightweight, not full-featured
