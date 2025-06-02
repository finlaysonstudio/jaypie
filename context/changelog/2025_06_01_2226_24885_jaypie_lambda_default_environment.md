# jaypie lambda default environment

packages/constructs/src/JaypieLambda.ts
packages/constructs/src/__tests__/JaypieLambda.spec.ts

I want JaypieLambda to check to see if any of these environment variables are present and if so to make them part of the environment passed to lambda:

DATADOG_API_KEY_ARN
LOG_LEVEL
MODULE_LOGGER
MODULE_LOG_LEVEL
PROJECT_COMMIT
PROJECT_ENV
PROJECT_KEY
PROJECT_SECRET
PROJECT_SERVICE
PROJECT_SPONSOR
PROJECT_VERSION
