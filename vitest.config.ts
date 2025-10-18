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
      "packages/jaypie",
      "packages/kit",
      "packages/lambda",
      "packages/llm",
      "packages/mcp",
      "packages/mongoose",
      "packages/testkit",
      "packages/textract",
      "packages/webkit",
    ],
  },
});
