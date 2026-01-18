# Local Lambda Testing for @jaypie/express

Local Docker environment that mimics AWS Lambda for testing the Express adapter.

## Quick Start

### Method 1: Docker Raw Events

Best for debugging event parsing and response handling.

```bash
# From packages/express directory
npm run docker:build    # Build the Lambda image
npm run docker:run      # Run container (Terminal 1)

# In another terminal
npm run docker:invoke         # GET / → 204
npm run docker:invoke:echo    # POST /_sys/echo → echoes request
npm run docker:invoke:stream  # GET /stream → buffered SSE response
npm run docker:invoke:404     # GET /unknown → 404
npm run docker:invoke:v2      # Function URL v2 format
```

### Method 2: SAM Local HTTP

Best for testing with real HTTP requests like curl or Postman.

```bash
# From packages/express directory
npm run sam:build       # Build with SAM (required first)
npm run sam:start       # Start HTTP server (Terminal 1)

# In another terminal
curl http://localhost:3000/
curl -X POST http://localhost:3000/_sys/echo -H 'Content-Type: application/json' -d '{"test":"data"}'
curl http://localhost:3000/stream
```

### Method 3: Lambda Web Adapter (Real Streaming)

Best for testing real-time streaming responses locally.

```bash
# From packages/express directory
node docker/handler-lwa.mjs

# In another terminal - watch streaming in real-time
curl -N http://localhost:8000/stream?seconds=6
```

This runs Express as a real HTTP server, exactly how it runs in AWS with Lambda Web Adapter.

## Test Handler

The test handler (`handler.mjs`) implements a common server pattern:

| Endpoint | Method | Response |
|----------|--------|----------|
| `/` | GET | 204 No Content (health check) |
| `/_sys/echo` | ALL | Echoes body, headers, method, path, query |
| `/stream` | GET | SSE stream with `?seconds=N` param (default 6) |
| `*` | ALL | 404 Not Found |

## Streaming

### Why Streaming Doesn't Work in Docker/RIE

The `createLambdaStreamHandler` uses `awslambda.streamifyResponse()` which only exists in the real AWS Lambda runtime. The Docker Runtime Interface Emulator (RIE) doesn't include this global.

### Two Approaches to Lambda Streaming

| Approach | Local Testing | Real-Time Streaming |
|----------|---------------|---------------------|
| `createLambdaStreamHandler` | No (`awslambda` global missing) | Yes (Function URL) |
| Lambda Web Adapter (`app.listen`) | Yes (`node handler-lwa.mjs`) | Yes (LWA layer) |

### Deploying Real Streaming

Use `JaypieStreamingLambda` from `@jaypie/constructs`:

```typescript
import { JaypieStreamingLambda, JaypieDistribution } from "@jaypie/constructs";

const streamingApi = new JaypieStreamingLambda(this, "StreamingApi", {
  code: "dist/api",
  handler: "run.sh",  // Script that runs: exec node handler.mjs
  streaming: true,    // Enables RESPONSE_STREAM invoke mode
});

new JaypieDistribution(this, "Distribution", {
  handler: streamingApi,
  host: "api.example.com",
  zone: "example.com",
});
```

## Event Files

Sample Lambda events in `events/`:

- `api-gateway-v1-get.json` - API Gateway REST API GET request
- `api-gateway-v1-post.json` - API Gateway REST API POST to /_sys/echo
- `api-gateway-v1-stream.json` - API Gateway REST API GET to /stream
- `api-gateway-v1-404.json` - API Gateway REST API GET to unknown path
- `function-url-v2.json` - Lambda Function URL v2 format

## Custom Testing

### Send Custom Events (Docker)

```bash
curl -X POST 'http://localhost:9000/2015-03-31/functions/function/invocations' \
  -H 'Content-Type: application/json' \
  -d '{
    "httpMethod": "POST",
    "path": "/_sys/echo",
    "headers": {"content-type": "application/json"},
    "body": "{\"custom\": \"data\"}",
    "isBase64Encoded": false,
    "requestContext": {
      "accountId": "123456789012",
      "apiId": "test",
      "httpMethod": "POST",
      "identity": {"sourceIp": "127.0.0.1"},
      "path": "/_sys/echo",
      "protocol": "HTTP/1.1",
      "requestId": "test",
      "stage": "local"
    }
  }'
```

### View Container Logs

```bash
docker logs lambda-test
```

## Requirements

- Docker
- AWS SAM CLI (for Method 2): `brew install aws-sam-cli`
- Node.js (for Method 3 local streaming)

## Notes

- Docker method uses port 9000, SAM uses port 3000, LWA uses port 8000
- The `/stream` endpoint in Docker returns a buffered response (all chunks at once)
- For real-time streaming, use Lambda Web Adapter approach (Method 3)
