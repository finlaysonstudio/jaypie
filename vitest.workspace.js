import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/aws",
  "packages/core",
  "packages/datadog",
  "packages/eslint",
  "packages/express",
  "packages/jaypie",
  "packages/testkit",
]);
