import typescript from "@rollup/plugin-typescript";

export default {
  external: ["@jaypie/core", "jest-json-schema", "lodash.isequal", "vitest"],
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "es",
    sourcemap: true,
  },
  plugins: [typescript()],
};
