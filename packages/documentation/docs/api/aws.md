# @jaypie/aws

AWS service integrations (SQS, Textract, Secrets Manager).

## Overview

`@jaypie/aws` provides integrations with AWS services, including:

- SQS message handling
- AWS Textract document processing
- Secrets Manager integration
- Event parsing utilities

## Installation

```bash
npm install @jaypie/aws
```

## Key Features

### SQS Integration

Send and receive messages from SQS queues:

```javascript
import { sendMessage, getMessages } from "@jaypie/aws";

// Send a message
await sendMessage({ body: { data: "value" }, queueUrl: "https://sqs.us-east-1.amazonaws.com/..." });

// Get messages from event
const messages = getMessages(event);
```

### Secrets Manager

Retrieve secrets from AWS Secrets Manager:

```javascript
import { getEnvSecret } from "@jaypie/aws";

const apiKey = await getEnvSecret("API_KEY");
```

### Textract Integration

Process documents with AWS Textract:

```javascript
import { getTextractJob } from "@jaypie/aws";

const results = await getTextractJob(jobId);
```

## API Documentation

_API documentation will be generated from TypeScript definitions._

## Related Packages

- [@jaypie/core](./core) - Core utilities
- [@jaypie/lambda](./lambda) - AWS Lambda integration
