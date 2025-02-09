import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "es",
    sourcemap: true,
  },
  plugins: [typescript()],
  external: [
    "@jaypie/aws",
    "@jaypie/core",
    "openai",
    "openai/helpers/zod",
    "zod",
  ],
};
