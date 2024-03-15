# Jaypie 🐦‍⬛

Event-driven fullstack architecture centered around JavaScript, AWS, and the JSON:API specification

"JavaScript on both sides and underneath"

## 🐦‍⬛ Introduction

Jaypie is an opinionated approach to application development centered around JavaScript and the JSON:API specification in an event-driven architecture.

Jaypie is suited for applications that need custom infrastructure to generate and response to events beyond HTTP requests (e.g., message queue). If no custom infrastructure is needed, fullstack hosts like Vercel or Netlify are recommended.

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

Jaypie is for JavaScript developers building fullstack applications. 

#### JavaScript Only

Jaypie uses the AWS Cloud Development Kit (CDK) to manage infrastructure, which is written in Node.js. This makes managing infrastructure accessible to the fullstack developer without learning a new syntax and living without language constructs like loops and inheritance.

Does NOT use Kubernetes, Docker, Terraform, or the "Serverless" framework. These are powerful tools in the hands of a specialist but require too much mental overhead for a fullstack developer making occasional changes.

#### Eject Anything

Jaypie embraces "ejectability," the philosophy that any part of the framework can be removed (and therefore replaced) without disturbing the whole.

#### Mockable Everywhere

Jaypie strives to be "mockable-first" meaning all components should be easily tested via default or provided mocks.

## 📋 Usage

### Installation

```bash
npm install jaypie
```

TODO: need to document peer dependencies

### Example

TODO: Example should include one trivial and possibly one thorough example of using the library

## 📖 Reference

TODO: Reference should be a complete list of everything in the package

## 📝 Changelog

| Date       | Version | Summary        |
| ---------- | ------- | -------------- |
|  3/15/2024 |   0.0.1 | Initial commit |

## 📜 License

Published by Finlayson Studio. All rights reserved
