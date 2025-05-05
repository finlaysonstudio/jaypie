# Unmocked Exports from @jaypie Packages

This document lists exports from `@jaypie` packages that are not currently mocked in `@packages/testkit/src/jaypie.mock.ts`.

Update packages/testkit/src/jaypie.mock.ts to provide the const, in the case of a const, or the implementation wrapped in a mock for functions

## @jaypie/aws
- getSingletonMessage

## @jaypie/core
- envsKey
- errorFromStatusCode
- force
- formatError
- getHeaderFrom
- getObjectKeyCaseInsensitive
- isClass
- isJaypieError
- optional
- PROJECT
- required
- safeParseFloat
- VALIDATE

## @jaypie/datadog
- DATADOG

## @jaypie/express
- EXPRESS
- cors
- expressHttpCodeHandler
- Route functions:
  - badRequestRoute
  - echoRoute
  - forbiddenRoute
  - goneRoute
  - methodNotAllowedRoute
  - noContentRoute
  - notFoundRoute
  - notImplementedRoute

## @jaypie/llm
- LLM (constants)
- LlmMessageOptions
- LlmOperateOptions
- LlmOperateResponse
- LlmOptions
- LlmProvider
- LlmTool
- toolkit
- tools
- Tool functions:
  - random
  - roll
  - time
  - weather