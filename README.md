# Jaypie 🐦‍⬛

Event-driven fullstack architecture centered around JavaScript, AWS, and the JSON:API specification

"JavaScript on both sides and underneath"

## 🐦‍⬛ Introduction

Jaypie is an opinionated approach to application development centered around JavaScript and the JSON:API specification in an event-driven architecture.

Jaypie is suited for applications that require custom infrastructure beyond HTTP requests (e.g., message queues). Without custom infrastructure, fullstack hosts like Vercel or Netlify are recommended.

### "Jaypie Stack"

* AWS infrastructure managed by CDK in Node.js
* Express server running on AWS Lambda
* Node.js worker processes running on AWS Lambda
* MongoDB via Mongoose
* Vue ecosystem frontend: Vue 3 composition, Vuetify, Pinia
* Vitest for testing
* ES6 syntax enforced via ESLint
* Prettier formatting
* JSON logging with custom metadata

### Philosophy

Jaypie is for building fullstack JavaScript applications. 

#### JavaScript Only 💛

Jaypie uses the AWS Cloud Development Kit (CDK) to manage infrastructure, which is written in Node.js. This makes managing infrastructure accessible to the fullstack developer without learning a new syntax and living without language constructs like loops and inheritance.

Does NOT use Kubernetes, Docker, Terraform, or the "Serverless" framework. 

#### Eject Anything ⏏️

Jaypie embraces "ejectability," the philosophy that any part of the code can be removed (and therefore replaced) without disturbing the whole.

#### Mock Everywhere 🎴

Jaypie strives to be "mockable-first" meaning all components should be easily tested via default or provided mocks.

## 📋 Usage

### Installation

#### Base Package

```bash
npm install jaypie
```

`@jaypie/core` is included in `jaypie`.  Almost every Jaypie package requires core.

#### Peer Packages

These packages are included in `jaypie`. They may be installed separately in the future.

| Package | Exports | Description |
| ------- | ------- | ----------- |
| `@jaypie/aws` | `getMessages`, `getSecret`, `sendBatchMessages`, `sendMessage` | AWS helpers |
| `@jaypie/datadog` | `submitMetric`, `submitMetricSet` | Datadog helpers |
| `@jaypie/express` | `expressHandler` | Express entry point |
| `@jaypie/lambda` | `lambdaHandler` | Lambda entry point |
| `@jaypie/mongoose` | `connect`, `connectFromSecretEnv`, `disconnect`, `mongoose` | MongoDB management |

#### TestKit

Matchers, mocks, and utilities to test Jaypie projects.

```bash
npm install --save-dev @jaypie/testkit
```

### Example

```bash
npm install jaypie @jaypie/lambda
```

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

This example would then be deployed to AWS via CDK or similar orchestration. See [@jaypie/cdk](https://github.com/finlaysonstudio/jaypie-cdk).

## 📖 Reference

### AWS

```javascript
import { 
  getMessages,
  getSecret,
  sendBatchMessages,
  sendMessage,
} from "jaypie";
```

#### `getMessages(event)`

Return an array of message bodies from an SQS event.

```javascript
import { getMessages } from '@jaypie/aws';

const messages = getMessages(event);
// messages = [{ salutation: "Hello, world!" }, { salutation: "Hola, dushi!" }]
```

#### `getSecret(secretName: string)`

Retrieve a secret from AWS Secrets Manager using the secret name.

```javascript
import { getSecret } from '@jaypie/aws';

const secret = await getSecret("MongoConnectionStringN0NC3-nSg1bR1sh");
// secret = "mongodb+srv://username:password@env-project.n0nc3.mongodb.net/app?retryWrites=true&w=majority";
```

#### `sendBatchMessages({ messages, queueUrl })`

Batch and send messages to an SQS queue. If more than ten messages are provided, the function will batch them into groups of ten or less (per AWS).

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

Send a single message to an SQS queue.

```javascript
import { sendMessage } from '@jaypie/aws';

const body = "Hello, world!";
const queueUrl = "https://sqs.us-east-1.amazonaws.com/123456789012/MyQueue";

const response = await sendMessage({ body, queueUrl });
```

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `body` | `string` | Yes | Message body |
| `delaySeconds` | `number` | No | Seconds to delay message delivery; default `0` |
| `messageAttributes` | `object` | No | Message attributes |
| `messageGroupId` | `string` | No | Custom message group for FIFO queues; default provided |
| `queueUrl` | `string` | Yes | URL of the SQS queue |

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

The Express handler wraps the Jaypie handler for Express running on AWS Lambda. It will call lifecycle methods and provide logging. Unhandled errors will be thrown as `UnhandledError`. It adds the `locals` lifecycle call. It extends `jaypieHandler`, not the lambda handler.

```javascript
const { expressHandler } = require("jaypie");

const handler = expressHandler(async(req, res) => {
  // await new Promise(r => setTimeout(r, 2000));
  // log.debug("Hello World");
  return { message: "Hello World" };
}, { name: "lambdaReference"});
```

The order of options and handler may be swapped to improve readability. Having lifecycle methods listed before the handler may read more intuitively.

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

Do not use `res.send` or `res.json` in the handler. The return value of the handler is the response body. The status code is determined by the error thrown or the return value. Custom status codes can be set by calling `res.status` in the handler.

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

_A "handler" returns a function that can be used as an Express route. A "route" does not require instantiation._

```javascript
import { 
  echoRoute,
  EXPRESS,
  forbiddenRoute,
  goneRoute,
  noContentRoute,
  notFoundRoute,
  notImplementedRoute,
} from "jaypie";

app.get(EXPRESS.PATH.ROOT, noContentRoute); // 204 No Content
app.get(EXPRESS.PATH.ANY, echoRoute); // 200 OK returning the request
app.post(EXPRESS.PATH.ANY, forbiddenRoute); // 403 Forbidden
app.any("/future", notImplementedRoute); // 400 Bad Request
```

`notImplementedRoute` returns "400 Bad Request" as a placeholder for future functionality. In this regard, calling it is a "user error." The "501 Not Implemented" status code is reserved for the server not supporting parts of the HTTP protocol such as `POST` or `PUT`.

### Functions

#### `cloneDeep`

`lodash.clonedeep` from [NPM](https://www.npmjs.com/package/lodash.clonedeep)

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

`envsKey(key:string, { env:string = process.env.PROJECT_ENV || process.env.DEFAULT_ENV })`

return `process.env.${KEY} || ENV_${ENV}_${KEY} || false`

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

Case-insensitive search inside `searchObject` for `headerKey`.  Also looks in `header` and `headers` child object of `searchObject`, if `headerKey` not found at top-level.

#### `getObjectKeyCaseInsensitive(object:object, key:string)`

Case-insensitive search for `key` in `object`.  Returns the value of the key or `undefined`.

#### `placeholders`

Lightweight string interpolation

```javascript
import { placeholders } from "jaypie";

const string = placeholders("Hello, {name}!", { name: "World" });
// string = "Hello, World!"
```

The code for placeholders was written by Chris Ferdinandi and distributed under the MIT License in 2018-2019. Their web site is https://gomakethings.com

#### `safeParseFloat`

`parseFloat` that returns `0` for `NaN`

#### `sleep`

`sleep` is a promise-based `setTimeout` that resolves after a specified number of milliseconds. It will NOT run when `NODE_ENV` is `test`. See `sleepAlways` for a version that will run in tests.

```javascript
import { sleep } from "jaypie";

await sleep(2000);
```

_This is "bad code" because it checks `NODE_ENV` during runtime. The "right way" is to let sleep run and mock it in tests, in practice this is needless boilerplate. A fair compromise would be to mock `sleep` with `@jaypie/testkit` but not all projects include that dependency. Jaypie will trade academically incorrect for human convenience and simplicity._

#### `uuid`

The `v4` function from the `uuid` package

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

The Jaypie handler can be used directly but is more likely to be wrapped in a more specific handler. The Jaypie handler will call lifecycle methods and provide logging. Unhandled errors will be thrown as `UnhandledError`.

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

Returns `true` to validate the request. Throw an error or return `false` to reject the request.

##### `setup: [async Function]`

Called before the handler (e.g., connect to a database). Throw an error to halt execution.

##### `handler: async Function`

The main function to handle the request. Throw an error to halt execution.

##### `teardown: [async Function]`

Called after the handler (e.g., disconnect from a database). Runs even if setup or handler throws errors.

### Lambda Handler

The Lambda handler wraps the Jaypie handler for AWS Lambda. It will call lifecycle methods and provide logging. Unhandled errors will be thrown as `UnhandledError`.

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

Uses `silent` by default.  if `process.env.MODULE_LOG_LEVEL` is `true`, follows `process.env.LOG_LEVEL`.  If `process.env.MODULE_LOG_LEVEL` is also set, uses that log level.

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

Log a key-value pair. In the `json` format, the key will be tagged as `var` and the value will be the value. Logging marker variables this way can be useful for debugging.

```javascript
import { log } from "jaypie";

log.var("message", "Hello, world");
log.var({ message: "Hello, world" });

const message = "Hello, world";
log.var({ message });
```

##### log.with() - clone

Create a new log object with additional tags

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

Jaypie lifecycle method to connect to MongoDB. Uses `process.env.SECRET_MONGODB_URI` AWS Secret or `process.env.MONGODB_URI` string to connect.

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

Jaypie lifecycle method to connect to MongoDB using `process.env.MONGO_CONNECTION_STRING`. Using the newer `connect` is generally preferred.

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

`mongoose` from [NPM](https://www.npmjs.com/package/mongoose)

```javascript
import { mongoose } from "jaypie";
```

### TestKit

```bash
npm install --save-dev @jaypie/testkit
```

#### Log Spying

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
    expect(log.debug).not.toHaveBeenCalled();
    expect(log.info).not.toHaveBeenCalled();
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
    expect(log.fatal).not.toHaveBeenCalled();
  });
});
```

> 👺 Follow the "arrange, act, assert" pattern

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

###### `expect(subject).toBeValidSchema()`

```javascript
import { jsonApiErrorSchema, jsonApiSchema } from "@jaypie/testkit";

expect(jsonApiErrorSchema).toBeValidSchema();
expect(jsonApiSchema).toBeValidSchema();
expect({ project: "mayhem" }).not.toBeValidSchema();
```

From `jest-json-schema` [toBeValidSchema.js](https://github.com/americanexpress/jest-json-schema/blob/main/matchers/toBeValidSchema.js) (not documented in README)

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

#### TestKit Sundry

```
import { 
  jsonApiErrorSchema,
  jsonApiSchema,
  mockLogFactory,
} from '@jaypie/testkit'
```

##### `jsonApiErrorSchema`

A [JSON Schema](https://json-schema.org/) validator for the [JSON:API](https://jsonapi.org/) error schema. Powers the `toBeJaypieError` matcher (via `toMatchSchema`).

##### `jsonApiSchema`

A [JSON Schema](https://json-schema.org/) validator for the [JSON:API](https://jsonapi.org/) data schema.


##### `mockLogFactory()`

Creates a mock of the `log` provided by `@jaypie/core`.

```javascript
import { mockLogFactory } from "@jaypie/testkit";

const log = mockLogFactory();
log.warn("Danger");
expect(log.warn).toHaveBeenCalled();
expect(log.error).not.toHaveBeenCalled();
```

### `restoreLog(log)`

Restores the `log` provided by `@jaypie/core`, commonly performed `afterEach` with `spyLog` in `beforeEach`. See example with `spyLog`.

### `spyLog(log)`

Spies on the `log` provided by `@jaypie/core`, commonly performed `beforeEach` with `restoreLog` in `afterEach`.

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

## 🛣️ Roadmap

Structural Changes:

* 1.1.0 - Deploy Jaypie from monorepo
* 1.2.0 - Optional loading of Jaypie side packages

### Wishlist 🌠

* Nicely organized VitePress documentation 😅

## 📝 Changelog

| Date       | Version | Summary        |
| ---------- | ------- | -------------- |
| 10/16/2024 |  1.0.50 | Last 1.0.x release |
|   5/4/2024 |  1.0.24 | Adds `@jaypie/datadog` |
|  3/19/2024 |   1.0.0 | First publish with `@jaypie/core@1.0.0` |
|  3/15/2024 |   0.1.0 | Initial deploy |
|  3/15/2024 |   0.0.1 | Initial commit |

## 📜 License

Published by Finlayson Studio. All rights reserved
