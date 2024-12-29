import typescript from "@rollup/plugin-typescript";

export default [
  {
    external: ["@jaypie/core", "jest-json-schema", "lodash.isequal", "vitest"],
    input: "src/index.ts",
    output: {
      dir: "dist",
      format: "es",
      sourcemap: true,
    },
    plugins: [typescript()],
  },
  {
    external: ["@jaypie/aws", "@jaypie/core", "@jaypie/datadog", "@jaypie/express", "@jaypie/lambda", "@jaypie/mongoose", "jest-json-schema", "lodash.isequal", "vitest"],
    input: "src/jaypie.mock.ts",
    output: {
      dir: "dist",
      format: "es",
      sourcemap: true,
    },
    plugins: [typescript()],
  },
];
