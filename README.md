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
  LOG,
} from "jaypie";
```

#### `CDK`

* `CDK.ACCOUNT`
* `CDK.ENV`
* `CDK.ROLE`
* `CDK.SERVICE`
* `CDK.TAG`

See [constants.js in @jaypie/core](https://github.com/finlaysonstudio/jaypie-core/blob/main/src/core/constants.js).

#### `LOG`

* `LOG.FORMAT`
* `LOG.LEVEL`

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

TODO: Complete list of utility functions in the package

### Jaypie Handler

TODO: The Jaypie handler

### Lambda Handler

```javascript
const { lambdaHandler } = require("jaypie");

const handler = lambdaHandler(async({event}) => {
  // await new Promise(r => setTimeout(r, 2000));
  // log.debug("Hello World");
  return "Hello World";
}, { name: "reference"});
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

## 📝 Changelog

| Date       | Version | Summary        |
| ---------- | ------- | -------------- |
|  3/19/2024 |   1.0.0 | First publish with `@jaypie/core@1.0.0` |
|  3/15/2024 |   0.1.0 | Initial deploy |
|  3/15/2024 |   0.0.1 | Initial commit |

## 📜 License

Published by Finlayson Studio. All rights reserved
