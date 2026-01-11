import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/aws",
      "packages/core",
      "packages/constructs",
      "packages/datadog",
      "packages/errors",
      "packages/eslint",
      "packages/express",
      "packages/fabricator",
      "packages/jaypie",
      "packages/kit",
      "packages/lambda",
      "packages/logger",
      "packages/llm",
      "packages/mcp",
      "packages/mongoose",
      "packages/repokit",
      "packages/testkit",
      "packages/textract",
    ],
  },
});
