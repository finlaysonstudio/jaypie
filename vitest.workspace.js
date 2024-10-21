import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/aws",
  "packages/core",
  "packages/eslint",
  "packages/jaypie",
  "packages/testkit",
]);
