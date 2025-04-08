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
* Vue ecosystem frontend: Vue 3 composition, Vuetify, Pinia.
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

`@jaypie/core` is included in `jaypie`.  
Almost every Jaypie package requires core.  

#### Included Packages

These packages are included in `jaypie`.  
They may be installed separately in the future.  

| Package | Exports | Description |
| ------- | ------- | ----------- |
| `@jaypie/aws` |  `getEnvSecret`, `getMessages`, `getSecret`, `getSingletonMessage`, `getTextractJob`, `sendBatchMessages`, `sendMessage`, `sendTextractJob` | AWS helpers |
| `@jaypie/datadog` | `submitMetric`, `submitMetricSet` | Datadog helpers |
| `@jaypie/express` | `badRequestRoute`, `cors`, `echoRoute`, `expressHandler`, `expressHttpCodeHandler`, `forbiddenRoute`, `goneRoute`, `methodNotAllowedRoute`, `noContentRoute`, `notFoundRoute`, `notImplementedRoute`, | Express entry point |
| `@jaypie/lambda` | `lambdaHandler` | Lambda entry point |
| `@jaypie/llm` | `Llm` | LLM helpers |
| `@jaypie/mongoose` | `connect`, `connectFromSecretEnv`, `disconnect`, `mongoose` | MongoDB management |

#### TestKit

Matchers, mocks, and utilities to test Jaypie projects.

```bash
npm install --save-dev @jaypie/testkit
```

#### WebKit

Frontend utilities for Jaypie.

```bash
npm install @jaypie/webkit
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
See [@jaypie/cdk](https://github.com/finlaysonstudio/jaypie-cdk).  

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

Checks for `${name}_SECRET` and `SECRET_${name}` in environment variables.  
If found, retrieves the secret from AWS Secrets Manager.  
Otherwise, returns the value of `name`.  
This is convenient for using the environment locally and a secret when deployed.  

```javascript
import { getEnvSecret } from "jaypie";

const secret = await getEnvSecret("MONGODB_URI");
// secret = "mongodb+srv://username:password@env-project.n0nc3.mongodb.net/app?retryWrites=true&w=majority";
```

#### `getMessages(event)`

Returns an array of message bodies from an SQS event.  

```javascript
import { getMessages } from '@jaypie/aws';

const messages = getMessages(event);
// messages = [{ salutation: "Hello, world!" }, { salutation: "Hola, dushi!" }]
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

```javascript
import { getTextractJob } from '@jaypie/aws';

const textractResults = await getTextractJob(jobId); // Array of Textract blocks
const raw = JSON.stringify(textractResults);
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

#### `sendMessage({ body, queueUrl })`

Sends a single message to an SQS queue.  

```javascript
import { sendMessage } from '@jaypie/aws';

const body = "Hello, world!";
const queueUrl = "https://sqs.us-east-1.amazonaws.com/123456789012/MyQueue";

const response = await sendMessage({ body, queueUrl });
```

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `body` | `string`, `object` | Yes | Message body |
| `delaySeconds` | `number` | No | Seconds to delay message delivery; default `0` |
| `messageAttributes` | `object` | No | Message attributes |
| `messageGroupId` | `string` | No | Custom message group for FIFO queues; default provided |
| `queueUrl` | `string` | No | URL of the SQS queue; defaults to `process.env.CDK_ENV_QUEUE_URL` |

#### `sendTextractJob({ key, bucket, featureTypes, snsRoleArn, snsTopicArn })`

Sends a Textract job to AWS Textract.  

```javascript
import { sendTextractJob } from '@jaypie/aws';

const jobId = await sendTextractJob({
  key: "document.pdf",
  bucket: "my-bucket",
  featureTypes: ["FORMS", "LAYOUT", "SIGNATURES", "TABLES"], // Optional, defaults to FORMS, LAYOUT, SIGNATURES, TABLES
  snsRoleArn: "arn:aws:iam::123456789012:role/TextractRole", // Optional
  snsTopicArn: "arn:aws:sns:us-east-1:123456789012:TextractTopic" // Optional
});
```

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `key` | `string` | Yes | S3 object key |
| `bucket` | `string` | Yes | S3 bucket name |
| `featureTypes` | `array` | No | Array of Textract feature types; defaults to `["FORMS", "LAYOUT", "SIGNATURES", "TABLES"]` |
| `snsRoleArn` | `string` | No | SNS IAM role ARN for notifications |
| `snsTopicArn` | `string` | No | SNS topic ARN for notifications |

### CDK Constructs

Jaypie CDK patterns with common conventions.  

```bash
npm install --save-dev @jaypie/constructs
```

```javascript
import { 
  JaypieEnvSecret,
  JaypieHostedZone, 
  JaypieMongoDbSecret,
  JaypieOpenAiSecret,
  JaypieQueuedLambda,
  JaypieTraceSigningKeySecret,
} from "@jaypie/constructs";
```

#### `JaypieEnvSecret`

Manages build-environment secrets, allowing consumer environments (personal environments) to import from provider environments (sandbox).  

Most Jaypie projects will not need to specify `consumer` or `provider` properties, as the construct will automatically handle the correct behavior based on the environment.  

```typescript
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

##### Convenience Secrets

```typescript
import { JaypieMongoDbSecret, JaypieOpenAiSecret, JaypieTraceSigningKeySecret } from "@jaypie/constructs";

const mongoConnectionString = new JaypieMongoDbSecret(this);
const openAiKey = new JaypieOpenAiSecret(this);
const traceSigningKey = new JaypieTraceSigningKeySecret(this);
```

#### `JaypieHostedZone`

Route53 hosted zone with query logging and optional log forwarding.  

```typescript
const zone = new JaypieHostedZone(this, 'Zone', {
  zoneName: 'example.com',
  service: 'api',           // Service tag value
  project: 'mayhem',     // Project tag value
  destination: logHandler   // Optional Lambda destination for logs
});
```

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `zoneName` | `string` | Yes | Domain name for the hosted zone |
| `service` | `string` | No | Service tag value, defaults to CDK.SERVICE.INFRASTRUCTURE |
| `project` | `string` | No | Project tag value |
| `destination` | `LambdaDestination` | No | Optional log destination for query logs |

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
| `runtime` | `lambda.Runtime` | No | Lambda runtime, default NODEJS_20_X |
| `secrets` | `JaypieEnvSecret[]` | No | JaypieEnvSecrets to inject |
| `timeout` | `Duration \| number` | No | Lambda timeout duration or number of seconds, defaults to CDK.DURATION.LAMBDA_WORKER (120 seconds) |
| `vendorTag` | `string` | No | Vendor tag for resource management |
| `visibilityTimeout` | `Duration \| number` | No | SQS visibility timeout |

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

#### `VALIDATE`

* `VALIDATE.ANY` - Default
* `VALIDATE.ARRAY`
* `VALIDATE.CLASS`
* `VALIDATE.FUNCTION`
* `VALIDATE.NUMBER`
* `VALIDATE.NULL`
* `VALIDATE.OBJECT`
* `VALIDATE.STRING`
* `VALIDATE.UNDEFINED`

#### Internal Constants

* `JAYPIE` - for consistency across Jaypie
* `PROJECT` - for consistency across projects

### Datadog

```javascript
const { 
  submitMetric, 
  submitMetricSet 
} = require("jaypie");
```

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

#### `validate`

```javascript
import { validate, VALIDATE } from "jaypie";

validate(argument, {
  type: VALIDATE.ANY,
  falsy: false,     // When `true`, allows "falsy" values that match the type (e.g., `0`, `""`)
  required: true,   // When `false`, allows `undefined` as a valid value
  throws: true      // When `false`, returns `false` instead of throwing error
});
```

##### Validate Convenience Functions

``` javascript
import { validate } from "jaypie";

validate.array(argument);
validate.class(argument);
validate.function(argument);
validate.null(argument);
validate.number(argument);
validate.object(argument);
validate.string(argument);
validate.undefined(argument);
```

##### Intuitive Validate Types

_Does not include any, class, or undefined_

``` javascript
validate(argument, {
  // One of:
  type: Array,
  type: Function,
  type: Number,
  type: null,
  type: Object,
  type: String,
})
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

// With custom model
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
  }
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

// Create a toolkit with explanation mode enabled
const myToolkit = new Toolkit([toolkit.time, toolkit.weather], { 
  explain: true // Adds __Explanation field to tool parameters
});

// Use the toolkit in operate
const llm = new Llm();
const result = await llm.operate("What time is it and what's the weather?", {
  tools: myToolkit.tools,
  explain: true
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

testSetup.js

```javascript
import { matchers as jaypieMatchers } from "@jaypie/testkit";
import * as extendedMatchers from "jest-extended";
import { expect } from "vitest";

expect.extend(extendedMatchers);
expect.extend(jaypieMatchers);
```

test.spec.js

```javascript
import { ConfigurationError } from "@jaypie/core";

const error = new ConfigurationError();
const json = error.json();
expect(error).toBeJaypieError();
expect(json).toBeJaypieError();
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

```javascript
export default {
  toBeCalledAboveTrace,
  toBeCalledWithInitialParams,
  toBeClass,
  toBeJaypieError,
  toBeValidSchema: jsonSchemaMatchers.toBeValidSchema,
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
};
```

testSetup.js

```javascript
import { matchers as jaypieMatchers } from "@jaypie/testkit";
import * as extendedMatchers from "jest-extended";
import { expect } from "vitest";

expect.extend(extendedMatchers);
expect.extend(jaypieMatchers);
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

### WebKit

Browser-optimized, framework-agnostic frontend utilities for Jaypie.  

```bash
npm install @jaypie/webkit
```

#### WebKit Reference

```
import { 
  uuid
} from '@jaypie/webkit'
```

##### `uuid`

The `v4` function from the `uuid` package.  

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
* @jaypie/constructs replaces @jaypie/cdk.  

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
* Update aws, cdk, express, lambda (depend on core).  
* Update datadog, mongoose (depend on aws).  
* Update jaypie (depends on above).  
* Update testkit (depends on jaypie).  
* Update outer repo (private management monorepo).  

## 📜 License

[MIT License](./LICENSE.txt).  
Published by Finlayson Studio.  
