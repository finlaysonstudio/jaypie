# Jaypie 🐦‍⬛

Event-driven fullstack architecture centered around JavaScript, AWS, and the JSON:API specification.

"JavaScript on both sides and underneath."

## 🐦‍⬛ Introduction

Jaypie is an opinionated approach to application development.  
It centers around JavaScript and the JSON:API specification in an event-driven architecture.  

Jaypie is suited for applications requiring custom infrastructure beyond HTTP requests, such as message queues.  
For applications without custom infrastructure needs, fullstack hosts like Vercel or Netlify are recommended.  

### "Jaypie Stack"

* AWS infrastructure managed by CDK in Node.js.
* Express server running on AWS Lambda.
* Node.js worker processes running on AWS Lambda.
* MongoDB via Mongoose.
* Frontend agnostic - use any framework or library.
* Vitest for testing.
* ES6 syntax enforced via ESLint.
* Prettier formatting.
* JSON logging with custom metadata.

### Philosophy

Jaypie is for building fullstack JavaScript applications. 

#### JavaScript Only 💛

Jaypie utilizes the AWS Cloud Development Kit (CDK) to manage infrastructure, which is written in Node.js.  
This approach makes infrastructure management accessible to fullstack developers without requiring them to learn a new syntax or live without language constructs like loops and inheritance.  

It does not use Kubernetes, Docker, Terraform, or the "Serverless" framework.  

#### Eject Anything ⏏️

Jaypie embraces "ejectability," a philosophy where any part of the code can be removed and replaced without disturbing the whole.  

#### Mock Everywhere 🎴

Jaypie strives to be "mockable-first," meaning all components should be easily tested via default or provided mocks.  

## 📋 Usage

### Installation

#### Base Package

```bash
npm install jaypie
```

#### Included Packages

These packages are included in `jaypie`.  
They may be installed separately in the future.  

| Package | Exports | Description |
| ------- | ------- | ----------- |
| `@jaypie/aws` |  `getEnvSecret`, `getMessages`, `getSecret`, `getSingletonMessage`, `getTextractJob`, `sendBatchMessages`, `sendMessage`, `sendTextractJob` | AWS helpers |
| `@jaypie/datadog` | `submitDistribution`, `submitMetric`, `submitMetricSet` | Datadog helpers |
| `@jaypie/express` | `badRequestRoute`, `cors`, `echoRoute`, `expressHandler`, `expressHttpCodeHandler`, `forbiddenRoute`, `goneRoute`, `methodNotAllowedRoute`, `noContentRoute`, `notFoundRoute`, `notImplementedRoute`, | Express entry point |
| `@jaypie/lambda` | `lambdaHandler` | Lambda entry point |
| `@jaypie/llm` | `Llm` | LLM helpers |
| `@jaypie/mongoose` | `connect`, `connectFromSecretEnv`, `disconnect`, `mongoose` | MongoDB management |

#### TestKit

Matchers (including all jest-extended matchers), mocks, and utilities to test Jaypie projects.

```bash
npm install --save-dev @jaypie/testkit
```

### Example

```javascript
const { InternalError, lambdaHandler, log } = require("jaypie");

export const handler = lambdaHandler(async({event}) => {
  // await new Promise(r => setTimeout(r, 2000));
  if (event.something === "problem") {
    throw new InternalError();
  }
  // log.debug("Hello World");
  return "Hello World";
}, { name: "example"});
```

This example would then be deployed to AWS via CDK or similar orchestration.

## 📖 Reference

### AWS

```javascript
import { 
  getEnvSecret,
  getMessages,
  getSecret,
  getSingletonMessage,
  getTextractJob,
  sendBatchMessages,
  sendMessage,
  sendTextractJob,
} from "jaypie";
```

#### `getEnvSecret(name, { env = process.env } = {})`

Checks for `SECRET_${name}` and `${name}_SECRET` in environment variables.
If found, retrieves the secret from AWS Secrets Manager using the AWS Parameters and Secrets Lambda Extension.
Otherwise, returns the value of `name` from the environment.
Returns `undefined` if no value is found.
This is convenient for using the environment locally and a secret when deployed.

```javascript
import { getEnvSecret } from "jaypie";

const secret = await getEnvSecret("MONGODB_URI");
// secret = "mongodb+srv://username:password@env-project.n0nc3.mongodb.net/app?retryWrites=true&w=majority";
```

#### `getMessages(event)`

Returns an array of message bodies from SQS or SNS events.
Supports SQS events, SNS events, and direct arrays of events.
Automatically parses JSON message bodies and returns strings as-is.

```javascript
import { getMessages } from '@jaypie/aws';

const messages = getMessages(event);
// messages = [{ salutation: "Hello, world!" }, { salutation: "Hola, dushi!" }]
```

##### Supported Event Formats

**SQS Event (Lambda trigger):**
```javascript
const sqsEvent = {
  Records: [
    {
      body: '{"message": "Hello from SQS"}'
    },
    {
      body: 'Plain text message'
    }
  ]
};
const messages = getMessages(sqsEvent);
// messages = [{ message: "Hello from SQS" }, "Plain text message"]
```

**SNS Event (wrapped in SQS):**
```javascript
const snsEvent = {
  Records: [
    {
      EventSource: "aws:sns",
      Sns: {
        Message: '{"notification": "Hello from SNS"}'
      }
    }
  ]
};
const messages = getMessages(snsEvent);
// messages = [{ notification: "Hello from SNS" }]
```

**Direct Array of Events:**
```javascript
const arrayEvent = [
  { body: '{"data": "First message"}' },
  { body: '{"data": "Second message"}' }
];
const messages = getMessages(arrayEvent);
// messages = [{ data: "First message" }, { data: "Second message" }]
```

**Single Object (passthrough):**
```javascript
const singleEvent = { action: "process", id: 123 };
const messages = getMessages(singleEvent);
// messages = [{ action: "process", id: 123 }]
```

**Edge Cases:**
```javascript
// Undefined or null
const messages1 = getMessages(undefined);
// messages1 = []

const messages2 = getMessages(null);
// Throws ConfigurationError: "Event must be an object"

// Invalid event type
const messages3 = getMessages("invalid");
// Throws ConfigurationError: "Event must be an object"
```

#### `getSecret(secretName: string)`

Retrieves a secret from AWS Secrets Manager using the secret name.  

```javascript
import { getSecret } from '@jaypie/aws';

const secret = await getSecret("MongoConnectionStringN0NC3-nSg1bR1sh");
// secret = "mongodb+srv://username:password@env-project.n0nc3.mongodb.net/app?retryWrites=true&w=majority";
```

#### `getSingletonMessage(event)`

Returns the single message from an SQS event.  
Throws a `BadGatewayError` if more than one message is found.  

```javascript
import { getSingletonMessage } from '@jaypie/aws';

const message = await getSingletonMessage(event);
// message = { salutation: "Hello, world!" }
```

#### `getTextractJob(jobId)`

Retrieves a Textract job from AWS Textract.
Returns an array of response objects from the Textract API.
Handles pagination automatically to retrieve all results.

```javascript
import { getTextractJob } from '@jaypie/aws';

const textractResponses = await getTextractJob(jobId); // Array of Textract response objects
const allBlocks = textractResponses.flatMap(response => response.Blocks || []);
```

#### `sendBatchMessages({ messages, queueUrl })`

Batches and sends messages to an SQS queue.  
If more than ten messages are provided, the function will batch them into groups of ten or less, as per AWS guidelines.  

```javascript
import { sendBatchMessages } from '@jaypie/aws';

const messages = [
  { salutation: "Hello, world!" },
  { salutation: "Hola, dushi!" },
];
const queueUrl = "https://sqs.us-east-1.amazonaws.com/123456789012/MyQueue";

await sendBatchMessages({ messages, queueUrl });
```

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `delaySeconds` | `number` | No | Seconds to delay message delivery; default `0` |
| `messages` | `Array` | Yes | Array of message objects (or strings) |
| `messageAttributes` | `object` | No | Message attributes |
| `messageGroupId` | `string` | No | Custom message group for FIFO queues; default provided |
| `queueUrl` | `string` | Yes | URL of the SQS queue |

#### `sendMessage(body, options)` or `sendMessage({ body, ...options })`

Sends a single message to an SQS queue.
Supports both flexible parameter styles for convenience.

```javascript
import { sendMessage } from '@jaypie/aws';

// Option 1: Separate body and options
const response = await sendMessage("Hello, world!", { queueUrl });

// Option 2: Everything in options object
const response = await sendMessage({
  body: "Hello, world!",
  queueUrl: "https://sqs.us-east-1.amazonaws.com/123456789012/MyQueue"
});

// Option 3: Just body (uses default queue URL)
const response = await sendMessage("Hello, world!");
```

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `body` | `string`, `object` | Yes | Message body |
| `delaySeconds` | `number` | No | Seconds to delay message delivery; default `0` |
| `messageAttributes` | `object` | No | Message attributes |
| `messageGroupId` | `string` | No | Custom message group for FIFO queues; default provided |
| `queueUrl` | `string` | No | URL of the SQS queue; defaults to `process.env.CDK_ENV_QUEUE_URL` |

#### `sendTextractJob({ key, bucket, featureTypes, snsRoleArn, snsTopicArn, throttle })`

Sends a Textract job to AWS Textract.
Includes built-in retry logic and optional throttling to prevent rate limit issues.

```javascript
import { sendTextractJob } from '@jaypie/aws';

const jobId = await sendTextractJob({
  key: "document.pdf",
  bucket: "my-bucket",
  featureTypes: ["FORMS", "LAYOUT", "SIGNATURES", "TABLES"], // Optional, defaults to FORMS, LAYOUT, SIGNATURES, TABLES
  snsRoleArn: "arn:aws:iam::123456789012:role/TextractRole", // Optional
  snsTopicArn: "arn:aws:sns:us-east-1:123456789012:TextractTopic", // Optional
  throttle: true // Optional, defaults to true
});
```

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `key` | `string` | Yes | S3 object key |
| `bucket` | `string` | No | S3 bucket name; defaults to `process.env.CDK_ENV_BUCKET` |
| `featureTypes` | `array` | No | Array of Textract feature types; defaults to `["FORMS", "LAYOUT", "SIGNATURES", "TABLES"]` |
| `snsRoleArn` | `string` | No | SNS IAM role ARN for notifications; defaults to `process.env.CDK_ENV_SNS_ROLE_ARN` |
| `snsTopicArn` | `string` | No | SNS topic ARN for notifications; defaults to `process.env.CDK_ENV_SNS_TOPIC_ARN` |
| `throttle` | `boolean` | No | Whether to throttle requests to prevent rate limiting; defaults to `true` |

### CDK Constructs

Jaypie CDK patterns with common conventions.  

```bash
npm install --save-dev @jaypie/constructs
```

```javascript
import {
  JaypieAccountLoggingBucket,
  JaypieApiGateway,
  JaypieAppStack,
  JaypieBucketQueuedLambda,
  JaypieDatadogBucket,
  JaypieDatadogForwarder,
  JaypieDatadogSecret,
  JaypieDnsRecord,
  JaypieEnvSecret,
  JaypieEventsRule,
  JaypieExpressLambda,
  JaypieGitHubDeployRole,
  JaypieHostedZone,
  JaypieInfrastructureStack,
  JaypieLambda,
  JaypieMongoDbSecret,
  JaypieOpenAiSecret,
  JaypieOrganizationTrail,
  JaypieQueuedLambda,
  JaypieSsoPermissions,
  JaypieSsoSyncApplication,
  JaypieStack,
  JaypieTraceSigningKeySecret,
  JaypieWebDeploymentBucket,
} from "@jaypie/constructs";
```

#### `JaypieEnvSecret`

Manages build-environment secrets, allowing consumer environments (personal environments) to import from provider environments (sandbox).

Most Jaypie projects will not need to specify `consumer` or `provider` properties, as the construct will automatically handle the correct behavior based on the environment.

```typescript
// Shorthand: if the second parameter is an environment variable key with a non-empty value,
// it will be used as envKey and the construct id becomes "EnvSecret_${envKey}"
const mongoSecret = new JaypieEnvSecret(this, "MONGODB_URI");
// Equivalent to: new JaypieEnvSecret(this, "EnvSecret_MONGODB_URI", { envKey: "MONGODB_URI" })

// Explicit configuration
const mongoConnectionString = new JaypieEnvSecret(
  this,
  "MongoConnectionString",
  {
    envKey: "MONGODB_URI",
    roleTag: CDK.ROLE.STORAGE,
    vendorTag: CDK.VENDOR.MONGODB,
  },
);
```

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `consumer` | `boolean` | No | If true, imports secret from provider environment |
| `envKey` | `string` | No | Environment variable to read secret value from |
| `export` | `string` | No | Custom export name for the secret |
| `provider` | `boolean` | No | If true, makes secret available to other environments |
| `roleTag` | `string` | No | Role tag for resource management |
| `vendorTag` | `string` | No | Vendor tag for resource management |
| `value` | `string` | No | Direct secret value if not using envKey |

**Shorthand Behavior**: When the second parameter (normally the construct id) matches an environment variable key with a non-empty string value, and no `envKey` is provided in props, the construct treats it as the `envKey` and generates the id as `EnvSecret_${envKey}`.

##### Convenience Secrets

```typescript
import { JaypieDatadogSecret, JaypieMongoDbSecret, JaypieOpenAiSecret, JaypieTraceSigningKeySecret } from "@jaypie/constructs";

const datadogApiKey = new JaypieDatadogSecret(this);
const mongoConnectionString = new JaypieMongoDbSecret(this);
const openAiKey = new JaypieOpenAiSecret(this);
const traceSigningKey = new JaypieTraceSigningKeySecret(this);
```

#### `JaypieAccountLoggingBucket`

Creates an S3 bucket for account-wide logging with automatic lifecycle policies for cost optimization. Logs transition from standard storage to infrequent access, then to Glacier, and eventually expire.

```typescript
// Basic usage with environment variables
const loggingBucket = new JaypieAccountLoggingBucket(this);

// With explicit bucket name
const loggingBucket = new JaypieAccountLoggingBucket(this, "LoggingBucket", {
  bucketName: "my-account-logs",
  service: "infrastructure",
  project: "myproject"
});

// Shorthand using bucket name as first parameter
const loggingBucket = new JaypieAccountLoggingBucket(this, {
  bucketName: "my-account-logs",
  expirationDays: 730,  // Keep logs for 2 years
  infrequentAccessTransitionDays: 90,  // Move to IA after 90 days
  glacierTransitionDays: 365  // Move to Glacier after 1 year
});

// Without CloudFormation output
const loggingBucket = new JaypieAccountLoggingBucket(this, {
  createOutput: false
});

// With custom export name
const loggingBucket = new JaypieAccountLoggingBucket(this, {
  exportName: "MyCustomLogBucketName",
  outputDescription: "Custom logging bucket for account-wide logs"
});
```

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `bucketName` | `string` | No | Bucket name; defaults to `account-logging-stack-${PROJECT_NONCE}` |
| `service` | `string` | No | Service tag value, defaults to CDK.SERVICE.INFRASTRUCTURE |
| `project` | `string` | No | Project tag value |
| `expirationDays` | `number` | No | Days before logs expire; default 365 |
| `infrequentAccessTransitionDays` | `number` | No | Days before transitioning to INFREQUENT_ACCESS; default 30 |
| `glacierTransitionDays` | `number` | No | Days before transitioning to GLACIER; default 180 |
| `createOutput` | `boolean` | No | Whether to create CloudFormation output; default true |
| `exportName` | `string` | No | Custom export name for the bucket; defaults to CDK.IMPORT.LOG_BUCKET |
| `outputDescription` | `string` | No | Description for CloudFormation output; default "Account-wide logging bucket" |

The bucket is automatically configured with:
- `LOG_DELIVERY_WRITE` access control for AWS service log delivery
- Lifecycle policies for cost optimization
- Tagged with `CDK.TAG.ROLE` set to `CDK.ROLE.MONITORING`
- CloudFormation output for cross-stack reference (unless disabled)

#### `JaypieApiGateway`

Creates an API Gateway with Jaypie conventions for Lambda integration and proper CORS handling.

```typescript
const apiGateway = new JaypieApiGateway(this, "Api", {
  lambdaFunction: expressLambda,
  domainName: "api.example.com",
  certificateArn: "arn:aws:acm:us-east-1:123456789012:certificate/abc123",
});
```

#### `JaypieAppStack`

Base application stack with common Jaypie patterns, resource tagging, and cross-stack resource sharing capabilities.

```typescript
export class MyAppStack extends JaypieAppStack {
  constructor(scope: Construct, id: string, props?: JaypieStackProps) {
    super(scope, id, {
      ...props,
      service: "api",
      project: "myproject",
    });

    // Add your application resources here
  }
}
```

#### `JaypieBucketQueuedLambda`

Lambda function triggered by S3 bucket events with integrated SQS queuing for reliable processing of object notifications.

```typescript
const processor = new JaypieBucketQueuedLambda(this, "DocumentProcessor", {
  code: lambda.Code.fromAsset("src"),
  handler: "processDocument.handler",
  bucketName: "documents-bucket",
  batchSize: 5,
  environment: {
    PROCESSING_MODE: "async"
  },
});
```

#### `JaypieDatadogBucket`

Creates an S3 bucket for Datadog log archiving with automatic IAM permissions for the Datadog role.

```typescript
// Basic usage
const datadogBucket = new JaypieDatadogBucket(this, "DatadogArchive", {
  bucketName: "my-datadog-logs"
});

// With custom bucket configuration
const datadogBucket = new JaypieDatadogBucket(this, "DatadogArchive", {
  bucketName: "my-datadog-logs",
  versioned: true,
  lifecycleRules: [{
    expiration: cdk.Duration.days(90)
  }]
});

// Without automatic Datadog role access
const datadogBucket = new JaypieDatadogBucket(this, {
  bucketName: "my-datadog-logs",
  grantDatadogAccess: false
});
```

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `id` | `string` | No | Custom construct ID; default "DatadogArchiveBucket" |
| `service` | `string` | No | Service tag value, defaults to CDK.SERVICE.DATADOG |
| `project` | `string` | No | Project tag value |
| `grantDatadogAccess` | `boolean` | No | Grant Datadog role bucket access; default true |
| ...`BucketProps` | | | Accepts all standard CDK Bucket properties |

The construct automatically:
- Tags resources with `CDK.TAG.ROLE` set to `CDK.ROLE.MONITORING`
- Grants the Datadog IAM role (from `CDK_ENV_DATADOG_ROLE_ARN`) read/write access to the bucket if enabled

#### `JaypieDatadogForwarder`

Deploys the Datadog log forwarder Lambda using Datadog's official CloudFormation template.

```typescript
// Basic usage with environment variables
const forwarder = new JaypieDatadogForwarder(this);

// With explicit configuration
const forwarder = new JaypieDatadogForwarder(this, "Forwarder", {
  datadogApiKey: "your-api-key",
  account: "production",
  reservedConcurrency: "20"
});

// Without CloudFormation events
const forwarder = new JaypieDatadogForwarder(this, {
  enableCloudFormationEvents: false,
  createOutput: false
});

// Access the forwarder function
const forwarderFunction = forwarder.forwarderFunction;
```

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `id` | `string` | No | Custom construct ID; default "DatadogForwarder" |
| `datadogApiKey` | `string` | No | Datadog API key; defaults to CDK_ENV_DATADOG_API_KEY |
| `account` | `string` | No | Account identifier for Datadog tags; defaults to CDK_ENV_ACCOUNT |
| `reservedConcurrency` | `string` | No | Reserved concurrency for Lambda; default "10" |
| `additionalTags` | `string` | No | Additional Datadog tags (comma-separated) |
| `service` | `string` | No | Service tag value, defaults to CDK.VENDOR.DATADOG |
| `project` | `string` | No | Project tag value |
| `enableCloudFormationEvents` | `boolean` | No | Create CloudFormation events rule; default true |
| `enableRoleExtension` | `boolean` | No | Extend Datadog role with custom permissions; default true |
| `createOutput` | `boolean` | No | Create CloudFormation output for forwarder ARN; default true |
| `exportName` | `string` | No | Custom export name for output; defaults to CDK.IMPORT.DATADOG_LOG_FORWARDER |
| `templateUrl` | `string` | No | URL to Datadog forwarder CloudFormation template |

The construct automatically:
- Deploys Datadog's official forwarder CloudFormation stack
- Creates an EventBridge rule to forward CloudFormation events to Datadog
- Extends the Datadog IAM role with custom permissions (if `CDK_ENV_DATADOG_ROLE_ARN` is set)
- Exports the forwarder Lambda ARN for cross-stack reference
- Tags resources with `CDK.TAG.ROLE` set to `CDK.ROLE.MONITORING`

#### `JaypieExpressLambda`

Lambda function optimized for Express.js applications with API Gateway integration and proper request/response handling.

```typescript
const expressLambda = new JaypieExpressLambda(this, "ApiServer", {
  code: lambda.Code.fromAsset("src"),
  handler: "app.handler",
  environment: {
    NODE_ENV: "production"
  },
  secrets: [mongoConnectionString],
  memorySize: 512,
});
```

#### `JaypieInfrastructureStack`

Infrastructure stack with common patterns for cross-stack resource sharing and environment-specific configurations.

```typescript
export class MyInfrastructureStack extends JaypieInfrastructureStack {
  constructor(scope: Construct, id: string, props?: JaypieStackProps) {
    super(scope, id, {
      ...props,
      service: "infrastructure",
      project: "myproject",
    });

    // Add shared infrastructure resources like VPCs, databases, etc.
  }
}
```

#### `JaypieStack`

Base stack with Jaypie conventions, standardized tagging, and common resource patterns for consistent deployments.

```typescript
export class MyStack extends JaypieStack {
  constructor(scope: Construct, id: string, props?: JaypieStackProps) {
    super(scope, id, {
      ...props,
      service: "worker",
      project: "myproject",
      roleTag: "processing",
    });

    // Add your stack resources here
  }
}
```

#### `JaypieWebDeploymentBucket`

S3 bucket optimized for static website deployment with CloudFront distribution, custom domain support, and automated deployment workflows.

```typescript
const webBucket = new JaypieWebDeploymentBucket(this, "WebSite", {
  domainName: "www.example.com",
  certificateArn: "arn:aws:acm:us-east-1:123456789012:certificate/abc123",
  indexDocument: "index.html",
  errorDocument: "404.html",
});
```

#### `JaypieGitHubDeployRole`

Creates an IAM role for GitHub Actions deployments using OIDC authentication.

```typescript
// Basic usage with environment variables
const deployRole = new JaypieGitHubDeployRole(this, 'GitHubDeployRole');

// With explicit repository restriction
const deployRole = new JaypieGitHubDeployRole(this, 'GitHubDeployRole', {
  repoRestriction: 'repo:myorg/myrepo:*',
  oidcProviderArn: 'arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com',
  output: true  // Outputs role ARN (default: true)
});

// Organization-wide access
const deployRole = new JaypieGitHubDeployRole(this, 'GitHubDeployRole', {
  repoRestriction: 'repo:myorg/*:*'
});

// Custom output name
const deployRole = new JaypieGitHubDeployRole(this, 'GitHubDeployRole', {
  output: 'CustomRoleArnOutput'
});
```

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `oidcProviderArn` | `string` | No | OIDC provider ARN; defaults to CDK.IMPORT.OIDC_PROVIDER import |
| `output` | `boolean \| string` | No | Output role ARN: true (default name), string (custom name), false (no output) |
| `repoRestriction` | `string` | No | Repository restriction pattern; defaults to organization-wide from CDK_ENV_REPO or PROJECT_REPO |

The construct automatically grants permissions for:
- Assuming roles via OIDC
- Deploying CDK applications
- CloudFormation stack operations
- S3 and Route53 read access
- Passing roles for CDK deployment

#### `JaypieHostedZone`

Route53 hosted zone with query logging, optional log forwarding, and DNS record management.

```typescript
// Basic usage with explicit props
const zone = new JaypieHostedZone(this, 'Zone', {
  zoneName: 'example.com',
  service: 'api',           // Service tag value
  project: 'myproject',     // Project tag value
  destination: logHandler   // Optional Lambda destination for logs
});

// Shorthand using domain name as first parameter
const zone = new JaypieHostedZone(this, 'example.com', {
  service: 'api',
  project: 'myproject'
});

// With DNS records
const zone = new JaypieHostedZone(this, 'example.com', {
  service: 'api',
  records: [
    {
      type: 'A',
      recordName: 'www',
      values: ['1.2.3.4']
    },
    {
      type: 'TXT',
      values: ['v=spf1 include:example.com ~all']
    }
  ]
});

// With records array as third parameter
const zone = new JaypieHostedZone(this, 'example.com', [
  { type: 'A', recordName: 'www', values: ['1.2.3.4'] },
  { type: 'CNAME', recordName: 'blog', values: ['myblog.example.net'] }
]);
```

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `zoneName` | `string` | Yes | Domain name for the hosted zone |
| `service` | `string` | No | Service tag value, defaults to CDK.SERVICE.INFRASTRUCTURE |
| `project` | `string` | No | Project tag value |
| `destination` | `LambdaDestination \| boolean` | No | Log destination: LambdaDestination (specific), true (Datadog, default), or false (none) |
| `records` | `JaypieHostedZoneRecordProps[]` | No | Optional DNS records to create for this hosted zone |
| `id` | `string` | No | Optional construct ID, defaults to `${zoneName}-HostedZone` |

#### `JaypieDnsRecord`

Creates DNS records in Route53 hosted zones with support for A, CNAME, MX, NS, and TXT record types.

```typescript
// Create an A record
const aRecord = new JaypieDnsRecord(this, 'WebsiteRecord', {
  zone: 'example.com',  // Can be zone name or IHostedZone
  type: 'A',
  recordName: 'www',
  values: ['1.2.3.4', '5.6.7.8'],
  ttl: cdk.Duration.minutes(5)
});

// Create a CNAME record
const cnameRecord = new JaypieDnsRecord(this, 'BlogRecord', {
  zone: myHostedZone,  // IHostedZone object
  type: 'CNAME',
  recordName: 'blog',
  values: ['myblog.example.net']
});

// Create an MX record
const mxRecord = new JaypieDnsRecord(this, 'MailRecord', {
  zone: 'example.com',
  type: 'MX',
  values: [
    { priority: 10, hostName: 'mail1.example.com' },
    { priority: 20, hostName: 'mail2.example.com' }
  ]
});

// Create a TXT record for SPF
const txtRecord = new JaypieDnsRecord(this, 'SpfRecord', {
  zone: 'example.com',
  type: 'TXT',
  values: ['v=spf1 include:example.com ~all']
});

// Create an NS record
const nsRecord = new JaypieDnsRecord(this, 'SubdomainNS', {
  zone: 'example.com',
  type: 'NS',
  recordName: 'subdomain',
  values: ['ns1.subdomain.example.com', 'ns2.subdomain.example.com']
});
```

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `zone` | `string \| IHostedZone` | Yes | The hosted zone (zone name string or IHostedZone object) |
| `type` | `string` | Yes | DNS record type: A, CNAME, MX, NS, or TXT |
| `values` | `string[] \| Array<{priority, hostName}>` | Yes | Record values (format depends on type) |
| `recordName` | `string` | No | Record name (subdomain); omit for zone apex |
| `ttl` | `Duration` | No | Time to live, defaults to 5 minutes |
| `comment` | `string` | No | Optional comment for the DNS record |

#### `JaypieEventsRule`

Creates an EventBridge rule that targets a Lambda function. Automatically resolves the Datadog forwarder function if no target is specified, making it ideal for routing AWS service events to Datadog for monitoring.

```typescript
// Basic usage - routes events to Datadog forwarder
const rule = new JaypieEventsRule(this, "aws.s3");

// With explicit event source
const s3Rule = new JaypieEventsRule(this, {
  source: "aws.s3"
});

// Multiple event sources
const multiRule = new JaypieEventsRule(this, "MultiSourceRule", {
  source: ["aws.s3", "aws.cloudtrail"]
});

// With custom target function
const customRule = new JaypieEventsRule(this, "CustomRule", {
  source: "aws.lambda",
  targetFunction: myLambdaFunction
});

// With explicit construct ID and full configuration
const advancedRule = new JaypieEventsRule(this, "AdvancedRule", {
  source: "aws.ec2",
  targetFunction: myLambdaFunction,
  description: "Route EC2 events to custom processor",
  enabled: true,
  service: "infrastructure",
  vendor: CDK.VENDOR.AWS,
  project: "myproject"
});

// With custom event pattern (beyond just source)
const patternRule = new JaypieEventsRule(this, {
  eventPattern: {
    source: ["aws.ec2"],
    detailType: ["EC2 Instance State-change Notification"],
    detail: {
      state: ["running"]
    }
  },
  targetFunction: myLambdaFunction
});
```

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `source` | `string \| string[]` | No | Event source(s) to match (e.g., "aws.s3", "aws.cloudtrail") |
| `targetFunction` | `IFunction` | No | Lambda function to target; defaults to Datadog forwarder via resolveDatadogForwarderFunction |
| `service` | `string` | No | Service tag value, defaults to CDK.SERVICE.DATADOG |
| `vendor` | `string` | No | Vendor tag value, defaults to CDK.VENDOR.DATADOG |
| `project` | `string` | No | Project tag value |
| `eventPattern` | `EventPattern` | No | Custom event pattern (source field merged with `source` parameter if both provided) |
| `description` | `string` | No | Rule description |
| `enabled` | `boolean` | No | Whether the rule is enabled; default true |
| `id` | `string` | No | Custom construct ID; auto-generated from source if not provided |

The construct supports three flexible constructor signatures:

1. **Source as first parameter**: `new JaypieEventsRule(this, "aws.s3")` - Automatically generates construct ID
2. **Explicit ID**: `new JaypieEventsRule(this, "MyRule", { source: "aws.s3" })`
3. **Props only**: `new JaypieEventsRule(this, { source: "aws.s3", id: "MyRule" })`

The construct automatically:
- Tags resources with `CDK.TAG.ROLE` set to `CDK.ROLE.MONITORING`
- Resolves the Datadog forwarder function if no target is specified
- Configures the rule to pass the full event payload to the target
- Generates friendly construct IDs from source names (e.g., "aws.s3" becomes "S3EventsRule")

#### `JaypieOrganizationTrail`

Creates an AWS CloudTrail for organization-wide audit logging with S3 storage and automatic lifecycle policies. Optionally forwards logs to Datadog for monitoring.

```typescript
// Basic usage with environment variables
const trail = new JaypieOrganizationTrail(this);

// With explicit configuration
const trail = new JaypieOrganizationTrail(this, "OrgTrail", {
  trailName: "my-organization-trail",
  bucketName: "my-cloudtrail-logs",
  enableFileValidation: true
});

// With custom lifecycle policies
const trail = new JaypieOrganizationTrail(this, {
  trailName: "my-trail",
  expirationDays: 730,  // Keep logs for 2 years
  infrequentAccessTransitionDays: 90,  // Move to IA after 90 days
  glacierTransitionDays: 365  // Move to Glacier after 1 year
});

// Without Datadog notifications
const trail = new JaypieOrganizationTrail(this, {
  enableDatadogNotifications: false
});

// Access the trail and bucket
const bucket = trail.bucket;
const cloudTrail = trail.trail;
```

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `id` | `string` | No | Custom construct ID; auto-generated from trail name |
| `trailName` | `string` | No | CloudTrail name; defaults to `organization-cloudtrail-${PROJECT_NONCE}` |
| `bucketName` | `string` | No | S3 bucket name for logs; defaults to `organization-cloudtrail-${PROJECT_NONCE}` |
| `service` | `string` | No | Service tag value, defaults to CDK.SERVICE.INFRASTRUCTURE |
| `project` | `string` | No | Project tag value |
| `enableFileValidation` | `boolean` | No | Enable file validation for the trail; default false |
| `expirationDays` | `number` | No | Days before logs expire; default 365 |
| `infrequentAccessTransitionDays` | `number` | No | Days before transitioning to INFREQUENT_ACCESS; default 30 |
| `glacierTransitionDays` | `number` | No | Days before transitioning to GLACIER; default 180 |
| `enableDatadogNotifications` | `boolean` | No | Send S3 notifications to Datadog forwarder; default true |

The construct automatically:
- Creates an S3 bucket with lifecycle policies for cost optimization
- Configures the bucket with proper CloudTrail permissions
- Creates an organization-wide CloudTrail that logs all management events
- Forwards S3 object creation events to Datadog forwarder (if enabled)
- Tags resources with `CDK.TAG.ROLE` set to `CDK.ROLE.MONITORING`

#### `JaypieQueuedLambda`

Creates a Lambda function with an attached SQS queue for message processing.  
Includes built-in support for environment variables, secrets, and AWS Parameter Store.  

```typescript
const worker = new JaypieQueuedLambda(this, 'Worker', {
  code: lambda.Code.fromAsset('src'),
  handler: 'index.handler',
  environment: {
    NODE_ENV: 'production'
  },
  secrets: [mongoConnectionString, openAiKey],
  batchSize: 10, // Process 10 messages at a time
});
```

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `batchSize` | `number` | No | Number of messages to process per batch, default 1 |
| `code` | `lambda.Code \| string` | Yes | Lambda function code or path to code |
| `environment` | `object` | No | Environment variables for the Lambda |
| `envSecrets` | `object` | No | Secrets to inject as environment variables |
| `fifo` | `boolean` | No | Use FIFO queue, default true |
| `handler` | `string` | No | Lambda handler function, default 'index.handler' |
| `layers` | `lambda.ILayerVersion[]` | No | Lambda layers to attach |
| `logRetention` | `number` | No | CloudWatch log retention in days |
| `memorySize` | `number` | No | Lambda memory size in MB |
| `paramsAndSecrets` | `lambda.ParamsAndSecretsLayerVersion` | No | AWS Parameter Store layer |
| `reservedConcurrentExecutions` | `number` | No | Lambda concurrency limit |
| `roleTag` | `string` | No | Role tag for resource management |
| `runtime` | `lambda.Runtime` | No | Lambda runtime, default NODEJS_22_X |
| `secrets` | `JaypieEnvSecret[]` | No | JaypieEnvSecrets to inject |
| `timeout` | `Duration \| number` | No | Lambda timeout duration or number of seconds, defaults to CDK.DURATION.LAMBDA_WORKER (900 seconds) |
| `vendorTag` | `string` | No | Vendor tag for resource management |
| `visibilityTimeout` | `Duration \| number` | No | SQS visibility timeout |

#### `JaypieLambda`

Creates an AWS Lambda function with enhanced configuration support for the Jaypie ecosystem, including built-in secrets management, tagging, CloudWatch integration, and automatic Datadog integration.

```typescript
const lambda = new JaypieLambda(this, 'Function', {
  code: lambda.Code.fromAsset('src'),
  handler: 'index.handler',
  environment: {
    NODE_ENV: 'production'
  },
  secrets: [mongoConnectionString, openAiKey],
  timeout: 30, // 30 seconds
  memorySize: 512, // 512MB
  datadogApiKeyArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:DatadogApiKey-abc123', // Optional
});
```

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `code` | `lambda.Code \| string` | Yes | Lambda function code or path to code |
| `datadogApiKeyArn` | `string` | No | ARN of the Secrets Manager secret containing Datadog API key; fallbacks to environment variables DATADOG_API_KEY_ARN or CDK_ENV_DATADOG_API_KEY_ARN |
| `environment` | `object` | No | Environment variables for the Lambda |
| `envSecrets` | `object` | No | Secrets to inject as environment variables |
| `handler` | `string` | No | Lambda handler function, default 'index.handler' |
| `layers` | `lambda.ILayerVersion[]` | No | Lambda layers to attach |
| `logRetention` | `number` | No | CloudWatch log retention in days |
| `memorySize` | `number` | No | Lambda memory size in MB |
| `paramsAndSecrets` | `lambda.ParamsAndSecretsLayerVersion \| boolean` | No | AWS Parameter Store layer, or true to use defaults |
| `paramsAndSecretsOptions` | `object` | No | Config options for the Parameters and Secrets layer |
| `provisionedConcurrentExecutions` | `number` | No | Number of provisioned concurrent executions; creates alias with provisioned concurrency |
| `reservedConcurrentExecutions` | `number` | No | Lambda concurrency limit |
| `roleTag` | `string` | No | Role tag for resource management |
| `runtime` | `lambda.Runtime` | No | Lambda runtime, default NODEJS_22_X |
| `secrets` | `JaypieEnvSecret[]` | No | JaypieEnvSecrets to inject |
| `timeout` | `Duration \| number` | No | Lambda timeout duration or number of seconds, defaults to CDK.DURATION.LAMBDA_WORKER (900 seconds) |
| `vendorTag` | `string` | No | Vendor tag for resource management |

When provided with a Datadog API key (via `datadogApiKeyArn` or environment variables), the construct automatically:
- Adds the Datadog Node.js and Extension layers
- Configures necessary environment variables for Datadog monitoring
- Grants the Lambda function permissions to access the Datadog API key

When `provisionedConcurrentExecutions` is specified, the construct:
- Creates a new Lambda version with auto-publishing
- Creates a Lambda alias named "provisioned" pointing to the version
- Configures the specified number of provisioned concurrent executions on the alias
- The `reference` property will point to the alias instead of the function

#### `JaypieSsoPermissions`

Creates and manages AWS IAM Identity Center (SSO) permission sets and assignments for administrator, analyst, and developer roles.

```typescript
// Basic usage with environment variable for IAM Identity Center ARN
const permissionSets = new JaypieSsoPermissions(this, 'PermissionSets', {
  administratorGroupId: "b4c8b438-4031-7000-782d-5046945fb956",
  analystGroupId: "2488f4e8-d061-708e-abe1-c315f0e30005",
  developerGroupId: "b438a4f8-e0e1-707c-c6e8-21841daf9ad1",
  administratorAccountAssignments: {
    "211125635435": ["Administrator", "Analyst", "Developer"],
    "381492033431": ["Administrator", "Analyst"],
  },
  analystAccountAssignments: {
    "211125635435": ["Analyst", "Developer"],
    "381492033431": [],
  },
  developerAccountAssignments: {
    "211125635435": ["Analyst", "Developer"],
    "381492033431": [],
  },
});

// With explicit IAM Identity Center ARN
const permissionSets = new JaypieSsoPermissions(this, 'PermissionSets', {
  iamIdentityCenterArn: 'arn:aws:sso:::instance/ssoins-1234567890abcdef',
  administratorGroupId: "b4c8b438-4031-7000-782d-5046945fb956",
  // ... other properties
});
```

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `iamIdentityCenterArn` | `string` | No | ARN of the IAM Identity Center instance; falls back to CDK_ENV_IAM_IDENTITY_CENTER_ARN |
| `administratorGroupId` | `string` | No | Google Workspace group GUID for administrators |
| `analystGroupId` | `string` | No | Google Workspace group GUID for analysts |
| `developerGroupId` | `string` | No | Google Workspace group GUID for developers |
| `administratorAccountAssignments` | `AccountAssignments` | No | Map of account IDs to arrays of permission set names for administrators |
| `analystAccountAssignments` | `AccountAssignments` | No | Map of account IDs to arrays of permission set names for analysts |
| `developerAccountAssignments` | `AccountAssignments` | No | Map of account IDs to arrays of permission set names for developers |

The construct creates these permission sets with predefined policies:

- **Administrator**:
  - `AdministratorAccess` managed policy
  - `AWSManagementConsoleBasicUserAccess` managed policy
  - Billing and cost management permissions
  - 1-hour session duration

- **Analyst**:
  - `ReadOnlyAccess` managed policy
  - `AmazonQDeveloperAccess` managed policy
  - `AWSManagementConsoleBasicUserAccess` managed policy
  - Extended read permissions (billing, logs, secrets metadata, tags, X-Ray)
  - Limited write access (tagging, X-Ray)
  - 12-hour session duration

- **Developer**:
  - `ReadOnlyAccess` managed policy
  - `SystemAdministrator` managed policy
  - `AmazonQDeveloperAccess` managed policy
  - `AWSManagementConsoleBasicUserAccess` managed policy
  - Administrative permissions for common services (CloudFormation, Lambda, S3, etc.)
  - Limited IAM permissions (Get, List, PassRole)
  - 4-hour session duration

If `iamIdentityCenterArn` is not provided and `CDK_ENV_IAM_IDENTITY_CENTER_ARN` environment variable is not set, SSO setup will be skipped.

#### `JaypieSsoSyncApplication`

Deploys the SSO Sync application from AWS Serverless Application Repository to synchronize Google Workspace groups with AWS IAM Identity Center.

```typescript
// Basic usage with environment variables
const ssoSync = new JaypieSsoSyncApplication(this, 'SsoSync');

// With explicit configuration
const ssoSync = new JaypieSsoSyncApplication(this, 'SsoSync', {
  googleAdminEmail: 'admin@example.com',
  googleCredentials: JSON.stringify(credentialsObject),
  googleGroupMatch: 'name:AWS*',
  identityStoreId: 'd-1234567890',
  scimEndpointUrl: 'https://scim.us-east-1.amazonaws.com/abc123/scim/v2',
  scimEndpointAccessToken: 'token-value',
  semanticVersion: '2.3.3'
});
```

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `googleAdminEmail` | `string` | No* | Google Workspace admin email; falls back to CDK_ENV_SSOSYNC_GOOGLE_ADMIN_EMAIL |
| `googleCredentials` | `string` | No* | Google Workspace service account credentials (JSON); falls back to CDK_ENV_SSOSYNC_GOOGLE_CREDENTIALS |
| `googleGroupMatch` | `string` | No | Group filter pattern; defaults to "name:AWS*" or CDK_ENV_SSOSYNC_GOOGLE_GROUP_MATCH |
| `identityStoreId` | `string` | No* | IAM Identity Center identity store ID; falls back to CDK_ENV_SSOSYNC_IDENTITY_STORE_ID |
| `scimEndpointUrl` | `string` | No* | SCIM endpoint URL; falls back to CDK_ENV_SSOSYNC_SCIM_ENDPOINT_URL |
| `scimEndpointAccessToken` | `string` | No* | SCIM endpoint access token; falls back to CDK_ENV_SCIM_ENDPOINT_ACCESS_TOKEN |
| `semanticVersion` | `string` | No | Application version; defaults to "2.3.3" or CDK_ENV_SSOSYNC_SEMANTIC_VERSION |
| `ssoSyncApplicationId` | `string` | No | Serverless app ARN; defaults to official SSO Sync application |
| `tags` | `object` | No | Additional resource tags |

*Required fields can be provided via props or environment variables. An error will be thrown if any required field is missing.

The construct automatically tags resources with `CDK.TAG.ROLE` set to `CDK.ROLE.SECURITY`.

### Constants

```javascript
import { 
  CDK,
  DATADOG,
  ERROR,
  EXPRESS,
  HTTP,
  VALIDATE,
} from "jaypie";
```

#### `CDK`

* `CDK.ACCOUNT`
* `CDK.ENV`
* `CDK.ROLE`
* `CDK.SERVICE`
* `CDK.TAG`

See [constants.js in @jaypie/core](https://github.com/finlaysonstudio/jaypie-core/blob/main/src/core/constants.js).

#### `DATADOG`

* `DATADOG.METRIC.TYPE.UNKNOWN`
* `DATADOG.METRIC.TYPE.COUNT`
* `DATADOG.METRIC.TYPE.RATE`
* `DATADOG.METRIC.TYPE.GAUGE`

#### `ERROR`

Default messages and titles for Jaypie errors.  

* `ERROR.MESSAGE`
* `ERROR.TITLE`

See `HTTP` for status codes.

#### `EXPRESS`

* `EXPRESS.PATH.ANY` - String `*` for any path
* `EXPRESS.PATH.ID` - String `/:id` for an ID path
* `EXPRESS.PATH.ROOT` - Regular expression for root path

#### `HTTP`

* `HTTP.ALLOW.ANY`
* `HTTP.CODE`: `OK`, `CREATED`, ...
* `HTTP.CONTENT.ANY`
* `HTTP.CONTENT.HTML`
* `HTTP.CONTENT.JSON`
* `HTTP.CONTENT.TEXT`
* `HTTP.HEADER`: ...
* `HTTP.METHOD`: `GET`, `POST`, ...

#### Internal Constants

* `JAYPIE` - for consistency across Jaypie
* `PROJECT` - for consistency across projects

### Datadog

Functions all detect the Datadog key in the environment and safely fail on errors.

```javascript
const { 
  submitDistribution,
  submitMetric, 
  submitMetricSet 
} = require("jaypie");
```

#### `submitDistribution({ name, tags, type, value })`

```javascript
import { submitDistribution } from "jaypie";

await submitDistribution({
  name: "jaypie.metric",
  value: 1,
})
```

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| apiKey | `string` | No | Datadog API key; checks `process.env.DATADOG_API_KEY` |
| apiSecret | `string` | No | AWS Secret name holding Datadog API key; checks `process.env.SECRET_DATADOG_API_KEY`. Preferred method of retrieving key |
| name | `string` | Yes | Name of the distribution metric |
| points | `array` | No | Array of [timestamp, values] pairs for distribution data |
| value | `number`, `array` | No | Single value or array of values (alternative to points) |
| tags | `array`, `object` | No | Tags for the metric. Accepts arrays `["key:value"]` or objects `{"key":"value"}` |
| timestamp | `number` | No | Unix timestamp; defaults to `Date.now()` |

#### `submitMetric({ name, tags, type, value })`

```javascript
import { submitMetric } from "jaypie";

await submitMetric({
  name: "jaypie.metric",
  type: DATADOG.METRIC.TYPE.COUNT,
  value: 1,
});
```

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| apiKey | `string` | No | Datadog API key; checks `process.env.DATADOG_API_KEY` |
| apiSecret | `string` | No | AWS Secret name holding Datadog API key; checks `process.env.SECRET_DATADOG_API_KEY`. Preferred method of retrieving key |
| name | `string` | Yes | Name of the metric |
| type | `string` | No | Defaults to `DATADOG.METRIC.TYPE.UNKNOWN` |
| value | `number` | Yes | Value of the metric |
| tags | `array`, `object` | No | Tags for the metric. Accepts arrays `["key:value"]` or objects `{"key":"value"}` |
| timestamp | `number` | No | Unix timestamp; defaults to `Date.now()` |

#### `submitMetricSet({ tags, type, valueSet })`

```javascript
import { submitMetricSet } from "jaypie";

await submitMetricSet({
  type: DATADOG.METRIC.TYPE.GAUGE,
  valueSet: {
    "jaypie.metric.a": 1,
    "jaypie.metric.b": 2,
    "jaypie.metric.c": 3,
  },
});
```

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| apiKey | `string` | No | Datadog API key; checks `process.env.DATADOG_API_KEY` |
| apiSecret | `string` | No | AWS Secret name holding Datadog API key; checks `process.env.SECRET_DATADOG_API_KEY`. Preferred method of retrieving key |
| type | `string` | No | Defaults to `DATADOG.METRIC.TYPE.UNKNOWN` |
| valueSet | `object` | Yes | Key-value pairs where the key is the metric name and the value is the metric value (number) |
| tags | `array`, `object` | No | Tags for the metric. Accepts arrays `["key:value"]` or objects `{"key":"value"}` |
| timestamp | `number` | No | Unix timestamp; defaults to `Date.now()` |

### Errors

#### Throwing/Catching Errors

``` javascript
// See `Error Reference` for full list
const { InternalError } = require("jaypie");

try {
  // Code happens...
  throw InternalError("Oh, I am slain!");
} catch (error) {
  // Is this from a jaypie project?
  if(error.isProjectError) {
    {
      name,   // ProjectError
      title,  // "Internal Server Error"
      detail, // "Oh, I am slain"
      status, // 500 (HTTP code)
    } = error;
  } else {
    // Not from jaypie
    throw error;
  }
}
```

#### Error from Status Code

```javascript
import { errorFromStatusCode } from "jaypie";

const error = errorFromStatusCode(404, "The requested resource was unable to be located");
```

#### Format Error

``` javascript
if(error.isProjectError) {
  return error.json();
}
```

#### Multi-Error Usage

``` javascript
const errors = [];
errors.push(BadGatewayError());
errors.push(NotFoundError());
throw MultiError(errors);
```

#### Error Reference

| Error                   | Status | Notes |
| ----------------------- | ------ | ----- |
| `BadGatewayError`       | 502    | Something I need gave me an error |
| `BadRequestError`       | 400    | You did something wrong |
| `ConfigurationError`    | 500    | "The developer" (probably you) or an associate did something wrong |
| `ForbiddenError`        | 403    | You are not allowed |
| `GatewayTimeoutError`   | 504    | Something I need is taking too long |
| `GoneError`             | 410    | The thing you are looking for was here but is now gone forever |
| `IllogicalError`        | 500    | Code is in a state that "should never happen" |
| `InternalError`         | 500    | General "something went wrong" |
| `MethodNotAllowedError` | 405    | You tried a good path but the wrong method |
| `MultiError`            | Varies | Takes an array of errors |
| `NotFoundError`         | 404    | The thing you are looking for is not here and maybe never was |
| `NotImplementedError`   | 400    | "The developer" (you again?) didn't finish this part yet - hopefully a temporary message |
| `RejectedError`         | 403    | Request filtered prior to processing |
| `TeapotError`           | 418    | RFC 2324 section-2.3.2 |
| `UnauthorizedError`     | 401    | You need to log in |
| `UnavailableError`      | 503    | The thing you are looking for cannot come to the phone right now |
| `UnhandledError`        | 500    | An error that should have been handled wasn't |
| `UnreachableCodeError`  | 500    | Should not be possible |

##### Special Errors

ALWAYS internal to the app, NEVER something the client did

* Configuration
    * "The person writing the code did something wrong" like forgot to pass or passed bad arguments
    * "The person who configured the application made a mistake" like set mutually exclusive settings to true
* Illogical
    * A combination of truth conditions occurred that should not be able to occur at the same time
* Not Implemented
    * A marker to come back and finish this, but allows stubbing out HTTP endpoints
* Unhandled
    * Internal to Jaypie, should not be thrown directly
    * Jaypie expects code in handlers to handler errors and re-throw a Jaypie error
    * If an unexpected error escapes the handler, Jaypie returns this when it is caught
* Unreachable
    * In theory the block is literally not reachable and we want to put something there to make sure it stays that way
    * For example, a complicated chain of `if`/`else` that should always return and cover all cases, may throw this as the last `else`
    * A configuration error means what happened was possible but should not have happened, an unreachable error means it should not have been possible

### Express

The Express handler wraps the Jaypie handler for Express running on AWS Lambda.  
It will call lifecycle methods and provide logging.  
Unhandled errors will be thrown as `UnhandledError`.  
It adds the `locals` lifecycle call.  
It extends `jaypieHandler`, not the lambda handler.  

```javascript
const { expressHandler } = require("jaypie");

const handler = expressHandler(async(req, res) => {
  // await new Promise(r => setTimeout(r, 2000));
  // log.debug("Hello World");
  return { message: "Hello World" };
}, { name: "lambdaReference"});
```

The order of options and handler may be swapped to improve readability.  
Having lifecycle methods listed before the handler may read more intuitively.  

```javascript
const handler = expressHandler({ 
  name: "expressOptions",
  setup: [connect],
  teardown: [disconnect],
}, async(req, res) => {
  // await new Promise(r => setTimeout(r, 2000));
  // log.debug("Hello World");
  return { message: "Hello World" };
});
```

#### Return Types

Do not use `res.send` or `res.json` in the handler.  
The return value of the handler is the response body.  
The status code is determined by the error thrown or the return value.  
Custom status codes can be set by calling `res.status` in the handler.  

| Return Type | Status Code | Content-Type |
| ----------- | ----------- | ------------ |
| Object, Array | 200 OK | `application/json` |
| String | 200 OK | `text/html` |
| `true` | 201 Created | None |
| Falsy values | 204 No Content | None |

Errors can be returned by throwing the appropriate Jaypie error.  

#### Lifecycle Methods

In addition to the Jaypie lifecycle methods, `expressHandler` adds `locals`, an object of scalars or functions that will be called at the end of `setup` and available to the handler as `req.locals`.  

```javascript
const handler = expressHandler(async(req) => {
  // req.locals.asyncFn = "async"
  // req.locals.fn = "function"
  // req.locals.key = "static"
  return { message: "Hello World" };
}, { 
  name: "expressReference",
  locals: { 
    asyncFn: async() => "async",
    fn: () => "function",
    key: "static"
  },
});
```

#### CORS Helper

The CORS helper provides flexible Cross-Origin Resource Sharing (CORS) middleware with dynamic origin validation.

```javascript
import { cors } from "jaypie";

// Basic usage - allows requests based on environment variables
app.use(cors());

// Allow specific origins
app.use(cors({ origin: "https://mydomain.com" }));

// Allow multiple origins
app.use(cors({ origin: ["https://mydomain.com", "https://api.mydomain.com"] }));

// Allow all origins (wildcard)
app.use(cors({ origin: "*" }));

// Custom overrides for the underlying express cors middleware
app.use(cors({ 
  origin: "https://mydomain.com",
  overrides: {
    credentials: true,
    optionsSuccessStatus: 200
  }
}));
```

##### Origin Resolution

The CORS helper automatically checks origins in this order:

1. **Explicit origins** - Origins passed in the `origin` parameter
2. **Environment variables** - `BASE_URL` and `PROJECT_BASE_URL` (automatically adds https:// if missing)
3. **Sandbox mode** - Allows `localhost` origins when `PROJECT_ENV=sandbox` or `PROJECT_SANDBOX_MODE=true`
4. **No origin requests** - Always allowed (mobile apps, curl, etc.)

##### Error Handling

Invalid origins receive a `CorsError` (401 Unauthorized) response in JSON:API format.

#### Convenience Routes

_A "handler" returns a function that can be used as an Express route.  
A "route" does not require instantiation._  

```javascript
import { 
  badRequestRoute,
  echoRoute,
  EXPRESS,
  forbiddenRoute,
  goneRoute,
  methodNotAllowedRoute,
  noContentRoute,
  notFoundRoute,
  notImplementedRoute,
} from "jaypie";

app.get(EXPRESS.PATH.ROOT, noContentRoute); // 204 No Content
app.get(EXPRESS.PATH.ANY, echoRoute); // 200 OK returning the request
app.post(EXPRESS.PATH.ANY, forbiddenRoute); // 403 Forbidden
app.any("/future", notImplementedRoute); // 400 Bad Request
```

`notImplementedRoute` returns "400 Bad Request" as a placeholder for future functionality.  
In this regard, calling it is a "user error."  
The "501 Not Implemented" status code is reserved for the server not supporting parts of the HTTP protocol such as `POST` or `PUT`.  

### Chaos Engineering

Jaypie includes built-in chaos engineering capabilities to test system resilience. Chaos mode can be activated via the `PROJECT_CHAOS` environment variable or the `X-Project-Chaos` HTTP header.

#### Chaos Modes

| Mode | Description | Behavior |
| ---- | ----------- | -------- |
| `off`, `false`, `none`, `skip`, `0`, `""` | Disabled | No chaos effects |
| `low` | Low chaos rate (2.1%) | Random sleep 0-12s when triggered |
| `medium` | Medium chaos rate (14.6%) | Random sleep 0-12s when triggered (default) |
| `high` | High chaos rate (38.2%) | Random sleep 0-12s when triggered |
| `always` | Always triggers (100%) | Always sleeps 0-12s |
| `error` | Immediate error | Throws 500 Internal Server Error |
| `error=<code>` | Custom error | Throws error with specified HTTP status code (e.g., `error=404`) |
| `timeout` | Simulated timeout | Sleeps for 15 minutes then throws 500 error |
| `exit` | Process termination | Immediately exits the process with code 1 |
| `memory` | Memory exhaustion | Allocates memory until system runs out |

#### Usage Examples

```javascript
// Via environment variable
process.env.PROJECT_CHAOS = "medium";

// Via HTTP header
curl -H "X-Project-Chaos: high" https://api.example.com/endpoint

// In handler options
const handler = expressHandler(myHandler, {
  chaos: "low", // Override environment/header
  // ... other options
});
```

#### Chaos Rate Probabilities

The chaos rates follow the golden ratio for natural-feeling randomness:
- **Low**: 2.1% chance (1 in ~48 requests)
- **Medium**: 14.6% chance (1 in ~7 requests)  
- **High**: 38.2% chance (1 in ~3 requests)

When chaos triggers with rate-based modes (low/medium/high/always), it introduces a random delay between 0-12 seconds to simulate latency issues.

### Functions

#### `cloneDeep`

`lodash.clonedeep` from [NPM](https://www.npmjs.com/package/lodash.clonedeep).  

```javascript
import { cloneDeep } from "jaypie";

const original = { a: 1, b: { c: 2 }};
const clone = cloneDeep(original);
```

#### `envBoolean`

Look up a key in `process.env` and coerce it into a boolean.  
Returns `true` for `true` (case-insensitive) and `1` for string, boolean, and numeric types.  
Returns `false` for `false` (case-insensitive) and `0` for string, boolean, and numeric types.  
Returns `undefined` otherwise.  

``` javascript
const { envBoolean } = require("jaypie");

process.env.AWESOME = true;

if (envBoolean("AWESOME")) {
  console.log("Awesome!");
}
```

##### `envBoolean`: `defaultValue`

``` javascript
const { envBoolean } = require("jaypie");

if (envBoolean("AWESOME", { defaultValue: true })) {
  console.log("Awesome!");
}
```

#### `envsKey`

`envsKey(key:string, { env:string = process.env.PROJECT_ENV || process.env.DEFAULT_ENV })`.  

Return `process.env.${KEY} || ENV_${ENV}_${KEY} || false`.  

```bash
DEFAULT_ENV=sandbox

MONGODB_URI=...
ENV_SANDBOX_MONGODB_URI=...
ENV_DEVELOPMENT_MONGODB_URI=...

PROJECT_ENV=development
```

Return order:
1. `MONGODB_URI` - the exact key always takes precedence, if set
2. `ENV_DEVELOPMENT_MONGODB_URI` - the `PROJECT_ENV`, if set. Usually this is set in the deploy workflow
3. `ENV_SANDBOX_MONGODB_URI` - the `DEFAULT_ENV`, if set. Usually this is set in the local environment
4. `false`

```javascript
import { envsKey } from "jaypie";

const url = envsKey("MONGODB_URI");
```

#### `force`

Coerce a value into a type or throw an error.  
Forcing arrays is the primary use case.  

```javascript
import { force } from "jaypie";

argument = force(thing, Array);
argument = force([thing], Array);
// argument = [thing]
```

`force` supports Array, Boolean, Number, Object, and String.

```javascript
argument = force(argument, Array);
argument = force(argument, Boolean, "true");
argument = force(argument, Number, "12");
argument = force(argument, Object, "key");
argument = force(argument, String, "default");

// Convenience functions
argument = force.array(argument);
argument = force.boolean(argument);
argument = force.number(argument);
argument = force.object(argument, "key");
argument = force.string(argument);
```

#### `getHeaderFrom`

`getHeaderFrom(headerKey:string, searchObject:object)`

Case-insensitive search inside `searchObject` for `headerKey`.  
Also looks in `header` and `headers` child object of `searchObject`, if `headerKey` not found at top-level.  

#### `getObjectKeyCaseInsensitive(object:object, key:string)`

Case-insensitive search for `key` in `object`.  
Returns the value of the key or `undefined`.  

#### `placeholders`

Lightweight string interpolation.  

```javascript
import { placeholders } from "jaypie";

const string = placeholders("Hello, {name}!", { name: "World" });
// string = "Hello, World!"
```

The code for placeholders was written by Chris Ferdinandi and distributed under the MIT License in 2018-2019. Their web site is https://gomakethings.com

#### `safeParseFloat`

`parseFloat` that returns `0` for `NaN`.  

#### `sleep`

`sleep` is a promise-based `setTimeout` that resolves after a specified number of milliseconds.  
It will NOT run when `NODE_ENV` is `test`.  
See `sleepAlways` for a version that will run in tests.  

```javascript
import { sleep } from "jaypie";

await sleep(2000);
```

_This is "bad code" because it checks `NODE_ENV` during runtime.  
The "right way" is to let sleep run and mock it in tests, in practice this is needless boilerplate.  
A fair compromise would be to mock `sleep` with `@jaypie/testkit` but not all projects include that dependency.  
Jaypie will trade academically incorrect for human convenience and simplicity._  

#### `uuid`

The `v4` function from the `uuid` package.  

```javascript
import { uuid } from "jaypie";

const id = uuid();
```

### Jaypie Handler

The Jaypie handler can be used directly but is more likely to be wrapped in a more specific handler.  
The Jaypie handler will call lifecycle methods and provide logging.  
Unhandled errors will be thrown as `UnhandledError`.  

```javascript
import { jaypieHandler } from "jaypie";

const handler = jaypieHandler(async(...args) => {
  // await new Promise(r => setTimeout(r, 2000));
  // log.var({ args });
  return "Hello World";
}, { name: "jaypieReference"});
```

#### Jaypie Lifecycle Methods

Each function receives the same arguments as the handler.  

##### `validate: [async Function]`

Returns `true` to validate the request.  
Throw an error or return `false` to reject the request.  

##### `setup: [async Function]`

Called before the handler (e.g., connect to a database).  
Throw an error to halt execution.  

##### `handler: async Function`

The main function to handle the request.  
Throw an error to halt execution.  

##### `teardown: [async Function]`

Called after the handler (e.g., disconnect from a database).  
Runs even if setup or handler throws errors.  

### Lambda Handler

The Lambda handler wraps the Jaypie handler for AWS Lambda.  
It will call lifecycle methods and provide logging.  
Unhandled errors will be thrown as `UnhandledError`.  

```javascript
const { lambdaHandler } = require("jaypie");

const handler = lambdaHandler(async({event}) => {
  // await new Promise(r => setTimeout(r, 2000));
  // log.debug("Hello World");
  return "Hello World";
}, { name: "lambdaReference"});
```

### Logging

```javascript
import { 
  log,
} from "jaypie";
```

#### log

```javascript
import { log } from "jaypie";

log.trace();
log.debug();
log.info();
log.warn();
log.error();
log.fatal();
```

##### log.lib({ lib: "myLib" })

Uses `silent` by default.  
If `process.env.MODULE_LOG_LEVEL` is `true`, follows `process.env.LOG_LEVEL`.  
If `process.env.MODULE_LOG_LEVEL` is also set, uses that log level.  

```javascript
import { log } from "jaypie";

log.lib().trace();
log.lib({ lib: "myLib" }).trace();
```

##### log.tag(key, value) or log.tag({ key: value })

Permanently add the key-value pair to the logger's tags, or at least until `log.untag(key)` is called.  

```javascript
import { log } from "jaypie";

log.tag("myTag", "myValue");
log.tag({ myTag: "myValue" });
```

##### log.untag(key) or log.untag([key1, key2, ...])

Remove the key-value pair from the logger's tags.  

```javascript
import { log } from "jaypie";

log.untag("myTag");
log.untag(["myTag1", "myTag2"]);
```

##### log.var(key, value) or log.var({ key: value })

Log a key-value pair.  
In the `json` format, the key will be tagged as `var` and the value will be the value.  
Logging marker variables this way can be useful for debugging.  

```javascript
import { log } from "jaypie";

log.var("message", "Hello, world");
log.var({ message: "Hello, world" });

const message = "Hello, world";
log.var({ message });
```

##### log.with() - clone

Create a new log object with additional tags.  

```javascript
import { log as defaultLogger } from "jaypie";

const log = defaultLogger.with({ customProperty: "customValue" });
```

### Mongoose

```javascript
import { 
  connect,
  connectFromSecretEnv, 
  disconnect, 
  mongoose,
} from "jaypie";
```

#### `connect`

Jaypie lifecycle method to connect to MongoDB.  
Uses `process.env.SECRET_MONGODB_URI` AWS Secret or `process.env.MONGODB_URI` string to connect.  

```javascript
import { connect, disconnect, lambdaHandler, mongoose } from "jaypie";

const handler = lambdaHandler(async({event}) => {
  // mongoose is already connected
  return "Hello World";
}, { 
  name: "lambdaReference"
  setup: [connect],
  teardown: [disconnect],
});
```

#### `connectFromSecretEnv`

Jaypie lifecycle method to connect to MongoDB using `process.env.MONGO_CONNECTION_STRING`.  
Using the newer `connect` is generally preferred.  

```javascript
import { connectFromSecretEnv, disconnect, lambdaHandler, mongoose } from "jaypie";

const handler = lambdaHandler(async({event}) => {
  // mongoose is already connected
  return "Hello World";
}, { 
  name: "lambdaReference"
  setup: [connectFromSecretEnv],
  teardown: [disconnect],
});
```

#### `disconnect`

Jaypie lifecycle method to disconnect from MongoDB.  

```javascript
import { disconnect, lambdaHandler } from "jaypie";

const handler = lambdaHandler(async({event}) => {
  // ...
}, {
  teardown: [disconnect],
});
```

#### `mongoose`

`mongoose` from [NPM](https://www.npmjs.com/package/mongoose).  

```javascript
import { mongoose } from "jaypie";
```

### LLM

```javascript
import { 
  Llm,
  LLM,
  toolkit,
  tools
} from "jaypie";
```

The LLM package provides a unified interface for interacting with large language models (LLMs) like OpenAI's GPT and Anthropic's Claude.

#### Basic Usage

```javascript
import { Llm } from "jaypie";

// Create an LLM instance (uses OpenAI by default)
const llm = new Llm();

// Send a simple message
const response = await llm.send("Hello, world!");
console.log(response); // "Hello! How can I help you today?"

// Static method for one-off requests
const quickResponse = await Llm.send("What is the capital of France?");
console.log(quickResponse); // "The capital of France is Paris."
```

#### Provider Selection

```javascript
import { Llm, LLM } from "jaypie";

// OpenAI (default)
const openai = new Llm(LLM.PROVIDER.OPENAI.NAME);

// Anthropic
const anthropic = new Llm(LLM.PROVIDER.ANTHROPIC.NAME);

// Direct model specification (provider auto-detected)
const gpt4 = new Llm("gpt-4o");
const claude = new Llm("claude-3-5-sonnet-20241022");

// With custom model via options
const customModel = new Llm(LLM.PROVIDER.OPENAI.NAME, {
  model: LLM.PROVIDER.OPENAI.MODEL.GPT_4_5
});

// With API key (not recommended - prefer environment variables or secrets)
const withApiKey = new Llm(LLM.PROVIDER.OPENAI.NAME, {
  apiKey: "your-api-key" 
});
```

#### Structured Output

Get structured data back from the LLM using the `response` option:

```javascript
import { Llm } from "jaypie";

// Using a natural schema (recommended)
const naturalSchema = await llm.send("Parse my name: John Smith", {
  response: {
    firstName: String,
    lastName: String
  }
});
console.log(naturalSchema); // { firstName: "John", lastName: "Smith" }

// Using Zod schema
import { z } from "zod";
const zodSchema = await llm.send("Parse my name: John Smith", {
  response: z.object({
    firstName: z.string(),
    lastName: z.string()
  })
});
console.log(zodSchema); // { firstName: "John", lastName: "Smith" }
```

#### System Messages and Templates

```javascript
import { Llm } from "jaypie";

// With system message
const withSystem = await llm.send("Tell me a joke", {
  system: "You are a comedian who specializes in dad jokes."
});

// With template variables
const withTemplate = await llm.send("Hello, {{name}}!", {
  data: { name: "World" }
});
console.log(withTemplate); // Response using "Hello, World!"

// Disable template replacement
const noTemplate = await llm.send("Hello, {{name}}!", {
  data: { name: "World" },
  placeholders: { message: false }
});
console.log(noTemplate); // Response using literal "Hello, {{name}}!"
```

#### Function Calling with `operate`

The `operate` method provides a more powerful API with function calling and multi-turn conversations:

```javascript
import { Llm, toolkit } from "jaypie";

const llm = new Llm();

// Basic operate call
const result = await llm.operate("What time is it?", {
  tools: [toolkit.time]
});
console.log(result.content); // "The current time is 2:45 PM."

// Multi-turn conversation with function calling
const weatherResult = await llm.operate("What's the weather like and roll a d20", {
  tools: [toolkit.weather, toolkit.roll],
  turns: true // Enable multi-turn conversation (default limit is 12 turns)
});
console.log(weatherResult.content); // Final response after tool calls
console.log(weatherResult.history); // Full conversation history
```

#### Built-in Tools

The LLM package includes several built-in tools that can be used with the `operate` method:

```javascript
import { Llm, toolkit } from "jaypie";

// Available tools:
const { time, weather, random, roll } = toolkit;

// Use individual tools
const result = await llm.operate("Roll 3d6 for my character's strength", {
  tools: [toolkit.roll]
});

// Or use all tools
const result = await llm.operate("What's the weather and give me a random number", {
  tools: Object.values(toolkit) // All tools
});

// Or import the tools array directly
import { tools } from "jaypie";
const result = await llm.operate("What's the current time?", { tools });
```

##### Tool Reference

- **time** - Returns the current time or converts a date string to ISO UTC format
  ```javascript
  // Parameters:
  // - date: Optional date string to convert (default: current time)
  // Returns: "2025-03-24T22:48:45.000Z"
  ```

- **weather** - Fetches current weather and forecast data for a location
  ```javascript
  // Parameters:
  // - latitude: Location latitude (default: Evanston, IL)
  // - longitude: Location longitude (default: Evanston, IL)
  // - timezone: Timezone string (default: America/Chicago)
  // - past_days: Days of historical data (default: 1)
  // - forecast_days: Days of forecast data (default: 1)
  // Returns: Object with location, current, and hourly weather data
  ```

- **random** - Generates random numbers with various distribution options
  ```javascript
  // Parameters:
  // - min: Minimum value (default: 0)
  // - max: Maximum value (default: 1)
  // - mean: Mean for normal distribution
  // - stddev: Standard deviation for normal distribution
  // - integer: Return integer values (default: false)
  // - seed: Seed string for consistent generation
  // - precision: Number of decimal places
  // - currency: Format as currency (2 decimal places)
  // Returns: Random number based on parameters
  ```

- **roll** - Simulates dice rolls for tabletop gaming
  ```javascript
  // Parameters:
  // - number: Number of dice to roll (default: 1)
  // - sides: Number of sides on each die (default: 6)
  // Returns: { rolls: [3, 5], total: 8 }
  ```

#### Creating Custom Tools

Custom tools can be defined by implementing the `LlmTool` interface:

```javascript
import { Llm, LlmTool } from "jaypie";

const translateTool: LlmTool = {
  name: "translate",
  description: "Translates text to a specified language",
  type: "function",
  parameters: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "Text to translate"
      },
      targetLanguage: {
        type: "string",
        description: "Target language code (e.g., 'es', 'fr', 'de')"
      }
    },
    required: ["text", "targetLanguage"]
  },
  call: async ({ text, targetLanguage }) => {
    // Implementation of translation logic
    // Could call an external API or use a library
    return { translatedText: `[${targetLanguage}] ${text}` };
  },
  // Optional: Custom logging message
  message: "Translating text to another language"
};

// Tool with dynamic logging message
const weatherTool: LlmTool = {
  name: "weather",
  description: "Gets weather for a location",
  type: "function",
  parameters: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "Location to get weather for"
      }
    },
    required: ["location"]
  },
  call: async ({ location }) => {
    // Implementation
    return { temperature: 72, location };
  },
  // Dynamic message based on arguments
  message: (args, context) => `Getting weather for ${args.location}`
};

// Use the custom tool
const llm = new Llm();
const result = await llm.operate("Translate 'Hello world' to Spanish", {
  tools: [translateTool]
});
```

#### Using the Toolkit Class

For more advanced tool management, you can use the `Toolkit` class directly:

```javascript
import { Llm, Toolkit } from "jaypie";
import { toolkit } from "jaypie";

// Create a toolkit with options
const myToolkit = new Toolkit([toolkit.time, toolkit.weather], { 
  explain: true, // Adds __Explanation field to tool parameters
  log: true      // Enable tool call logging (default: true)
});

// Custom logging function
const customToolkit = new Toolkit([toolkit.time], {
  log: (message, context) => {
    console.log(`Tool ${context.name} called: ${message}`);
  }
});

// Use the toolkit in operate
const llm = new Llm();
const result = await llm.operate("What time is it and what's the weather?", {
  tools: myToolkit.tools,
  explain: true
});
```

##### Toolkit Options

- **explain** (boolean): Adds an `__Explanation` field to tool parameters, prompting the LLM to explain why it's calling the tool
- **log** (boolean | LogFunction): Controls tool call logging. Set to `false` to disable, or provide a custom logging function

##### Extending a Toolkit

You can add tools to an existing toolkit using the `extend` method:

```javascript
const myToolkit = new Toolkit([toolkit.time]);

// Add more tools
myToolkit.extend([toolkit.weather, toolkit.roll], {
  replace: true,  // Replace existing tools with same name (default: true)
  warn: true,     // Warn when replacing tools (default: true)
  explain: false, // Override explain setting for extended toolkit
  log: false      // Override log setting for extended toolkit
});
```

#### Advanced Operate Options

```javascript
import { Llm } from "jaypie";

const llm = new Llm();
const result = await llm.operate("What's the weather in {{city}}?", {
  // Template variables
  data: { city: "New York" },
  
  // Enable tool explanation mode
  explain: true,
  
  // Structured output format (natural schema or Zod)
  format: { 
    temperature: Number,
    conditions: String
  },
  
  // Previous conversation history
  history: [
    { role: "user", content: "Hi there", type: "message" },
    { role: "assistant", content: [{ text: "Hello! How can I help?", type: "output_text" }], type: "message" }
  ],
  
  // Tool execution hooks
  hooks: {
    // Called before each model request
    beforeEachModelRequest: ({ input, options, providerRequest }) => {
      console.log("Sending request to model");
      // Return value is ignored, can return Promise
    },
    // Called after each model response
    afterEachModelResponse: ({ input, options, providerRequest, providerResponse, content, usage }) => {
      console.log("Received response from model");
      // Return value is ignored, can return Promise
    },
    // Called before each tool execution
    beforeEachTool: ({ toolName, args }) => {
      console.log(`About to call ${toolName} with args: ${args}`);
      // Return value is ignored, can return Promise
    },
    // Called after each tool execution with the result
    afterEachTool: ({ result, toolName, args }) => {
      console.log(`Tool ${toolName} returned:`, result);
      // Can modify the result by returning a new value
      return result;
    },
    // Called when a tool throws an error
    onToolError: ({ error, toolName, args }) => {
      console.error(`Error in tool ${toolName}:`, error);
      // Return value is ignored, can return Promise
    },
    // Called when model encounters a retryable error
    onRetryableModelError: ({ input, options, providerRequest, error }) => {
      console.warn("Retryable error encountered, will retry:", error);
      // Return value is ignored, can return Promise
    },
    // Called when model encounters an unrecoverable error
    onUnrecoverableModelError: ({ input, options, providerRequest, error }) => {
      console.error("Unrecoverable error encountered:", error);
      // Return value is ignored, can return Promise
    }
  },
  
  // System instructions
  instructions: "You are a weather assistant for {{city}}",
  
  // Override default model
  model: "gpt-4o",
  
  // Control placeholder replacement
  placeholders: {
    input: true,      // Default: true - Replace in input
    instructions: true // Default: true - Replace in instructions
  },
  
  // Provider-specific options
  providerOptions: {},
  
  // System message (alternative to instructions)
  system: "You are a helpful assistant",
  
  // Array of tool definitions
  tools: [toolkit.weather],
  
  // Maximum conversation turns
  // true = default limit (12)
  // number = specific limit (max 72)
  turns: 3,
  
  // User identifier for the request
  user: "user-123"
});

// Access the results
console.log(result.content);  // Final text response
console.log(result.history);  // Full conversation history
console.log(result.output);   // Raw output items
console.log(result.responses); // Raw provider responses
console.log(result.status);   // "completed" or "incomplete"
console.log(result.usage);    // Token usage statistics
```

#### Available Models

##### OpenAI
- `LLM.PROVIDER.OPENAI.MODEL.DEFAULT` - GPT-4o (default)
- `LLM.PROVIDER.OPENAI.MODEL.GPT_4` - GPT-4
- `LLM.PROVIDER.OPENAI.MODEL.GPT_4_O` - GPT-4o
- `LLM.PROVIDER.OPENAI.MODEL.GPT_4_O_MINI` - GPT-4o Mini
- `LLM.PROVIDER.OPENAI.MODEL.GPT_4_5` - GPT-4.5 Preview
- `LLM.PROVIDER.OPENAI.MODEL.O1` - O1
- `LLM.PROVIDER.OPENAI.MODEL.O1_MINI` - O1 Mini
- `LLM.PROVIDER.OPENAI.MODEL.O1_PRO` - O1 Pro
- `LLM.PROVIDER.OPENAI.MODEL.O3_MINI` - O3 Mini
- `LLM.PROVIDER.OPENAI.MODEL.O3_MINI_HIGH` - O3 Mini High

##### Anthropic
- `LLM.PROVIDER.ANTHROPIC.MODEL.DEFAULT` - Claude 3.5 Sonnet
- `LLM.PROVIDER.ANTHROPIC.MODEL.CLAUDE_3_HAIKU` - Claude 3.5 Haiku
- `LLM.PROVIDER.ANTHROPIC.MODEL.CLAUDE_3_OPUS` - Claude 3 Opus
- `LLM.PROVIDER.ANTHROPIC.MODEL.CLAUDE_3_SONNET` - Claude 3.5 Sonnet

#### Configuration

The LLM package uses environment variables or AWS Secrets Manager for API keys:

- OpenAI: `OPENAI_API_KEY` or `SECRET_OPENAI_API_KEY`
- Anthropic: Coming soon

#### Static Methods

For convenience, both main methods are available as static methods:

```javascript
import { Llm } from "jaypie";

// Static send method
const response = await Llm.send("Hello, world!", {
  llm: LLM.PROVIDER.OPENAI.NAME,
  model: LLM.PROVIDER.OPENAI.MODEL.GPT_4_O,
  system: "You are a helpful assistant"
});

// Static operate method
const result = await Llm.operate("What time is it?", {
  llm: LLM.PROVIDER.OPENAI.NAME,
  model: LLM.PROVIDER.OPENAI.MODEL.GPT_4_O,
  tools: [toolkit.time]
});
```

#### Files and Images

Send files and images to LLMs using the simplified array syntax with automatic file loading and provider-specific format translation:

```javascript
import { Llm } from "jaypie";

const llm = new Llm();

// Image from local filesystem
const imageResult = await llm.operate([
  "Extract text from this image",
  { image: "/path/to/photo.png" }
]);

// PDF from local filesystem
const pdfResult = await llm.operate([
  "Summarize this document",
  { file: "/path/to/document.pdf" }
]);

// From S3 bucket
const s3Result = await llm.operate([
  "Analyze this file",
  { file: "documents/report.pdf", bucket: "my-bucket" }
]);

// Extract specific PDF pages
const pagesResult = await llm.operate([
  "Read pages 1-3",
  { file: "large-doc.pdf", pages: [1, 2, 3] }
]);

// With pre-loaded base64 data (skips file loading)
const base64Result = await llm.operate([
  "Describe this image",
  { image: "photo.jpg", data: base64String }
]);

// Multiple files and text
const multiResult = await llm.operate([
  "Compare these documents",
  { file: "doc1.pdf" },
  { file: "doc2.pdf" },
  "Focus on the methodology section"
]);
```

##### File Resolution Order

1. If `data` is present → uses base64 directly
2. If `bucket` is present → loads from S3
3. If `CDK_ENV_BUCKET` env var exists → loads from that S3 bucket
4. Otherwise → loads from local filesystem (relative to `process.cwd()`)

##### Input Types

| Property | Description |
|----------|-------------|
| `file` | Path to file (PDF or other document) |
| `image` | Path to image file |
| `bucket` | S3 bucket name (optional, uses `CDK_ENV_BUCKET` if not set) |
| `pages` | Array of page numbers to extract from PDF (optional, extracts all if omitted) |
| `data` | Base64-encoded file data (optional, skips file loading if provided) |

##### Supported Image Extensions

Files with these extensions are auto-detected as images: `png`, `jpg`, `jpeg`, `gif`, `webp`, `svg`, `bmp`, `ico`, `tiff`, `avif`

### TestKit

```bash
npm install --save-dev @jaypie/testkit
```

#### Mocking Jaypie

The testkit provides a complete mock for Jaypie, including:  

* Log spying (`expect(log.warn).toHaveBeenCalled()`)
* Default responses for runtime-only functions (`connect`, `sendMessage`, `submitMetric`)
* No automatic error handling for handlers (which is good in production but obfuscates tests)
* Most non-utility functions are mocked to allow simple testing

```javascript
vi.mock("jaypie", async () => vi.importActual("@jaypie/testkit/mock"));
```

#### Error Spying
  
```javascript
import { ConfigurationError } from "@jaypie/core";

vi.mock("jaypie", async () => vi.importActual("@jaypie/testkit/mock"));

test("ConfigurationError", () => {
  try {
    throw new ConfigurationError("Sorpresa!");
  } catch (error) {
    expect(error).toBeJaypieError();
    expect(ConfigurationError).toHaveBeenCalled();
  }
});
```

#### Log Spying

```javascript
import { log } from "jaypie";

vi.mock("jaypie", async () => vi.importActual("@jaypie/testkit/mock"));

afterEach(() => {
  vi.clearAllMocks();
});

test("log", () => {
  expect(vi.isMockFunction(log.warn)).toBe(true);
  expect(log.warn).not.toHaveBeenCalled();
  log.warn("Danger");
  expect(log.warn).toHaveBeenCalled();
  expect(log.error).not.toHaveBeenCalled();
});
```

👺 Logging Conventions:  

* Only use `log.trace` or `log.var` during "happy path"
* Use `log.debug` for edge cases
* Now you can add an "observability" test that will fail as soon as new code triggers an unexpected edge condition

```javascript
describe("Observability", () => {
  it("Does not log above trace", async () => {
    // Arrange
    // TODO: "happy path" setup
    // Act
    await myNewFunction(); // TODO: add any "happy path" parameters
    // Assert
    expect(log).not.toBeCalledAboveTrace();
    // or individually:
    expect(log.debug).not.toHaveBeenCalled();
    expect(log.info).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
    expect(log.fatal).not.toHaveBeenCalled();
  });
});
```

> 👺 Follow the "arrange, act, assert" pattern.  

#### Test Matchers

The testkit includes custom Jaypie matchers and all matchers from jest-extended. You don't need to install jest-extended separately.

testSetup.js

```javascript
import { matchers } from "@jaypie/testkit";
import { expect } from "vitest";

// Extend with all matchers (includes jest-extended)
expect.extend(matchers);
```

test.spec.js

```javascript
// Import types
import "@jaypie/testkit";
import { ConfigurationError } from "@jaypie/core";

// Use both Jaypie matchers and jest-extended matchers
const error = new ConfigurationError();
const json = error.json();
expect(error).toBeJaypieError(); // Jaypie matcher
expect(json).toBeJaypieError(); // Jaypie matcher
expect([1, 2, 3]).toBeArray(); // jest-extended matcher
expect(true).toBeBoolean(); // jest-extended matcher
```

#### TestKit Reference

```
import { 
  LOG,
  jsonApiErrorSchema,
  jsonApiSchema,
  matchers,
  mockLogFactory,
  restoreLog,
  spyLog,
} from '@jaypie/testkit'
```

##### `LOG`

`LOG` constant provided by `@jaypie/core` for convenience

```javascript
import { log } from "@jaypie/core";
import { LOG } from "@jaypie/testkit";

const libLogger = log.lib({ level: LOG.LEVEL.WARN, lib: "myLib" });
```

##### `jsonApiErrorSchema`

A [JSON Schema](https://json-schema.org/) validator for the [JSON:API](https://jsonapi.org/) error schema.  
It powers the `toBeJaypieError` matcher (via `toMatchSchema`).  

##### `jsonApiSchema`

A [JSON Schema](https://json-schema.org/) validator for the [JSON:API](https://jsonapi.org/) data schema.  

##### `matchers`

The matchers object includes both custom Jaypie matchers and all matchers from jest-extended:

```javascript
// Custom Jaypie matchers
export default {
  // Jaypie custom matchers
  toBeCalledAboveTrace,
  toBeCalledWithInitialParams,
  toBeClass,
  toBeJaypieError,
  toMatchBase64,
  toMatchJwt,
  toMatchMongoId,
  toMatchSchema: jsonSchemaMatchers.toMatchSchema,
  toMatchSignedCookie,
  toMatchUuid4,
  toMatchUuid5,
  toMatchUuid,
  toThrowBadGatewayError,
  toThrowBadRequestError,
  toThrowConfigurationError,
  toThrowForbiddenError,
  toThrowGatewayTimeoutError,
  toThrowInternalError,
  toThrowJaypieError,
  toThrowNotFoundError,
  toThrowUnauthorizedError,
  toThrowUnavailableError,
  
  // Includes all jest-extended matchers
  // toBeArray, toBeBoolean, toBeFalse, toBeFunction, etc.
  ...jestExtendedMatchers
};
```

testSetup.js

```javascript
import { matchers } from "@jaypie/testkit";
import { expect } from "vitest";

// One line to extend with both Jaypie and jest-extended matchers
expect.extend(matchers);
```

###### `expect(subject).toBeCalledAboveTrace()`

```javascript
import { log } from "@jaypie/core";

log.trace("Hello, World!");
expect(log).not.toBeCalledAboveTrace();

log.warn("Look out, World!");
expect(log).toBeCalledAboveTrace();
```

###### `expect(subject).toBeJaypieError()`

Validates instance objects:

```javascript
try {
  throw new Error("Sorpresa!");
} catch (error) {
  expect(error).not.toBeJaypieError();
}
```

Validates plain old JSON:

```javascript
expect({ errors: [ { status, title, detail } ] }).toBeJaypieError();
```

Jaypie errors, which are `ProjectErrors`, all have a `.json()` to convert

###### `expect(subject).toMatchSchema(schema)`

```javascript
import { jsonApiErrorSchema, jsonApiSchema } from "@jaypie/testkit";
import { ConfigurationError } from "@jaypie/core";

const error = new ConfigurationError();
const json = error.json();
expect(json).toMatchSchema(jsonApiErrorSchema);
expect(json).not.toMatchSchema(jsonApiSchema);
```

From `jest-json-schema`; see [README](https://github.com/americanexpress/jest-json-schema?tab=readme-ov-file#tomatchschemaschema)


###### `expect(subject).toMatch*()` Regular Expression Matchers

Note: these regular expressions matchers do not verify the value is valid, only that it matches the pattern (it "looks like" something).  
For example, `expect("123e4567-e89b-12d3-a456-426614174000").toMatchUuid()` will pass because the string matches a UUID pattern, even though it is not a valid UUID.  

* `toMatchBase64`
* `toMatchJwt`
* `toMatchMongoId`
* `toMatchSignedCookie`
* `toMatchUuid4`
* `toMatchUuid5`
* `toMatchUuid`

###### `expect(subject).toThrowJaypieError()`

```javascript
import { ConfigurationError } from "@jaypie/core";

const error = new ConfigurationError();
expect(() => {
  throw error;
}).toThrowJaypieError();
```

Do not forget to `await expect` when passing `async` functions:

```javascript
import { ConfigurationError } from "@jaypie/core";

const error = new ConfigurationError();
await expect(async () => {
  throw error;
}).toThrowJaypieError();

// Breaks and causes a false-positive because `expect` did not `await`
// expect(async () => {}).toThrowJaypieError();
// > Error: Expected function to throw a JaypieError, but it did not throw.
```

##### `mockLogFactory()`

Creates a mock of the `log` provided by `@jaypie/core`.  

```javascript
import { mockLogFactory } from "@jaypie/testkit";

const log = mockLogFactory();
log.warn("Danger");
expect(log.warn).toHaveBeenCalled();
expect(log.error).not.toHaveBeenCalled();
```

##### `restoreLog(log)`

Restores the `log` provided by `@jaypie/core`, commonly performed `afterEach` with `spyLog` in `beforeEach`.  
See example with `spyLog`.  

##### `spyLog(log)`

Spies on the `log` provided by `@jaypie/core`, commonly performed `beforeEach` with `restoreLog` in `afterEach`.  
This is not necessary when mocking the entire Jaypie module.  

```javascript
import { restoreLog, spyLog } from "@jaypie/testkit";
import { log } from "@jaypie/core";

beforeEach(() => {
  spyLog(log);
});
afterEach(() => {
  restoreLog(log);
  vi.clearAllMocks();
});

test("log", () => {
  log.warn("Danger");
  expect(log.warn).toHaveBeenCalled();
  expect(log.error).not.toHaveBeenCalled();
});
```

##### `sqsTestRecords(message, message, ...)` or `sqsTestRecords([...])`

Generates an event object for testing SQS Lambda functions with as many messages as provided.  
Note that the test will accept more than ten messages, but AWS will only send ten at a time.  

```javascript
import { sqsTestRecords } from "@jaypie/testkit";

const event = sqsTestRecords(
  { MessageId: "1", Body: "Hello, World!" },
  { MessageId: "2", Body: "Goodbye, World!" }
);
```

## 🛣️ Roadmap

* 1.2 - Converted to TypeScript?  
* 2.0 - Optional loading of Jaypie side packages?  

### Wishlist 🌠

* Complete conversion to TypeScript.  
* Incomplete: aws, core, datadog, express, jaypie, lambda, mongoose.  
* Nicely organized VitePress documentation 😅.  
* More packages: auth0, commander, hygen, llm.
* Mongoose project schema.
* Better mocking of Mongoose.

## 📝 Changelog

| Date       | Version | Summary        |
| ---------- | ------- | -------------- |
|   2/4/2025 |  1.1.22 | Best-effort support for types |
| 10/21/2024 |  1.1.0  | Jaypie 1.1.0 release |
| 10/16/2024 |  1.0.50 | Last 1.0.x release |
|   5/4/2024 |  1.0.24 | Adds `@jaypie/datadog` |
|  3/19/2024 |  1.0.0  | First publish with `@jaypie/core@1.0.0` |
|  3/15/2024 |  0.1.0  | Initial deploy |
|  3/15/2024 |  0.0.1  | Initial commit |

## 🖇️ Footnotes

Keep `chalk` at `4`; `chalk` moves to ESM only in `5`.  

Packages receive patch releases as needed.  
The main Jaypie package must be patched to include the updated packages if applicable.  
For example,  
* `npm -w packages/core version patch`
* (push deploy)
* `npm -w packages/jaypie install @jaypie/core@latest`
* `npm -w packages/jaypie version patch`

Process for minor releases:  

* Update core, eslint (no internal dependencies).
* Update aws, constructs, express, lambda.
* Update datadog, mongoose (depend on aws).  
* Update jaypie (depends on above).  
* Update testkit (depends on jaypie).  
* Update outer repo (private management monorepo).  

## 📜 License

[MIT License](./LICENSE.txt).  
Published by Finlayson Studio.    
