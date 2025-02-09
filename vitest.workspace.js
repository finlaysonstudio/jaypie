import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/aws",
  "packages/core",
  "packages/constructs",
  "packages/datadog",
  "packages/errors",
  "packages/eslint",
  "packages/express",
  "packages/jaypie",
  "packages/lambda",
  "packages/llm",
  "packages/mongoose",
  "packages/testkit",
  "packages/textract",
  "packages/webkit",
]);
