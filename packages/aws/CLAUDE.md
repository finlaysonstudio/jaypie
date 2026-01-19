# @jaypie/aws

AWS service integrations for Jaypie applications running on Lambda.

## Overview

This package provides utilities for:
- **Secrets Management**: Fetching secrets from AWS Secrets Manager
- **SQS Messaging**: Sending and receiving messages from SQS queues
- **Textract**: OCR document processing via AWS Textract
- **Streaming**: SSE and NLJSON streaming for Lambda and Express

## Directory Structure

```
src/
├── __tests__/              # Test files
├── streaming/
│   └── JaypieStream.ts     # SSE streaming utilities
├── getEnvSecret.function.ts    # Fetch secret using env var patterns
├── getMessages.function.ts     # Parse SQS/SNS event messages
├── getSecret.function.ts       # Direct secret fetch by name
├── getSingletonMessage.function.ts  # Get exactly one message or throw
├── getTextractJob.function.ts  # Get Textract job results
├── loadEnvSecrets.function.ts  # Batch load secrets to process.env
├── sendBatchMessages.function.ts   # Send multiple SQS messages
├── sendMessage.function.ts     # Send single SQS message
├── sendTextractJob.function.ts # Start Textract job
├── validateQueueUrl.util.ts    # SQS URL validation
└── index.ts                # Package exports
```

## Exports

### Secrets

| Export | Description |
|--------|-------------|
| `getSecret(name)` | Fetch secret directly by AWS secret name |
| `getEnvSecret(name, { env? })` | Fetch secret using env var patterns (`SECRET_X`, `X_SECRET`, or `X`) |
| `loadEnvSecrets(...names)` | Load multiple secrets and set in `process.env` |

### SQS Messaging

| Export | Description |
|--------|-------------|
| `sendMessage(body, { queueUrl?, ... })` | Send single message to SQS |
| `sendBatchMessages({ messages, queueUrl?, ... })` | Send up to n messages (batched in groups of 10) |
| `getMessages(event)` | Parse SQS/SNS event into array of message bodies |
| `getSingletonMessage(event)` | Get exactly one message or throw `BadGatewayError` |

### Textract

| Export | Description |
|--------|-------------|
| `sendTextractJob({ bucket, key, ... })` | Start async Textract job |
| `getTextractJob(jobId)` | Get results of completed Textract job |

### Streaming

| Export | Description |
|--------|-------------|
| `JaypieStream` | Class wrapping async iterable with streaming methods |
| `createJaypieStream(source)` | Factory for JaypieStream |
| `createLambdaStream(stream, writer)` | Stream to Lambda response writer |
| `createExpressStream(stream, res)` | Stream to Express response |
| `formatSse(chunk)` | Format chunk as SSE event string |
| `formatNljson(chunk)` | Format chunk as NLJSON string |
| `formatStreamError(errorBody, format)` | Format error based on stream format |
| `formatStreamErrorSse(errorBody)` | Format error as SSE event |
| `formatStreamErrorNljson(errorBody)` | Format error as NLJSON |
| `getContentTypeForFormat(format)` | Get content type for stream format |
| `streamToSse(stream)` | Convert async iterable to SSE strings |

### Types

```typescript
ExpressStreamResponse
LambdaStreamWriter
SseEvent
StreamChunk
StreamFormat  // "sse" | "nljson"
```

## Usage in Other Packages

### @jaypie/lambda, @jaypie/express
Uses `loadEnvSecrets` to load secrets during handler initialization. Also uses `formatStreamError`, `getContentTypeForFormat` for streaming handlers.

### @jaypie/llm
Uses `getEnvSecret` to fetch API keys for LLM providers (Anthropic, OpenAI, Gemini, OpenRouter).

### @jaypie/mongoose
Uses `getSecret` for database connection string retrieval.

### @jaypie/datadog
Uses `getSecret` to fetch Datadog API keys.

### jaypie (main package)
Re-exports all `@jaypie/aws` exports.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AWS_SESSION_TOKEN` | Required for secrets access |
| `CDK_ENV_QUEUE_URL` | Default SQS queue URL |
| `PROJECT_KEY` | Used for FIFO queue message group ID |
| `PARAMETERS_SECRETS_EXTENSION_HTTP_PORT` | Lambda layer port (default: 2773) |

## Secrets Resolution

The `getEnvSecret` function checks environment variables in order:
1. `SECRET_{name}` - Explicit secret reference
2. `{name}_SECRET` - Alternative secret reference
3. `{name}` - Direct value

If a `SECRET_` or `_SECRET` pattern is found, fetches from AWS Secrets Manager. Otherwise returns the direct value.

## AWS SDK Fallback

Secret functions first attempt the Lambda Parameters and Secrets Extension (faster, cached). On failure, falls back to direct AWS SDK calls.

## Testing

Mock implementations are provided in `@jaypie/testkit`:

```typescript
import { getSecret, sendMessage } from "@jaypie/testkit/mock";
```

## Commands

```bash
npm run build     # Build package
npm run test      # Run tests
npm run typecheck # Type check
npm run lint      # Lint code
npm run format    # Auto-fix lint issues
```

## Peer Dependencies

- `@jaypie/errors` - Error types
- `@jaypie/kit` - Core utilities
- `@jaypie/logger` - Logging
