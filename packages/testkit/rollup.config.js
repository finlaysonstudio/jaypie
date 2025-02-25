import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import copy from "rollup-plugin-copy";

export default [
  {
    external: ["@jaypie/core", "jest-json-schema", "lodash.isequal", "vitest"],
    input: "src/index.ts",
    output: {
      dir: "dist",
      format: "es",
      sourcemap: true,
    },
    plugins: [
      json(),
      typescript({
        exclude: ["**/__tests__/**/*", "**/*.test.ts"],
      }),
    ],
  },
  {
    external: [
      "@jaypie/aws",
      "@jaypie/core",
      "@jaypie/datadog",
      "@jaypie/express",
      "@jaypie/lambda",
      "@jaypie/llm",
      "@jaypie/mongoose",
      "@jaypie/textract",
      "amazon-textract-response-parser",
      "fs/promises",
      "jest-json-schema",
      "lodash.isequal",
      "path",
      "url",
      "vitest",
    ],
    input: "src/jaypie.mock.ts",
    output: {
      dir: "dist",
      format: "es",
      sourcemap: true,
    },
    plugins: [
      copy({
        targets: [{ src: "src/mockTextract.json", dest: "dist" }],
      }),
      json(),
      typescript({
        exclude: ["**/__tests__/**/*", "**/*.test.ts"],
      }),
    ],
  },
];
