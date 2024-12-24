import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/aws",
  "packages/core",
  "packages/datadog",
  "packages/errors",
  "packages/eslint",
  "packages/express",
  "packages/jaypie",
  "packages/lambda",
  "packages/mongoose",
  "packages/testkit",
  "packages/webkit",
]);
