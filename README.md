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

`@jaypie/core` is part of `jaypie` and almost any Jaypie package.

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
const { lambdaHandler, log, NotFoundError } = require("jaypie");

export const handler = lambdaHandler(async({event}) => {
  // await new Promise(r => setTimeout(r, 2000));
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

TODO: Complete list of constants in the package

### Errors

TODO: Complete list of errors in the package

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
