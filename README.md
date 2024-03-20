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

#### Peer Dependencies

You must install peer dependencies for your project.

| Package | Exports | Description |
| ------- | ------- | ----------- |
| `@jaypie/aws` | `getSecret` | AWS helpers |
| `@jaypie/lambda` | `lambdaHandler` | Lambda entry point |
| `@jaypie/mongoose` | `connectFromSecretEnv`, `disconnect`, `mongoose` | MongoDB management |

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

This example would then be deployed to AWS via CDK or similar orchestration.

_A `@jaypie/cdk` package is intended_

## 📖 Reference

### AWS

```javascript
import { getSecret } from '@jaypie/aws';

const secret = await getSecret("MongoConnectionStringN0NC3-nSg1bR1sh");
// secret = "mongodb+srv://username:password@env-project.n0nc3.mongodb.net/app?retryWrites=true&w=majority";
```

### Constants

```javascript
import { 
  CDK,
  ERROR,
  HTTP,
  LOG,
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

#### `ERROR`

Default messages and titles for Jaypie errors.

* `ERROR.MESSAGE`
* `ERROR.TITLE`

See `HTTP` for status codes.

#### `HTTP`

* `HTTP.ALLOW.ANY`
* `HTTP.CODE`: `OK`, `CREATED`, ...
* `HTTP.CONTENT.ANY`
* `HTTP.CONTENT.HTML`
* `HTTP.CONTENT.JSON`
* `HTTP.CONTENT.TEXT`
* `HTTP.HEADER`: ...
* `HTTP.METHOD`: `GET`, `POST`, ...

#### `LOG`

* `LOG.FORMAT`
* `LOG.LEVEL`

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

### Errors

#### Throwing/Catching Errors

``` javascript
// See `Error Reference` for full list
const { InternalError } = require("@knowdev/errors");

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
| `UnavailableError`      | 503    | The thing you are looking for cannot come to the phone right now |
| `UnhandledError`        | 500    | An error that should have been handled wasn't |
| `UnreachableCodeError`  | 500    |

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
const { envBoolean } = require("@knowdev/functions");

process.env.AWESOME = true;

if (envBoolean("AWESOME")) {
  console.log("Awesome!");
}
```

##### `envBoolean`: `defaultValue`

``` javascript
const { envBoolean } = require("@knowdev/functions");

if (envBoolean("AWESOME", { defaultValue: true })) {
  console.log("Awesome!");
}
```

#### `force`

Coerce a value into a type or throw an error.

```javascript
import { force } from "jaypie";

argument = force(thing, Array);
argument = force([thing], Array);
// argument = [thing]
```

Forcing arrays is the primary use case.

```javascript
// force supports Array, Object, and String
argument = force(argument, Array);
argument = force(argument, Object, "key");
argument = force(argument, String, "default");

// Convenience functions
argument = force.array(argument);
argument = force.object(argument, "key");
argument = force.string(argument);
```

#### `getHeaderFrom`

`getHeaderFrom(headerKey:string, searchObject:object)`

Case-insensitive search inside `searchObject` for `headerKey`.  Also looks in `header` and `headers` child object of `searchObject`, if `headerKey` not found at top-level.

#### `placeholders`

Lightweight string interpolation

```javascript
import { placeholders } from "jaypie";

const string = placeholders("Hello, {name}!", { name: "World" });
// string = "Hello, World!"
```

The code for placeholders was written by Chris Ferdinandi and distributed under the MIT License in 2018-2019. Their web site is https://gomakethings.com

#### `validate`

```javascript
import { validate, VALIDATE } from "jaypie";

validate(argument, {
  type: TYPE.ANY,
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

#### `handler: async Function`

The main function to handle the request. Throw an error to halt execution.

##### `teardown: [async Function]`

Called after the handler (e.g., disconnect from a database). Runs even if setup or handler throws errors.

### Lambda Handler

The Lambda handler wraps the Jaypie handler that is specifically for AWS Lambda. It will call lifecycle methods and provide logging. Unhandled errors will be thrown as `UnhandledError`.

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
  LOG, // LOG.FORMAT, LOG.LEVEL
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

TODO: The Mongoose package

### TestKit

TODO: The TestKit package

## 🌠 Wishlist

* `@jaypie/cdk` - CDK package
* `@jaypie/express` - Express package
* ...Nicely organized VitePress documentation 😅

## 📝 Changelog

| Date       | Version | Summary        |
| ---------- | ------- | -------------- |
|  3/19/2024 |   1.0.0 | First publish with `@jaypie/core@1.0.0` |
|  3/15/2024 |   0.1.0 | Initial deploy |
|  3/15/2024 |   0.0.1 | Initial commit |

## 📜 License

Published by Finlayson Studio. All rights reserved
